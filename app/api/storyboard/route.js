import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/supabase-server';
import { estimateImageCostMicros, recordAiUsage } from '../../../lib/ai-tracking';
import { getAmiStylePlanningNotes, getAmiStylePrompt, normalizeAmiStyle } from '../../../lib/ami-styles';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LAYOUTS = {
  2: { columns: 2, rows: 1, size: '2048x1536', order: 'left, right' },
  3: { columns: 3, rows: 1, size: '3072x1536', order: 'left, center, right' },
  4: { columns: 2, rows: 2, size: '2048x3072', order: 'top-left, top-right, bottom-left, bottom-right' }
};

function clip(value, limit = 1000) {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function compactCast(characterBible = {}, continuityBible = {}, referencePhotoAnalysis = null) {
  const props = (Array.isArray(continuityBible?.recurringProps) ? continuityBible.recurringProps : [])
    .slice(0, 8)
    .map((prop) => ({
      name: clip(prop?.name, 100),
      appearance: clip(prop?.description, 260),
      color: clip(prop?.color, 100),
      scale: clip(prop?.scale, 120),
      rules: clip(prop?.rules, 220)
    }));

  return {
    mainCharacter: clip(characterBible?.description, 1400),
    wardrobe: clip(characterBible?.lockedWardrobe, 700),
    visualAnchor: clip(characterBible?.visualAnchor, 800),
    photoProfile: clip(referencePhotoAnalysis, 1800),
    world: clip(continuityBible?.worldDescription, 600),
    palette: clip(continuityBible?.colorPalette, 350),
    recurringCastAndProps: props,
    forbiddenChanges: (Array.isArray(continuityBible?.forbiddenChanges) ? continuityBible.forbiddenChanges : [])
      .slice(0, 10)
      .map((item) => clip(item, 220))
  };
}

function compactPage(page = {}) {
  return {
    page: Number(page.pageNumber || 0),
    storyText: clip(page.text, 600),
    setting: clip(page.sceneLocation, 240),
    continuity: clip(page.continuityNotes, 420),
    requiredProps: (Array.isArray(page.recurringProps) ? page.recurringProps : []).slice(0, 8).map((item) => clip(item, 100)),
    action: clip(page.scenePlan?.action, 320),
    framing: clip(page.scenePlan?.framing, 240),
    lighting: clip(page.scenePlan?.lighting, 180),
    mood: clip(page.scenePlan?.mood, 160),
    foreground: clip(page.scenePlan?.foregroundDetail, 300),
    background: clip(page.scenePlan?.backgroundDetail, 300),
    illustration: clip(page.illustrationPrompt, 1500)
  };
}

function buildStoryboardPrompt(input, layout) {
  const pages = input.pages.map(compactPage);
  const cast = compactCast(input.characterBible, input.continuityBible, input.referencePhotoAnalysis);
  const styleId = normalizeAmiStyle(input.style);
  const prompt = `Create one production storyboard sheet containing exactly ${pages.length} finished children's picture-book illustrations.

SHEET GEOMETRY
- Canvas: ${layout.size}.
- Exact grid: ${layout.columns} columns by ${layout.rows} rows.
- Reading order: ${layout.order}.
- Every panel must have identical dimensions and fill its exact grid cell edge-to-edge.
- Use perfectly straight invisible boundaries at the mathematical center lines.
- No gutters, borders, frames, margins, rounded corners, panel numbers, labels, captions, speech bubbles, or written words.
- Never let a person, prop, background, or lighting effect cross from one panel into another.
- Each grid cell is a separate portrait story page that will be cropped automatically.

BOOK
Title: ${clip(input.storyTitle, 260)}
Style: ${styleId}
Art direction: ${clip(getAmiStylePrompt(styleId), 900)}
Style rules: ${clip(getAmiStylePlanningNotes(styleId), 900)}
Child age: ${clip(input.childAge, 80)}
Pronoun guidance: ${clip(input.childPronouns, 140)}

LOCKED CAST AND WORLD
${clip(cast, 6500)}

PANEL PLANS IN READING ORDER
${clip(pages, 12500)}

REFERENCE PRIORITY
- The first attached image is the real child and is authoritative for the child's face, age, hair, skin tone, proportions, and distinctive visible traits.
- The second attached image is the illustrated cover anchor and is authoritative for the book's illustration style, wardrobe, palette, and recurring supporting-character designs.
- Preserve the exact same illustrated child and every recurring family member across all panels.
- Dad, Mom, siblings, teachers, and companions must not change face shape, hair, facial hair, apparent age, clothing, body type, or color palette between panels.
- If a reference conflicts with text, preserve visual identity from the references while following the page action from the text.

QUALITY RULES
- Facial likeness outranks decorative style.
- Natural age-appropriate eyes, mouths, teeth, heads, hands, and bodies. No mascot, doll, chibi, giant-eyed, or uncanny faces.
- Every panel must depict its assigned page only and visually advance the story.
- Vary framing and action while keeping character identity exact.
- Complete foreground, middle ground, and background in every panel.
- Child-safe, warm, polished, print-worthy storybook art.
- No text, logos, watermarks, famous characters, graphic peril, or frightening imagery.`;

  return prompt.length <= 30000
    ? prompt
    : `${prompt.slice(0, 29600)}\nNON-NEGOTIABLE: exact grid, separate scenes, locked cast identity, natural anatomy, no text.`;
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request) {
  let tracking = { userId: null, storyId: null, operation: 'storyboard_generation', model: 'gpt-image-2' };
  try {
    const auth = await authenticateRequest(request);
    if (auth.configured && !auth.user) {
      return NextResponse.json({ error: 'Please sign in to create storyboards.' }, { status: 401 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI image generation is not configured yet.' }, { status: 503 });
    }

    const input = await request.json();
    const pages = Array.isArray(input.pages) ? input.pages.slice(0, 4) : [];
    const layout = LAYOUTS[pages.length];
    if (!layout) {
      return NextResponse.json({ error: 'AMI storyboard sheets require two, three, or four pages.' }, { status: 400 });
    }
    if (!input.referencePhoto || !input.anchorImage) {
      return NextResponse.json({ error: 'AMI needs both the child photo and cover anchor before building a storyboard.' }, { status: 400 });
    }

    const model = process.env.OPENAI_STORYBOARD_IMAGE_MODEL || 'gpt-image-2';
    const quality = input.productType === 'mini'
      ? (process.env.OPENAI_STORYBOARD_DRAFT_QUALITY || 'low')
      : (process.env.OPENAI_STORYBOARD_QUALITY || 'medium');
    tracking = {
      userId: auth.user?.id || null,
      storyId: input.storyId || null,
      operation: 'storyboard_generation',
      model
    };

    const body = new FormData();
    body.append('model', model);
    body.append('prompt', buildStoryboardPrompt({ ...input, pages }, layout));
    body.append('size', layout.size);
    body.append('quality', quality);
    body.append('output_format', 'jpeg');
    body.append('output_compression', '88');

    for (const source of [
      { url: input.referencePhoto, filename: 'child-reference.jpg' },
      { url: input.anchorImage, filename: 'cover-anchor.jpg' }
    ]) {
      const sourceResponse = await fetch(source.url);
      if (!sourceResponse.ok) throw new Error(`A storyboard reference could not be loaded (${sourceResponse.status}).`);
      body.append('image[]', await sourceResponse.blob(), source.filename);
    }

    let response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body
    });
    if (response.status === 429) {
      console.warn('AMI storyboard rate limited; retrying once after 20 seconds.');
      await wait(20000);
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body
      });
    }
    if (!response.ok) {
      const detail = await response.text();
      console.error('OpenAI storyboard error:', detail);
      return NextResponse.json({
        error: 'AMI paused this storyboard before creating inconsistent pages. Please retry in a moment.'
      }, { status: response.status });
    }

    const data = await response.json();
    const image = data?.data?.[0];
    const sheetUrl = image?.b64_json ? `data:image/jpeg;base64,${image.b64_json}` : image?.url;
    if (!sheetUrl) throw new Error('OpenAI returned no storyboard image.');

    await recordAiUsage({
      userId: auth.user?.id,
      storyId: input.storyId || null,
      operation: 'storyboard_generation',
      provider: 'openai',
      model,
      imageCount: 1,
      quality,
      size: layout.size,
      referenceImage: true,
      estimatedCostMicros: estimateImageCostMicros({ quality, size: layout.size, referenceImage: true }),
      providerRequestId: data?.id || image?.id || null,
      metadata: {
        page_numbers: pages.map((page) => page.pageNumber),
        panel_count: pages.length,
        columns: layout.columns,
        rows: layout.rows,
        experimental_storyboard: true
      }
    });

    return NextResponse.json({
      sheetUrl,
      columns: layout.columns,
      rows: layout.rows,
      panelCount: pages.length,
      pageNumbers: pages.map((page) => page.pageNumber)
    });
  } catch (error) {
    await recordAiUsage({
      ...tracking,
      provider: 'openai',
      status: 'failed',
      errorCode: error?.message?.slice(0, 160),
      metadata: { experimental_storyboard: true }
    });
    console.error('Storyboard route failed:', error);
    return NextResponse.json({ error: 'AMI could not build this storyboard sheet. Please try again.' }, { status: 500 });
  }
}
