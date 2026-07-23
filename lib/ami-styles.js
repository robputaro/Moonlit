export const AMI_STYLES = [
  {
    id: 'Cozy Classic',
    description: 'Warm, timeless, and softly painterly.',
    bestFor: 'Best for bedtime',
    preview: '/style-previews/cozy-classic.webp',
    prompt: 'warm classic children’s picture-book illustration, softly painterly gouache and watercolor textures, cozy lamplight, gentle rounded forms, rich but comforting color, timeless hand-painted storybook charm',
    planningNotes: 'Favor warmth, emotional comfort, and inviting lived-in spaces. Use softly varied rooms, porches, gardens, paths, and bedtime corners rather than generic blank environments. Colors should feel rich and soothing, not flat or gray.'
  },
  {
    id: 'Whimsical Storybook',
    description: 'Playful, curving, quirky, and full of imagination.',
    bestFor: 'Best for silly adventures',
    preview: '/style-previews/whimsical-storybook.webp',
    prompt: 'radiant whimsical children’s storybook illustration, candy-bright palette, playful curving trees and architecture, swirly decorative foliage, exaggerated perspective, buoyant hand-drawn charm, imaginative sky details, quirky visual surprises, lively shape language, colorful and magical original picture-book art with no imitation of any named artist',
    planningNotes: 'Push color, shape play, and imaginative worldbuilding. Avoid beige or washed-out scenes. Use bright jewel tones, inventive scenery, playful curves, whimsical cloud shapes, decorative plant life, and delightfully exaggerated environments.'
  },
  {
    id: 'Watercolor Dream',
    description: 'Soft, airy, gentle, and beautifully calm.',
    bestFor: 'Best for calming stories',
    preview: '/style-previews/watercolor-dream.webp',
    prompt: 'delicate watercolor children’s picture-book illustration, airy washes, visible paper texture, soft edges, luminous light, gentle pastel palette, tender facial expressions, dreamy and calming atmosphere',
    planningNotes: 'Keep scenes serene and breathable, but still specific. Use graceful environment shifts, atmospheric light, and elegant negative space without ever becoming empty or visually repetitive.'
  },
  {
    id: 'Bright Cartoon',
    description: 'Bold, cheerful, colorful, and full of energy.',
    bestFor: 'Best for toddlers',
    preview: '/style-previews/bright-cartoon.webp',
    prompt: 'bright modern cartoon picture-book illustration, clean expressive outlines, bold simple shapes, saturated cheerful colors, highly readable silhouettes, playful facial expressions, energetic polished composition',
    planningNotes: 'Use punchy color and instantly readable scenes. Favor simple but varied locations, very clear actions, and toy-like clarity. Keep every page energetic and easy to scan.'
  },
  {
    id: 'Personalized 2D Storybook',
    description: 'Bright, clean illustration that keeps their recognizable traits.',
    bestFor: 'Fast & personalized',
    preview: '/style-previews/personalized-2d-storybook.webp',
    prompt: 'original modern 2D children’s picture-book illustration, recognizable personalized child character, clean hand-drawn contours, bright flat-to-gently-shaded color, clear facial structure, natural child proportions, simplified dimensional forms, expressive but restrained features, crisp readable scene design, polished contemporary storybook finish',
    planningNotes: 'Preserve the child’s recognizable face shape, hair pattern, skin tone, eye color, glasses, and other supplied traits. Simplify the environment before simplifying the child. Use bright original color relationships and playful shape language without imitating any named artist, studio, franchise, or existing book. Keep eyes, mouth, teeth, hands, and accessories natural and stable.'
  },
  {
    id: 'Keepsake Classic',
    description: 'Refined, timeless, and made to feel gift-worthy.',
    bestFor: 'Best for keepsakes',
    preview: '/style-previews/keepsake-classic.webp',
    prompt: 'premium heirloom children’s book illustration, refined traditional painting, elegant composition, nuanced warm palette, delicate texture, polished character rendering, timeless collectible picture-book finish suitable for a printed keepsake',
    planningNotes: 'Balance warmth with refinement. Favor elegant composition, polished environments, and gift-worthy detail. Scenes should feel premium, intentional, and cohesive.'
  }
];

const LEGACY_STYLE_MAP = {
  Watercolor: 'Watercolor Dream',
  'Picture Book': 'Bright Cartoon',
  'Paper Cutout': 'Whimsical Storybook',
  'Adventure Picture Book': 'Personalized 2D Storybook'
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
