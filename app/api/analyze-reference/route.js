import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

function extractJson(text = '') {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Photo analysis did not return valid JSON.');
  }
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.configured && !auth.user) return NextResponse.json({ error: 'Please sign in to personalize a story.' }, { status: 401 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Photo personalization is not configured yet.' }, { status: 503 });
    const { imageData, childName, age } = await request.json();
    if (!imageData?.startsWith('data:image')) return NextResponse.json({ error: 'Upload a valid child photo.' }, { status: 400 });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-5-mini',
        input: [{ role: 'user', content: [
          { type: 'input_text', text: `Create a neutral visual character reference for a children's picture-book illustrator. The child is named ${childName || 'the child'} and is approximately age ${age || 'unknown'}. Describe only visible, non-sensitive appearance details useful for consistent illustration. Do not identify the person, infer ethnicity, health, personality, gender, religion, or any sensitive trait. Return JSON only with: hair, face, skinToneVisual, eyesVisual, approximateAgeAppearance, clothingVisible, distinctiveNonSensitiveFeatures, illustratorSummary.` },
          { type: 'input_image', image_url: imageData, detail: 'high' }
        ] }],
        text: { format: { type: 'json_object' } }
      })
    });
    if (!response.ok) throw new Error(`OpenAI vision error: ${await response.text()}`);
    const data = await response.json();
    const outputText = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || '';
    return NextResponse.json({ profile: extractJson(outputText) });
  } catch (error) {
    console.error('Reference photo analysis failed:', error);
    return NextResponse.json({ error: 'AMI could not analyze that photo. Try a clear, well-lit image.' }, { status: 500 });
  }
}
