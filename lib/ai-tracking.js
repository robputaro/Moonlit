import { getAdminClient } from './billing-server';

function numericEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function estimateTextCostMicros({ provider, inputTokens = 0, outputTokens = 0 }) {
  const normalized = String(provider || '').toLowerCase();
  const inputPerMillion = normalized === 'anthropic'
    ? numericEnv('ANTHROPIC_TEXT_INPUT_USD_PER_1M', 3)
    : numericEnv('OPENAI_TEXT_INPUT_USD_PER_1M', 0.4);
  const outputPerMillion = normalized === 'anthropic'
    ? numericEnv('ANTHROPIC_TEXT_OUTPUT_USD_PER_1M', 15)
    : numericEnv('OPENAI_TEXT_OUTPUT_USD_PER_1M', 1.6);
  const dollars = (Number(inputTokens || 0) / 1_000_000) * inputPerMillion
    + (Number(outputTokens || 0) / 1_000_000) * outputPerMillion;
  return Math.max(0, Math.round(dollars * 1_000_000));
}

export function estimateImageCostMicros({ quality = 'medium', size = '1024x1536', referenceImage = false }) {
  const explicit = Number(process.env.OPENAI_IMAGE_ESTIMATED_USD);
  let dollars;
  if (Number.isFinite(explicit) && explicit >= 0) dollars = explicit;
  else {
    const q = String(quality || 'medium').toLowerCase();
    const portrait = String(size || '').includes('1536') || String(size || '').includes('1792');
    if (q === 'high') dollars = portrait ? 0.25 : 0.167;
    else if (q === 'low') dollars = portrait ? 0.016 : 0.011;
    else dollars = portrait ? 0.063 : 0.042;
  }
  if (referenceImage) dollars += numericEnv('OPENAI_REFERENCE_IMAGE_ESTIMATED_USD', 0.01);
  return Math.max(0, Math.round(dollars * 1_000_000));
}

export async function recordAiUsage(event) {
  try {
    if (!event?.userId) return;
    const admin = getAdminClient();
    const { error } = await admin.from('ai_usage_events').insert({
      user_id: event.userId,
      story_id: event.storyId || null,
      operation: event.operation || 'unknown',
      provider: event.provider || 'unknown',
      model: event.model || 'unknown',
      status: event.status || 'succeeded',
      input_tokens: Math.max(0, Number(event.inputTokens || 0)),
      output_tokens: Math.max(0, Number(event.outputTokens || 0)),
      image_count: Math.max(0, Number(event.imageCount || 0)),
      quality: event.quality || null,
      size: event.size || null,
      reference_image: Boolean(event.referenceImage),
      estimated_cost_micros: Math.max(0, Number(event.estimatedCostMicros || 0)),
      provider_request_id: event.providerRequestId || null,
      error_code: event.errorCode || null,
      metadata: event.metadata || {}
    });
    if (error) console.error('AI usage tracking insert failed:', error);
  } catch (error) {
    console.error('AI usage tracking failed:', error);
  }
}
