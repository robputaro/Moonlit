export const AMI_STYLES = [
  {
    id: 'Cozy Classic',
    description: 'Warm, timeless, and softly painterly.',
    bestFor: 'Best for bedtime',
    preview: '/style-previews/cozy-classic.webp',
    prompt: 'warm classic children’s picture-book illustration, softly painterly gouache and watercolor textures, cozy natural light, realistic child facial proportions translated gently into illustration, rich but comforting color, timeless hand-painted storybook charm',
    planningNotes: 'Identity comes before style. Preserve the real child’s visible face shape, age, hair, skin tone, eye shape, and distinctive supplied traits. Use natural-sized eyes, mouth, cheeks, head, hands, and body. Favor warmth, emotional comfort, and inviting lived-in spaces with rich soothing color.'
  },
  {
    id: 'Watercolor Dream',
    description: 'Soft, airy, gentle, and beautifully calm.',
    bestFor: 'Best for calming stories',
    preview: '/style-previews/watercolor-dream.webp',
    prompt: 'delicate watercolor children’s picture-book illustration, airy washes, visible paper texture, soft edges, luminous light, gentle pastel palette, subtle natural facial expressions, recognizable child likeness with realistic age-appropriate proportions, dreamy and calming atmosphere',
    planningNotes: 'Identity comes before watercolor stylization. Preserve the real child’s visible face shape, age, hair, skin tone, eye shape, and supplied traits without caricature. Keep scenes serene and breathable but specific, with graceful environment shifts and elegant negative space.'
  },
  {
    id: 'Bright Cartoon',
    description: 'Bold, cheerful, colorful, and full of energy.',
    bestFor: 'Best for toddlers',
    preview: '/style-previews/bright-cartoon.webp',
    prompt: 'bright modern cartoon picture-book illustration, clean controlled outlines, bold simple shapes, saturated cheerful colors, highly readable silhouettes, restrained natural facial expressions, recognizable child likeness with realistic age-appropriate facial and body proportions, energetic polished composition',
    planningNotes: 'Identity comes before cartoon styling. Do not create a mascot, chibi character, doll, or generic wide-eyed child. Keep eyes, head, cheeks, mouth, teeth, hands, and feet naturally proportioned. Use punchy color, varied locations, very clear actions, and energetic readable scenes.'
  }
];

const LEGACY_STYLE_MAP = {
  Watercolor: 'Watercolor Dream',
  'Picture Book': 'Bright Cartoon',
  'Paper Cutout': 'Cozy Classic',
  'Whimsical Storybook': 'Cozy Classic',
  'Adventure Picture Book': 'Cozy Classic',
  'Personalized 2D Storybook': 'Cozy Classic',
  'Keepsake Classic': 'Cozy Classic'
};

export function normalizeAmiStyle(style) {
  const normalized = LEGACY_STYLE_MAP[style] || style || 'Cozy Classic';
  return AMI_STYLES.some((item) => item.id === normalized) ? normalized : 'Cozy Classic';
}

export function getAmiStyle(style) {
  const id = normalizeAmiStyle(style);
  return AMI_STYLES.find((item) => item.id === id) || AMI_STYLES[0];
}

export function getAmiStylePrompt(style) {
  return getAmiStyle(style).prompt;
}

export function getAmiStylePlanningNotes(style) {
  return getAmiStyle(style).planningNotes || '';
}
