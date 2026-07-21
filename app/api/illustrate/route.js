import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/supabase-server';
import { estimateImageCostMicros, recordAiUsage } from '../../../lib/ai-tracking';

export const runtime = 'nodejs';
export const maxDuration = 300;

function buildImagePrompt({ storyTitle, style, characterBible, page, kind }) {
  const character = characterBible?.description || 'a cheerful young child with a warm, expressive face';
  const wardrobe = characterBible?.lockedWardrobe || 'a simple, age-appropriate outfit that remains identical on every page';
  const visualAnchor = characterBible?.visualAnchor || 'same face, hair, age, proportions, outfit, and palette throughout the book';
  const continuityBible = arguments[0]?.continuityBible || {};
  const continuityText = JSON.stringify(continuityBible);
  const priorScene = arguments[0]?.priorScene || '';
  const scene = kind === 'cover' ? page?.coverPrompt || page?.illustrationPrompt : page?.illustrationPrompt;
  const photoProfile = arguments[0]?.referencePhotoAnalysis ? `\nPHOTO-DERIVED PROFILE: ${JSON.stringify(arguments[0].referencePhotoAnalysis)}` : '';
  const pageNumber = Number(page?.pageNumber || 1);
  const framingSequence = [
    'wide establishing shot with layered environment and the character actively entering the scene',
    'medium action shot focused on interaction with a prop, companion, or part of the setting',
    'over-the-shoulder discovery view with a strong foreground element',
    'low-angle sense-of-wonder composition with environmental scale',
    'intimate close-to-medium emotional moment where hands, posture, and expression tell the story',
    'high or overhead view that clearly shows movement through the setting'
  ];
  const preferredFraming = framingSequence[(Math.max(1, pageNumber) - 1) % framingSequence.length];

  return `Create one polished portrait illustration for a children's picture book.

BOOK: ${storyTitle || 'AMI Story'}
IMAGE TYPE: ${kind === 'cover' ? 'front cover artwork without any words' : 'interior story page'}
ART DIRECTION: ${style || 'soft watercolor picture-book illustration'}

LOCKED MAIN CHARACTER:
${character}
Wardrobe that must remain consistent: ${wardrobe}
Continuity anchor: ${visualAnchor}${photoProfile}

LOCKED STORY CONTINUITY BIBLE:
${continuityText || 'No extra continuity data supplied.'}

PREVIOUS SCENE CONTEXT:
${priorScene || 'This is the first scene.'}

CURRENT SCENE LOCATION:
${page?.sceneLocation || 'Use the location described in the scene.'}

CURRENT PAGE CONTINUITY NOTES:
${page?.continuityNotes || 'Preserve all locked details.'}

RECURRING PROPS REQUIRED ON THIS PAGE:
${Array.isArray(page?.recurringProps) ? page.recurringProps.join(', ') : 'none specified'}

SCENE:
${scene}

PAGE-SPECIFIC COMPOSITION TARGET:
${kind === 'cover' ? 'dynamic cover tableau with a clear focal relationship and a richly suggested world' : preferredFraming}

Composition and safety requirements:
- One clear story moment with expressive body language and a warm emotional tone. The character must be doing something, reacting to something, or interacting with someone.
- Build a complete environment with meaningful foreground, middle ground, and background details that support the page text.
- Never use a blank, plain, studio, gradient-only, or empty background. Never default to a centered child standing and smiling at the viewer.
- Avoid passport-photo framing, fashion poses, repeated neutral standing poses, and generic character showcase compositions.
- Child-friendly, comforting, whimsical, and appropriate for young children.
- Preserve the exact character description, face, hair, clothing, age, proportions, and palette.
- Treat every recurring prop like a cast member: preserve its exact design, color, material, markings, and relative scale. A toy or miniature must never become a full-sized real object.
- Obey the continuity bible and setting logic literally. Do not substitute a different vehicle, species, plant product, furniture item, or companion. Do not show pinecones growing on palm trees or any comparable real-world category error.
- Compare the current scene to the previous scene and avoid unexplained changes. If a locked detail is absent from the current scene, do not redesign it when it returns later.
- Portrait page dimensions with cinematic visual depth; vary character scale and placement rather than centering the child on every page.
- ${kind === 'cover' ? 'Create a strong cover-worthy focal composition with room near the upper area, but do not render a title.' : 'Compose as a finished interior picture-book page.'}
- No written words, letters, captions, logos, watermarks, frames, or speech bubbles.
- No frightening imagery, realistic peril, shame, or medical imagery.
- Do not depict copyrighted or famous characters.
- Render as finished professional children's-book artwork, not a sketch or concept sheet.`;
}

export async function POST(request) {
  let tracking = { userId: null, storyId: null, operation: 'image_generation', model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1' };
  try {
    const auth = await authenticateRequest(request);
    if (auth.configured && !auth.user) {
      return NextResponse.json({ error: 'Please sign in to create stories.' }, { status: 401 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI image generation is not configured yet.' }, { status: 503 });
    }

    const input = await request.json();
    tracking = { userId: auth.user?.id || null, storyId: input.storyId || null, operation: input.operation || (input.kind === 'cover' ? 'cover_generation' : 'page_generation'), model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1' };
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
    const size = process.env.OPENAI_IMAGE_SIZE || '1024x1536';
    const requestedQuality = String(input.quality || '').toLowerCase();
    const quality = ['low', 'medium', 'high'].includes(requestedQuality) ? requestedQuality : (input.productType === 'mini' ? 'low' : (process.env.OPENAI_IMAGE_QUALITY || 'medium'));
    const scenePrompt = input?.kind === 'cover' ? input?.page?.coverPrompt || input?.page?.illustrationPrompt : input?.page?.illustrationPrompt;
    if (!scenePrompt) {
      return NextResponse.json({ error: 'This image is missing an illustration direction.' }, { status: 400 });
    }

    let response;
    const editSources = [];
    if (input.referencePhoto) editSources.push({ url: input.referencePhoto, filename: 'child-reference.jpg', role: 'child likeness reference' });
    if (input.anchorImage) editSources.push({ url: input.anchorImage, filename: 'visual-anchor.png', role: 'locked book visual anchor' });
    if (editSources.length) {
      try {
        const body = new FormData();
        body.append('model', model);
        body.append('prompt', `${buildImagePrompt(input)}\nUse the attached images only as continuity references. The child photo establishes likeness; the visual anchor establishes the exact illustrated character, wardrobe, palette, and recurring prop design. Create a new scene, not a copy of either reference.`);
        for (const source of editSources) {
          const sourceResponse = await fetch(source.url);
          if (!sourceResponse.ok) throw new Error(`${source.role} could not be loaded (${sourceResponse.status}).`);
          body.append('image', await sourceResponse.blob(), source.filename);
        }
        body.append('size', size);
        body.append('quality', quality);
        body.append('input_fidelity', 'high');
        response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body
        });
        if (!response.ok) console.warn('Continuity image edit failed; falling back to prompt-guided generation:', await response.clone().text());
      } catch (referenceError) {
        console.warn('Continuity references could not be used directly:', referenceError);
      }
    }

    if (!response?.ok) {
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          prompt: buildImagePrompt(input),
          size,
          quality,
          n: 1
        })
      });
    }

    if (!response.ok) {
      const detail = await response.text();
      console.error('OpenAI image error:', detail);
      return NextResponse.json({ error: 'The illustration could not be created. Check OpenAI billing, model access, and Vercel logs.' }, { status: response.status });
    }

    const data = await response.json();
    const image = data?.data?.[0];
    const imageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url;
    if (!imageUrl) throw new Error('OpenAI returned no image data.');

    await recordAiUsage({
      userId: auth.user?.id,
      storyId: input.storyId || null,
      operation: input.operation || (input.kind === 'cover' ? 'cover_generation' : 'page_generation'),
      provider: 'openai', model, imageCount: 1, quality, size,
      referenceImage: Boolean(input.referencePhoto || input.anchorImage),
      estimatedCostMicros: estimateImageCostMicros({ quality, size, referenceImage: Boolean(input.referencePhoto || input.anchorImage) }),
      providerRequestId: data?.id || image?.id || null,
      metadata: { page_number: input.page?.pageNumber || null, kind: input.kind || 'page', quality, used_anchor: Boolean(input.anchorImage), product_type: input.productType || 'full' }
    });
    return NextResponse.json({ imageUrl });
  } catch (error) {
    await recordAiUsage({ ...tracking, provider: 'openai', status: 'failed', errorCode: error?.message?.slice(0, 160), metadata: {} });
    console.error('Illustration route failed:', error);
    return NextResponse.json({ error: 'The illustration request failed. Please try again.' }, { status: 500 });
  }
}
