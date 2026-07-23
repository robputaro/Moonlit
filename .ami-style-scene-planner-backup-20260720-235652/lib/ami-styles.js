export const AMI_STYLES = [
  {
    id: 'Cozy Classic',
    description: 'Warm, timeless, and softly painterly.',
    bestFor: 'Best for bedtime',
    preview: '/style-previews/cozy-classic.webp',
    prompt: 'warm classic children’s picture-book illustration, softly painterly gouache and watercolor textures, cozy lamplight, gentle rounded forms, rich but comforting nighttime color, timeless hand-painted storybook charm'
  },
  {
    id: 'Whimsical Storybook',
    description: 'Playful, curving, quirky, and full of imagination.',
    bestFor: 'Best for silly adventures',
    preview: '/style-previews/whimsical-storybook.webp',
    prompt: 'original whimsical ink-and-paint children’s storybook illustration, lively hand-drawn linework, playful curving trees and architecture, quirky exaggerated shapes, bouncy composition, bright imaginative color, entirely original visual language and no imitation of any named artist'
  },
  {
    id: 'Watercolor Dream',
    description: 'Soft, airy, gentle, and beautifully calm.',
    bestFor: 'Best for calming stories',
    preview: '/style-previews/watercolor-dream.webp',
    prompt: 'delicate watercolor children’s picture-book illustration, airy washes, visible paper texture, soft edges, luminous moonlight, gentle pastel palette, tender facial expressions, dreamy and calming atmosphere'
  },
  {
    id: 'Bright Cartoon',
    description: 'Bold, cheerful, colorful, and full of energy.',
    bestFor: 'Best for toddlers',
    preview: '/style-previews/bright-cartoon.webp',
    prompt: 'bright modern cartoon picture-book illustration, clean expressive outlines, bold simple shapes, saturated cheerful colors, highly readable silhouettes, playful facial expressions, energetic but polished composition'
  },
  {
    id: 'Adventure Picture Book',
    description: 'Cinematic scenes with action, wonder, and depth.',
    bestFor: 'Best for action & adventure',
    preview: '/style-previews/adventure-picture-book.webp',
    prompt: 'cinematic adventure children’s picture-book illustration, richly layered environment, dramatic but child-safe lighting, dynamic camera angle, strong sense of scale and motion, detailed scenic storytelling, polished painted finish'
  },
  {
    id: 'Keepsake Classic',
    description: 'Refined, timeless, and made to feel gift-worthy.',
    bestFor: 'Best for keepsakes',
    preview: '/style-previews/keepsake-classic.webp',
    prompt: 'premium heirloom children’s book illustration, refined traditional painting, elegant composition, nuanced warm palette, delicate texture, polished character rendering, timeless collectible picture-book finish suitable for a printed keepsake'
  }
];

const LEGACY_STYLE_MAP = {
  Watercolor: 'Watercolor Dream',
  'Picture Book': 'Bright Cartoon',
  'Paper Cutout': 'Whimsical Storybook'
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
