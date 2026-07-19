import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 300;

function buildImagePrompt({ storyTitle, style, characterBible, page, kind }) {
  const character = characterBible?.description || 'a cheerful young child with a warm, expressive face';
  const wardrobe = characterBible?.lockedWardrobe || 'a simple, age-appropriate outfit that remains identical on every page';
  const visualAnchor = characterBible?.visualAnchor || 'same face, hair, age, proportions, outfit, and palette throughout the book';
  const scene = kind === 'cover' ? page?.coverPrompt || page?.illustrationPrompt : page?.illustrationPrompt;
  const photoProfile = arguments[0]?.referencePhotoAnalysis ? `\nPHOTO-DERIVED PROFILE: ${JSON.stringify(arguments[0].referencePhotoAnalysis)}` : '';

  return `Create one polished portrait illustration for a children's picture book.

BOOK: ${storyTitle || 'Moonlit Story'}
IMAGE TYPE: ${kind === 'cover' ? 'front cover artwork without any words' : 'interior story page'}
ART DIRECTION: ${style || 'soft watercolor picture-book illustration'}

LOCKED MAIN CHARACTER:
${character}
Wardrobe that must remain consistent: ${wardrobe}
Continuity anchor: ${visualAnchor}${photoProfile}

SCENE:
${scene}

Composition and safety requirements:
- One clear story moment with expressive body language and a warm emotional tone.
- Child-friendly, comforting, whimsical, and appropriate for young children.
- Preserve the exact character description, face, hair, clothing, age, proportions, and palette.
- Portrait composition with natural breathing space.
- ${kind === 'cover' ? 'Create a strong cover-worthy focal composition with room near the upper area, but do not render a title.' : 'Compose as a finished interior picture-book page.'}
- No written words, letters, captions, logos, watermarks, frames, or speech bubbles.
- No frightening imagery, realistic peril, shame, or medical imagery.
- Do not depict copyrighted or famous characters.
- Render as finished professional children's-book artwork, not a sketch or concept sheet.`;
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.configured && !auth.user) {
      return NextResponse.json({ error: 'Please sign in to create stories.' }, { status: 401 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI image generation is not configured yet.' }, { status: 503 });
    }

    const input = await request.json();
    const scenePrompt = input?.kind === 'cover' ? input?.page?.coverPrompt || input?.page?.illustrationPrompt : input?.page?.illustrationPrompt;
    if (!scenePrompt) {
      return NextResponse.json({ error: 'This image is missing an illustration direction.' }, { status: 400 });
    }

    let response;
    if (input.referencePhoto) {
      try {
        const sourceResponse = await fetch(input.referencePhoto);
        if (!sourceResponse.ok) throw new Error(`Reference photo could not be loaded (${sourceResponse.status}).`);
        const photoBlob = await sourceResponse.blob();
        const body = new FormData();
        body.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
        body.append('prompt', `${buildImagePrompt(input)}\nUse the attached child photo only as a visual likeness reference. Preserve recognizable non-sensitive features while transforming the child into the selected illustrated storybook style. Do not reproduce the original background or create a photorealistic image.`);
        body.append('image', photoBlob, 'child-reference.jpg');
        body.append('size', process.env.OPENAI_IMAGE_SIZE || '1024x1536');
        body.append('quality', process.env.OPENAI_IMAGE_QUALITY || 'medium');
        body.append('input_fidelity', 'high');
        response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body
        });
        if (!response.ok) console.warn('Reference image edit failed; falling back to profile-guided generation:', await response.clone().text());
      } catch (referenceError) {
        console.warn('Reference image could not be used directly:', referenceError);
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
          model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
          prompt: buildImagePrompt(input),
          size: process.env.OPENAI_IMAGE_SIZE || '1024x1536',
          quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
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

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Illustration route failed:', error);
    return NextResponse.json({ error: 'The illustration request failed. Please try again.' }, { status: 500 });
  }
}
