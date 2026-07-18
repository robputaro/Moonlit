import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/supabase-server';

function demoStory(input) {
  const name = input.childName || 'August';
  const count = Math.max(5, Math.min(16, Number(input.length) || 10));
  const appearance = input.appearance || 'a cheerful child with a warm, curious expression';
  const wardrobe = input.appearance || 'cozy green pajamas and yellow rain boots';
  const beats = [
    `${name} noticed something glowing beneath the old sunflower leaves. It was no bigger than a plum, warm as toast, and covered in tiny golden spots.`,
    `When ${name} gently picked it up, the little egg gave a cheerful wobble. From inside came the faintest sound: tap… tap… squeak!`,
    `A baby dinosaur popped out wearing half its shell like a hat. It blinked twice, sneezed a puff of glitter, and looked around for its family.`,
    `${name} packed a brave explorer bag with a snack, a flashlight, and the one thing every expedition needs: a very good hug.`,
    `Together they followed three enormous footprints past the garden gate and into a forest where the ferns whispered directions.`,
    `At the wobbly log bridge, ${name} felt a flutter in their tummy. “Brave does not mean never scared,” ${name} whispered. “It means taking one careful step.”`,
    `On the other side, a deep rumble rolled through the trees. The baby dinosaur squeaked and hid behind ${name}'s knees.`,
    `${name} called into the mist, and three gentle dinosaurs appeared. The biggest one lowered its long neck and gave the baby the happiest nuzzle in the whole forest.`,
    `The dinosaur family thanked ${name} with a smooth, star-shaped stone that shimmered whenever someone did something kind.`,
    `That night, tucked safely into bed, ${name} placed the stone beside the pillow. It gave one tiny glow, as if to say: every brave adventure begins with a kind heart.`
  ];
  const pages = Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
    text: beats[index % beats.length],
    illustrationPrompt: `${input.style || 'Watercolor'} children's book illustration of ${name}, ${appearance}, wearing ${wardrobe}, ${index < 2 ? 'discovering a tiny glowing dinosaur egg in a magical backyard' : index < count - 2 ? 'traveling with a tiny friendly dinosaur through a whimsical fern forest' : 'reuniting the baby dinosaur with its gentle family beneath a moonlit sky'}. Warm, safe, expressive, consistent character design, no text in image.`
  }));
  return {
    title: `${name} and the Moonlit Dinosaur Egg`,
    summary: `A gentle ${input.theme?.toLowerCase() || 'adventure'} about helping a lost baby dinosaur find its family.`,
    takeaway: input.lesson || 'Being brave can mean taking one careful step and asking for help.',
    coverPrompt: `${input.style || 'Watercolor'} children’s picture-book cover illustration of ${name}, ${appearance}, wearing ${wardrobe}, holding a softly glowing dinosaur egg beneath a moonlit sky. Strong focal composition, magical but comforting, no written title or text, consistent character design.`,
    characterBible: {
      name,
      description: `${name}, age ${input.age}, ${appearance}`,
      lockedWardrobe: wardrobe,
      visualAnchor: 'same face, hair, age, proportions, clothing, and color palette on every page'
    },
    pages
  };
}

function pronounInstruction(value) {
  if (value === 'use-name') return "Use the child's name instead of pronouns whenever practical.";
  return `Use ${value || 'they/them'} pronouns.`;
}

function buildPrompt(input) {
  return `You are a thoughtful children's storybook author. Create a safe, warm, age-appropriate personalized story for a ${input.age}-year-old child.

Child: ${input.childName}
${pronounInstruction(input.pronouns)}
Appearance: ${input.appearance || 'not specified'}
Story mode: ${input.storyMode || 'Challenge'}
Challenge: ${input.challenge || 'not specified'}
Desired emotional outcome: ${input.emotionalOutcome || 'safe and supported'}
Fun-story theme: ${input.theme || 'Adventure'}
Parent's context or story idea: ${input.storyIdea || 'none provided'}
Favorite elements: ${input.favorites || 'none specified'}
Desired lesson: ${input.lesson || 'a gentle positive emotional resolution'}
Visual style: ${input.style}
Page count: ${input.length}

Requirements:
- Exactly ${input.length} pages.
- 25-55 words per page.
- A clear beginning, escalation, emotional turning point, and comforting resolution.
- If this is a Challenge story, use imaginative metaphor rather than lecturing. Reflect the real challenge gently, normalize mixed feelings, model one or two practical coping actions, and end with the child feeling ${input.emotionalOutcome || 'safe and supported'}.
- Do not promise the challenge will instantly disappear.
- Do not make the child feel bad, behind, babyish, or responsible for adult emotions.
- Never shame or frighten the child.
- Avoid graphic danger, death, weapons, adult themes, or medical claims.
- Use the child's name naturally without overusing it.
- Return only valid JSON matching this structure:
{"title":"","summary":"","takeaway":"","coverPrompt":"","characterBible":{"name":"","description":"","lockedWardrobe":"","visualAnchor":""},"pages":[{"pageNumber":1,"text":"","illustrationPrompt":""}]}
- coverPrompt must describe one polished portrait cover scene without title text.
- Every illustrationPrompt must repeat the child's stable appearance and wardrobe, maintain the selected visual style, describe a single clear scene, and end with: "consistent character design, no text in image."`;
}

function extractJson(text = '') {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('The model response did not contain valid JSON.');
  }
}

function validateStory(story, expectedPages) {
  if (!story?.title || !Array.isArray(story.pages) || story.pages.length === 0) {
    throw new Error('The story response was incomplete.');
  }
  if (Number(expectedPages) && story.pages.length !== Number(expectedPages)) {
    throw new Error(`Expected ${expectedPages} pages but received ${story.pages.length}.`);
  }
  return story;
}

async function openAIStory(input) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: buildPrompt(input),
      text: { format: { type: 'json_object' } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI error: ${await response.text()}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  return extractJson(text);
}

async function claudeStory(input) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 6500,
      messages: [{ role: 'user', content: buildPrompt(input) }]
    })
  });
  if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);
  const data = await response.json();
  const text = data.content?.find(block => block.type === 'text')?.text || '';
  return extractJson(text);
}

async function generateWithRetry(generator, input, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return validateStory(await generator(input), input.length);
    } catch (error) {
      lastError = error;
      console.error(`Story generation attempt ${attempt} failed:`, error);
    }
  }
  throw lastError;
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.configured && !auth.user) {
      return NextResponse.json({ error: 'Please sign in to create stories.' }, { status: 401 });
    }
    const input = await request.json();
    if (!input.childName) return NextResponse.json({ error: 'Please include a child name.' }, { status: 400 });

    const provider = (process.env.STORY_PROVIDER || '').toLowerCase();
    let story;
    if (provider === 'openai' && process.env.OPENAI_API_KEY) story = await generateWithRetry(openAIStory, input);
    else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) story = await generateWithRetry(claudeStory, input);
    else story = demoStory(input);

    return NextResponse.json(story);
  } catch (error) {
    console.error('Story route failed:', error);
    return NextResponse.json({ error: 'We could not finish that story this time. Please try again.' }, { status: 500 });
  }
}
