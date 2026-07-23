import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/supabase-server';
import { getAdminClient } from '../../../lib/billing-server';
import { estimateTextCostMicros, recordAiUsage } from '../../../lib/ai-tracking';
import { getAmiStylePlanningNotes, getAmiStylePrompt, normalizeAmiStyle } from '../../../lib/ami-styles';

function demoStory(input) {
  const name = input.childName || 'August';
  const count = Math.max(5, Math.min(16, Number(input.length) || 10));
  const appearance = input.appearance || 'a cheerful child with a warm, curious expression';
  const wardrobe = input.appearance || 'cozy green pajamas and yellow rain boots';
  const recurringProps = [{
    name: 'glowing dinosaur egg',
    description: 'plum-sized egg with tiny golden spots',
    color: 'warm cream and gold',
    scale: 'smaller than the child’s hand',
    rules: 'Never change size, markings, or material.'
  }];
  const sceneLocations = ['sunflower garden corner', 'vegetable path by the fence', 'fern-lined trail', 'wobbly creek bridge', 'moonlit forest clearing'];
  const framings = ['wide establishing shot', 'medium action shot', 'over-the-shoulder discovery view', 'low-angle wonder shot', 'intimate close emotional moment'];
  const lights = ['golden afternoon', 'soft late-afternoon glow', 'cool forest shade', 'sparkling evening light', 'gentle moonlight'];
  const moods = ['curious', 'surprised', 'brave', 'hopeful', 'comforted'];
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
  const pages = Array.from({ length: count }, (_, index) => {
    const phase = index < 2 ? 'discovering a tiny glowing dinosaur egg in a magical backyard' : index < count - 2 ? 'traveling with a tiny friendly dinosaur through a whimsical fern forest' : 'reuniting the baby dinosaur with its gentle family beneath a moonlit sky';
    return {
      pageNumber: index + 1,
      text: beats[index % beats.length],
      sceneLocation: sceneLocations[index % sceneLocations.length],
      continuityNotes: `Keep ${name}'s appearance and wardrobe unchanged. The glowing dinosaur egg must remain plum-sized, warm cream with tiny golden spots, and smaller than the child’s hand whenever shown.`,
      recurringProps: index <= 5 ? ['glowing dinosaur egg'] : ['star-shaped stone'],
      scenePlan: {
        action: phase,
        framing: framings[index % framings.length],
        lighting: lights[index % lights.length],
        mood: moods[index % moods.length],
        foregroundDetail: index % 2 === 0 ? 'leafy plants and stepping stones' : 'roots, pebbles, or bridge planks close to the camera',
        backgroundDetail: index % 2 === 0 ? 'fence lines, garden beds, or distant trees' : 'layered forest depth, a path, or a moonlit clearing',
        environmentBeat: index < 3 ? 'home garden world' : index < count - 2 ? 'journey deeper into the forest' : 'safe reunion and return'
      },
      illustrationPrompt: `${getAmiStylePrompt(input.style)}. Children's book illustration of ${name}, ${appearance}, wearing ${wardrobe}, ${phase} in the ${sceneLocations[index % sceneLocations.length]}. Show a clear action, visible emotion through body language, layered foreground and background detail, ${lights[index % lights.length]}, ${framings[index % framings.length]}, and a complete environment. consistent character design, no text in image.`
    };
  });
  return {
    title: `${name} and the Glowing Dinosaur Egg`,
    summary: `A gentle ${input.theme?.toLowerCase() || 'adventure'} about helping a lost baby dinosaur find its family.`,
    takeaway: input.lesson || 'Being brave can mean taking one careful step and asking for help.',
    coverPrompt: `${getAmiStylePrompt(input.style)}. Children’s picture-book cover illustration of ${name}, ${appearance}, wearing ${wardrobe}, holding a softly glowing dinosaur egg in a lush magical garden under a moonlit sky, with rich foreground plants, layered background trees, and a strong focal composition. No written title or text. consistent character design, no text in image.`,
    characterBible: {
      name,
      description: `${name}, age ${input.age}, ${appearance}`,
      lockedWardrobe: wardrobe,
      visualAnchor: 'same face, hair, age, proportions, clothing, and color palette on every page'
    },
    continuityBible: {
      worldDescription: 'A coherent whimsical garden that opens into a fern forest and then a moonlit reunion clearing',
      colorPalette: 'warm gold, fern green, moonlit blue',
      recurringProps,
      settingLogic: ['Plants and objects must behave naturally unless magic is explicitly described.', 'A toy or miniature object must never become full-sized.', 'Scenes should progress through believable locations rather than repeating the same generic backdrop.'],
      forbiddenChanges: ['No unexplained wardrobe, prop color, species, or scale changes.', 'Do not redesign recurring props between pages.', 'Do not substitute a different vehicle, companion, or object for a locked recurring item.']
    },
    language: input.language || 'en',
    dedication: input.dedication || '',
    pages
  };
}

function pronounInstruction(value) {
  if (value === 'use-name') return "Use the child's name instead of pronouns whenever practical.";
  return `Use ${value || 'they/them'} pronouns.`;
}

function languageInstruction(value) {
  if (value === 'es') return 'Write every reader-visible field in natural, age-appropriate Spanish. This includes title, summary, takeaway, and every page text. Do not include English translations. Illustration prompts must remain in English.';
  if (value === 'en-es') return 'Create a genuinely bilingual English-Spanish book. For title, summary, and takeaway, provide English first, then Spanish separated by " / ". For every page text, write a concise English paragraph followed by a blank line and then a natural Spanish rendering prefixed "Español: ". Do not translate word-for-word when a more natural child-friendly Spanish phrase works better. Keep illustration prompts entirely in English.';
  return 'Write every reader-visible field in natural, age-appropriate English. Illustration prompts must also be in English.';
}

function ageWritingProfile(ageValue, language) {
  const age = Math.max(2, Math.min(10, Number(ageValue) || 4));
  const bilingual = language === 'en-es';
  if (age <= 3) {
    return {
      label: 'young picture-book listener',
      words: bilingual ? '8-18 words per language per page' : '15-30 words per page',
      sentences: 'Usually 1-3 short sentences per page.',
      craft: 'Use concrete words, rhythmic repetition, predictable phrasing, one clear action per page, and a very simple emotional arc. Avoid long explanations, stacked clauses, abstract vocabulary, and more than one new plot idea on a page.'
    };
  }
  if (age <= 5) {
    return {
      label: 'preschool picture-book listener',
      words: bilingual ? '14-26 words per language per page' : '24-45 words per page',
      sentences: 'Usually 2-5 short sentences per page.',
      craft: 'Use clear cause and effect, playful repetition, brief dialogue, vivid concrete details, and one main story beat per page. Keep paragraphs compact and easy to read aloud.'
    };
  }
  if (age <= 7) {
    return {
      label: 'early elementary listener or emerging reader',
      words: bilingual ? '20-34 words per language per page' : '38-68 words per page',
      sentences: 'Use a short paragraph with varied but readable sentences.',
      craft: 'Use richer dialogue, stronger plot progression, more specific description, and nuanced emotions while remaining read-aloud friendly. Let the child make meaningful choices in the story.'
    };
  }
  return {
    label: 'older elementary reader',
    words: bilingual ? '28-45 words per language per page' : '55-90 words per page',
    sentences: 'Use one or two compact paragraphs with varied sentence rhythm.',
    craft: 'Use layered narrative, character agency, richer humor or suspense, and subtler emotional lessons. Avoid sounding babyish, repetitive, or overly instructional.'
  };
}

function visualProgressionRules(pageCount) {
  const count = Math.max(3, Math.min(16, Number(pageCount) || 10));
  return [
    `Plan the book as a visual journey across ${count} pages. Use scene progression rather than repeating the same yard, room, or neutral backdrop.`,
    count <= 4
      ? 'Use at least 3 distinct micro-settings or visual situations across the book.'
      : count <= 8
        ? 'Use at least 4 distinct micro-settings or visual situations across the book.'
        : 'Use at least 5 distinct micro-settings or visual situations across the book.',
    'Change not just the crop, but also the environment, staging, and action whenever the story beat changes.',
    'Adjacent pages must not repeat the same framing, emotional beat, or background type.'
  ].join(' ');
}

function buildPrompt(input) {
  const ageProfile = ageWritingProfile(input.age, input.language);
  const styleId = normalizeAmiStyle(input.style);
  const stylePrompt = getAmiStylePrompt(input.style);
  const stylePlanningNotes = getAmiStylePlanningNotes(input.style);
  const isChallenge = input.storyMode === 'Challenge';
  const modeContext = isChallenge
    ? `This is a CHALLENGE STORY.
Current challenge: ${input.challenge || 'a parent-described growing moment'}
Desired emotional outcome: ${input.emotionalOutcome || 'safe and supported'}
Parent context: ${input.storyIdea || 'none provided'}

Use imaginative metaphor rather than lecturing. Reflect the challenge gently, normalize mixed feelings, model one or two practical coping actions, and end with the selected emotional outcome. Do not promise the challenge will instantly disappear.`
    : `This is a JUST-FOR-FUN STORY.
Theme: ${input.theme || 'Adventure'}
Parent story idea: ${input.storyIdea || 'Create a playful original adventure.'}

Do not mention, imply, reuse, or resolve any childhood challenge, milestone, pacifier transition, emotional struggle, or prior challenge selection unless the parent explicitly included it in the fun-story idea.`;

  return `You are a thoughtful children's storybook author and visual planner. Create a safe, warm, age-appropriate personalized story for a ${input.age}-year-old child.

Child: ${input.childName}
${pronounInstruction(input.pronouns)}
Appearance notes from family: ${input.appearance || 'not specified'}
Photo-derived visual profile: ${input.referencePhotoAnalysis ? JSON.stringify(input.referencePhotoAnalysis) : 'no reference photo supplied'}
When a photo-derived profile is supplied, use it as the primary visual reference while keeping the result stylized, child-friendly, and non-photorealistic. Do not infer sensitive traits or identity.
Preserve the child's recognizable supplied traits without exaggerating the eyes, mouth, teeth, cheeks, head size, or body proportions.
Book language: ${input.language || 'en'}
${languageInstruction(input.language)}
Dedication supplied by the family: ${input.dedication || 'none'}
${modeContext}
Favorite elements: ${input.favorites || 'none specified'}
Optional lesson or value: ${input.lesson || 'a gentle positive emotional resolution'}
Visual style name: ${styleId}
Visual style art direction: ${stylePrompt}
Visual style planning notes: ${stylePlanningNotes}
Page count: ${input.length}

Requirements:
- Exactly ${input.length} pages.
- Write for a ${ageProfile.label}.
- Page-length target: ${ageProfile.words}.
- Sentence guidance: ${ageProfile.sentences}
- Age-specific craft guidance: ${ageProfile.craft}
- Treat these page-length targets as hard editorial limits. Do not compensate for a young age by squeezing multiple long ideas into one sentence.
- For bilingual books, both language sections must independently follow the age-specific limit while preserving a complete, natural story arc.
- A clear beginning, escalation, emotional turning point, and comforting resolution.
- Do not make the child feel bad, behind, babyish, or responsible for adult emotions.
- Never shame or frighten the child.
- Avoid graphic danger, death, weapons, adult themes, or medical claims.
- Use the child's name naturally without overusing it.
- Do not output HTML entities, HTML tags, or stray symbol sequences such as "&>" in any reader-visible text.
- Before writing the pages, silently build a continuity bible and a hidden scene planner for the entire book.
- ${visualProgressionRules(input.length)}
- Return only valid JSON matching this structure:
{"title":"","summary":"","takeaway":"","coverPrompt":"","characterBible":{"name":"","description":"","lockedWardrobe":"","visualAnchor":""},"continuityBible":{"worldDescription":"","colorPalette":"","recurringProps":[{"name":"","description":"","color":"","scale":"","rules":""}],"settingLogic":[""],"forbiddenChanges":[""]},"pages":[{"pageNumber":1,"text":"","sceneLocation":"","continuityNotes":"","recurringProps":[""],"scenePlan":{"action":"","framing":"","lighting":"","mood":"","foregroundDetail":"","backgroundDetail":"","environmentBeat":""},"illustrationPrompt":""}]}
- coverPrompt must describe one polished portrait cover scene without title text.
- Build a continuityBible before planning pages. Identify every recurring object, vehicle, companion, outfit, and environment feature that must remain stable. Specify exact color, material, relative scale, and rules.
- If an object is a toy, miniature, stuffed animal, or child-sized item, explicitly lock that scale and forbid depicting it as full-sized.
- settingLogic must state simple real-world constraints relevant to the chosen environment (for example, palm trees do not grow pinecones; indoor objects do not appear outdoors without a story reason).
- forbiddenChanges must list likely visual drift to prevent: color swaps, scale changes, wardrobe changes, species or object substitutions, and unexplained setting changes.
- Each page must include sceneLocation, continuityNotes, recurringProps, and scenePlan. The illustrationPrompt must restate the exact locked appearance of any recurring prop shown on that page.
- Treat the illustrations as a visual sequence, not a collection of character portraits.
- Every scenePlan must define: action, framing, lighting, mood, foregroundDetail, backgroundDetail, and environmentBeat.
- Every illustrationPrompt must explicitly include: the setting, a visible action, the child's emotion through body language, meaningful props or companions, foreground detail, background detail, lighting, and a camera framing.
- Use varied framing across the book: establishing wide shot, medium interaction, close emotional detail, low-angle wonder, overhead discovery, or over-the-shoulder view. Never use the same framing on adjacent pages.
- No more than one page in the entire book may be a simple portrait. Do not place the child standing alone against a plain, blank, studio, gradient, or empty background unless the story absolutely requires it.
- Each page must visually advance that exact story beat through action or interaction. Avoid repeated poses, repeated rooms, repeated centered compositions, and generic smiling-at-camera scenes.
- Ensure the first, middle, turning-point, and final scenes feel visually distinct in location, scale, mood, and composition.
- Every illustrationPrompt must repeat the child's stable appearance and wardrobe, maintain the selected visual style, and end with: "consistent character design, no text in image."`;
}

function cleanGeneratedText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\s*&\s*>\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function cleanGeneratedStory(story) {
  if (!story || typeof story !== 'object') return story;
  return {
    ...story,
    title: cleanGeneratedText(story.title || ''),
    summary: cleanGeneratedText(story.summary || ''),
    takeaway: cleanGeneratedText(story.takeaway || ''),
    coverPrompt: cleanGeneratedText(story.coverPrompt || ''),
    characterBible: story.characterBible ? {
      ...story.characterBible,
      name: cleanGeneratedText(story.characterBible.name || ''),
      description: cleanGeneratedText(story.characterBible.description || ''),
      lockedWardrobe: cleanGeneratedText(story.characterBible.lockedWardrobe || ''),
      visualAnchor: cleanGeneratedText(story.characterBible.visualAnchor || '')
    } : story.characterBible,
    continuityBible: story.continuityBible ? {
      ...story.continuityBible,
      worldDescription: cleanGeneratedText(story.continuityBible.worldDescription || ''),
      colorPalette: cleanGeneratedText(story.continuityBible.colorPalette || ''),
      recurringProps: Array.isArray(story.continuityBible.recurringProps)
        ? story.continuityBible.recurringProps.map((prop) => ({
          ...prop,
          name: cleanGeneratedText(prop.name || ''),
          description: cleanGeneratedText(prop.description || ''),
          color: cleanGeneratedText(prop.color || ''),
          scale: cleanGeneratedText(prop.scale || ''),
          rules: cleanGeneratedText(prop.rules || '')
        }))
        : [],
      settingLogic: Array.isArray(story.continuityBible.settingLogic) ? story.continuityBible.settingLogic.map(cleanGeneratedText) : [],
      forbiddenChanges: Array.isArray(story.continuityBible.forbiddenChanges) ? story.continuityBible.forbiddenChanges.map(cleanGeneratedText) : []
    } : story.continuityBible,
    pages: Array.isArray(story.pages)
      ? story.pages.map((page) => ({
        ...page,
        text: cleanGeneratedText(page.text || ''),
        sceneLocation: cleanGeneratedText(page.sceneLocation || ''),
        continuityNotes: cleanGeneratedText(page.continuityNotes || ''),
        recurringProps: Array.isArray(page.recurringProps) ? page.recurringProps.map(cleanGeneratedText) : [],
        scenePlan: page.scenePlan ? {
          action: cleanGeneratedText(page.scenePlan.action || ''),
          framing: cleanGeneratedText(page.scenePlan.framing || ''),
          lighting: cleanGeneratedText(page.scenePlan.lighting || ''),
          mood: cleanGeneratedText(page.scenePlan.mood || ''),
          foregroundDetail: cleanGeneratedText(page.scenePlan.foregroundDetail || ''),
          backgroundDetail: cleanGeneratedText(page.scenePlan.backgroundDetail || ''),
          environmentBeat: cleanGeneratedText(page.scenePlan.environmentBeat || '')
        } : undefined,
        illustrationPrompt: cleanGeneratedText(page.illustrationPrompt || '')
      }))
      : story.pages
  };
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
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input: buildPrompt(input), text: { format: { type: 'json_object' } } })
  });
  if (!response.ok) throw new Error(`OpenAI error: ${await response.text()}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  return {
    story: extractJson(text),
    provider: 'openai', model,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    providerRequestId: data.id || null
  };
}

async function claudeStory(input) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 6500, messages: [{ role: 'user', content: buildPrompt(input) }] })
  });
  if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);
  const data = await response.json();
  const text = data.content?.find(block => block.type === 'text')?.text || '';
  return {
    story: extractJson(text),
    provider: 'anthropic', model,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    providerRequestId: data.id || null
  };
}

async function generateWithRetry(generator, input, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await generator(input);
      return { ...result, story: validateStory(result.story, input.length), attempts: attempt };
    } catch (error) {
      lastError = error;
      console.error(`Story generation attempt ${attempt} failed:`, error);
    }
  }
  throw lastError;
}

export async function POST(request) {
  let reserved = false;
  let generationId = '';
  let userId = '';
  let isMiniStory = false;
  try {
    const auth = await authenticateRequest(request);
    if (auth.configured && !auth.user) {
      return NextResponse.json({ error: 'Please sign in to create stories.' }, { status: 401 });
    }
    const input = await request.json();
    isMiniStory = input.productType === 'mini';
    if (isMiniStory) input.length = '3';
    if (!input.childName) return NextResponse.json({ error: 'Please include a child name.' }, { status: 400 });

    if (auth.user) {
      userId = auth.user.id;
      generationId = input.generationId || crypto.randomUUID();
      const admin = getAdminClient();
      if (isMiniStory) {
        const emailVerified = Boolean(auth.user.email_confirmed_at || auth.user.confirmed_at || auth.user.app_metadata?.provider === 'google');
        if (!emailVerified) return NextResponse.json({ error: 'Confirm your email before creating your free AMI Mini Story.', code: 'EMAIL_NOT_VERIFIED' }, { status: 403 });
        const { error: miniError } = await admin.rpc('reserve_free_mini_story', { p_user_id: userId, p_generation_id: generationId });
        if (miniError) {
          const message = miniError.message || '';
          if (message.includes('MINI_STORY_ALREADY_USED')) return NextResponse.json({ error: 'This account has already used its free AMI Mini Story.', code: 'MINI_STORY_ALREADY_USED' }, { status: 409 });
          if (message.includes('MINI_STORY_IN_PROGRESS')) return NextResponse.json({ error: 'A free Mini Story is already being created for this account.', code: 'MINI_STORY_IN_PROGRESS' }, { status: 409 });
          throw miniError;
        }
        reserved = true;
      } else {
        const { error: reserveError } = await admin.rpc('reserve_story_credit', { p_user_id: userId, p_reference_id: generationId });
        if (reserveError) {
          if (reserveError.message?.includes('NO_STORY_CREDITS')) {
            return NextResponse.json({ error: 'You need a story credit to create this book. Join AMI Membership or wait for your next monthly credits.', code: 'NO_STORY_CREDITS' }, { status: 402 });
          }
          throw reserveError;
        }
        reserved = true;
      }
    }

    const provider = (process.env.STORY_PROVIDER || '').toLowerCase();
    let result;
    if (provider === 'openai' && process.env.OPENAI_API_KEY) result = await generateWithRetry(openAIStory, input);
    else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) result = await generateWithRetry(claudeStory, input);
    else result = { story: demoStory(input), provider: 'demo', model: 'demo', inputTokens: 0, outputTokens: 0, providerRequestId: null, attempts: 1 };

    const story = result.story;
    story.language = input.language || 'en';
    story.dedication = cleanGeneratedText(input.dedication || '');
    story.productType = isMiniStory ? 'mini' : 'full';
    story.printEligible = !isMiniStory;
    story.regenerationsAllowed = !isMiniStory;
    if (isMiniStory && auth.user) {
      const admin = getAdminClient();
      const { error: completeMiniError } = await admin.rpc('complete_free_mini_story', { p_user_id: auth.user.id, p_generation_id: generationId });
      if (completeMiniError) throw completeMiniError;
    }
    if (auth.user) {
      await recordAiUsage({
        userId: auth.user.id,
        storyId: input.generationId || null,
        operation: isMiniStory ? 'mini_story_generation' : 'story_generation',
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostMicros: estimateTextCostMicros(result),
        providerRequestId: result.providerRequestId,
        metadata: { page_count: Number(input.length) || 0, attempts: result.attempts || 1, language: input.language || 'en', product_type: isMiniStory ? 'mini' : 'full' }
      });
    }
    return NextResponse.json({ ...cleanGeneratedStory(story), billing: { creditUsed: reserved, generationId } });
  } catch (error) {
    if (reserved && userId && generationId) {
      try {
        const admin = getAdminClient();
        if (isMiniStory) await admin.rpc('release_free_mini_story', { p_user_id: userId, p_generation_id: generationId });
        else await admin.rpc('refund_story_credit', { p_user_id: userId, p_reference_id: generationId });
      } catch (refundError) {
        console.error('Story credit refund failed:', refundError);
      }
    }
    if (userId) await recordAiUsage({ userId, storyId: generationId || null, operation: isMiniStory ? 'mini_story_generation' : 'story_generation', provider: (process.env.STORY_PROVIDER || 'unknown'), model: process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || 'unknown', status: 'failed', errorCode: error?.message?.slice(0, 160), metadata: {} });
    console.error('Story route failed:', error);
    return NextResponse.json({ error: 'We could not finish that story this time. Your story credit was restored. Please try again.' }, { status: 500 });
  }
}
