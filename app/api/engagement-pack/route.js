import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/supabase-server';
import { estimateTextCostMicros, recordAiUsage } from '../../../lib/ai-tracking';
import { factsForTopics } from '../../../lib/engagement-facts';

function clean(value, max = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function extractJson(text = '') {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('No valid engagement JSON returned.');
  }
}

function ageFact(fact, age) {
  if (Number(age) <= 4) return fact.fact;
  if (Number(age) <= 7) return `${fact.fact} ${fact.detail}`;
  return `${fact.fact} ${fact.detail}`;
}

function fallbackQuestions(input) {
  const name = clean(input.childName || input.characterName || 'your child', 50);
  const setting = clean(input.setting || 'the story world', 80);
  return [
    { id: `fallback-sidekick-${Date.now()}`, type: 'choice', eyebrow: 'A tiny choice', question: `Which sidekick would ${name} invite into ${setting}?`, options: ['A brave owl', 'A tiny fox', 'A bouncy bunny', 'A very silly dinosaur'] },
    { id: `fallback-discovery-${Date.now()}`, type: 'choice', eyebrow: 'Imagine this', question: `What would ${name} be most excited to discover next?`, options: ['A secret door', 'A glowing map', 'A friendly creature', 'A sky full of colors'] },
    { id: `fallback-laugh-${Date.now()}`, type: 'about', eyebrow: 'About them', question: `What makes ${name} laugh the hardest?`, placeholder: 'A silly voice, dancing, a favorite joke…' },
    { id: `fallback-comfort-${Date.now()}`, type: 'about', eyebrow: 'For future stories', question: `What helps ${name} feel cozy or safe?`, placeholder: 'A blanket, a song, a hug, a stuffed animal…' },
    { id: `fallback-snack-${Date.now()}`, type: 'choice', eyebrow: 'A playful pick', question: 'Choose a storybook snack.', options: ['Apple stars', 'Moon cookies', 'Rainbow toast', 'Something extremely silly'] }
  ];
}

function normalizeQuestions(raw, recentIds = []) {
  const recent = new Set(recentIds || []);
  const cards = Array.isArray(raw?.cards) ? raw.cards : [];
  return cards.slice(0, 9).map((card, index) => {
    const type = ['choice', 'about', 'imagine'].includes(card.type) ? card.type : 'choice';
    const idBase = clean(card.id || `${type}-${index}-${clean(card.question, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, 100);
    const id = recent.has(idBase) ? `${idBase}-${Date.now()}-${index}` : idBase;
    const normalized = {
      id,
      type: type === 'imagine' ? 'choice' : type,
      eyebrow: clean(card.eyebrow || (type === 'about' ? 'About them' : type === 'imagine' ? 'Imagine this' : 'A fun choice'), 50),
      question: clean(card.question, 180)
    };
    if (!normalized.question) return null;
    if (normalized.type === 'choice') {
      normalized.options = (Array.isArray(card.options) ? card.options : []).map((option) => clean(option, 55)).filter(Boolean).slice(0, 4);
      if (normalized.options.length < 2) return null;
    } else {
      normalized.placeholder = clean(card.placeholder || 'Type a short answer…', 100);
    }
    return normalized;
  }).filter(Boolean);
}

function buildPrompt(input, selectedFacts) {
  return `Create a fresh set of optional engagement cards for a personalized children's storybook generation screen.

Child name: ${clean(input.childName || input.characterName, 50)}
Child age: ${Number(input.age) || 4}
Story title: ${clean(input.title, 120)}
Story summary: ${clean(input.summary, 500)}
Story theme or challenge: ${clean(input.theme || input.challenge, 120)}
Story setting: ${clean(input.setting, 180)}
Important characters or details: ${clean(input.characters || input.favorites, 250)}
Recently shown card IDs to avoid: ${(input.recentCardIds || []).slice(0, 40).join(', ') || 'none'}

Generate exactly 9 cards:
- 4 playful multiple-choice questions connected to this exact story
- 2 imaginative multiple-choice prompts
- 3 optional "about the child" questions that could improve future personalization

Rules:
- Make the questions meaningfully different from generic sidekick, sky, snack, or favorite-color questions unless the story strongly calls for them.
- Keep wording warm, specific, age-appropriate, and easy to answer while waiting.
- Never ask for sensitive information, location, school name, medical details, or identifying information.
- Do not claim answers will definitely change the current book.
- Every multiple-choice card must have exactly 4 short options.
- Return only valid JSON in this structure:
{"cards":[{"id":"stable-short-id","type":"choice|imagine|about","eyebrow":"","question":"","options":["","","",""] ,"placeholder":""}]}

The following verified facts will be inserted separately, so do not invent factual claims:
${selectedFacts.map((fact) => `- ${fact.fact}`).join('\n')}`;
}

async function generateOpenAI(input, selectedFacts) {
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input: buildPrompt(input, selectedFacts), text: { format: { type: 'json_object' } }, max_output_tokens: 1800 })
  });
  if (!response.ok) throw new Error(`OpenAI engagement error: ${await response.text()}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || '';
  return { parsed: extractJson(text), provider: 'openai', model, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0, providerRequestId: data.id || null };
}

async function generateAnthropic(input, selectedFacts) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1800, messages: [{ role: 'user', content: buildPrompt(input, selectedFacts) }] })
  });
  if (!response.ok) throw new Error(`Anthropic engagement error: ${await response.text()}`);
  const data = await response.json();
  const text = data.content?.find((block) => block.type === 'text')?.text || '';
  return { parsed: extractJson(text), provider: 'anthropic', model, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0, providerRequestId: data.id || null };
}

export async function POST(request) {
  const auth = await authenticateRequest(request);
  if (auth.configured && !auth.user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const input = await request.json();
  const topics = [input.theme, input.challenge, input.setting, ...(input.topics || [])].filter(Boolean);
  const selectedFacts = factsForTopics(topics, input.recentFactIds || [], 5);
  let generated = null;
  try {
    const provider = String(process.env.STORY_PROVIDER || '').toLowerCase();
    if (provider === 'openai' && process.env.OPENAI_API_KEY) generated = await generateOpenAI(input, selectedFacts);
    else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) generated = await generateAnthropic(input, selectedFacts);
    else if (process.env.ANTHROPIC_API_KEY) generated = await generateAnthropic(input, selectedFacts);
    else if (process.env.OPENAI_API_KEY) generated = await generateOpenAI(input, selectedFacts);
  } catch (error) {
    console.error('Dynamic engagement generation failed; using fallback:', error);
  }

  const questionCards = generated ? normalizeQuestions(generated.parsed, input.recentCardIds) : fallbackQuestions(input);
  const factCards = selectedFacts.map((fact) => ({ id: `fact-${fact.id}`, sourceFactId: fact.id, type: 'fact', eyebrow: 'Tiny fact', fact: ageFact(fact, input.age) }));
  const combined = [];
  const max = Math.max(questionCards.length, factCards.length);
  for (let index = 0; index < max; index += 1) {
    if (questionCards[index]) combined.push(questionCards[index]);
    if (factCards[index]) combined.push(factCards[index]);
  }

  if (generated && auth.user) {
    await recordAiUsage({
      userId: auth.user.id,
      storyId: input.storyId || null,
      operation: 'engagement_pack_generation',
      provider: generated.provider,
      model: generated.model,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      estimatedCostMicros: estimateTextCostMicros(generated),
      providerRequestId: generated.providerRequestId,
      metadata: { card_count: combined.length, fact_count: factCards.length }
    });
  }

  return NextResponse.json({ cards: combined.slice(0, 12), generated: Boolean(generated), factIds: selectedFacts.map((fact) => fact.id) });
}
