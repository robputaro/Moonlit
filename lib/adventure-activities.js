export const ADVENTURE_THEMES = [
  { id: 'dinosaurs', name: 'Dinosaur Discovery', shortName: 'Dinosaurs', accent: [86, 126, 91], pale: [232, 241, 226], motif: 'dinosaur' },
  { id: 'outer-space', name: 'Journey Through Space', shortName: 'Outer Space', accent: [73, 73, 128], pale: [232, 231, 246], motif: 'space' },
  { id: 'princess-magic', name: 'A Kingdom of Magic', shortName: 'Princess & Magic', accent: [142, 85, 132], pale: [248, 230, 244], motif: 'magic' }
];

export const AGE_BANDS = [
  { id: '2-3', min: 2, max: 3, name: 'Ages 2–3', reading: 'No reading required', difficulty: 1 },
  { id: '4-5', min: 4, max: 5, name: 'Ages 4–5', reading: 'Early learner', difficulty: 2 },
  { id: '6-7', min: 6, max: 7, name: 'Ages 6–7', reading: 'Growing reader', difficulty: 3 },
  { id: '8-10', min: 8, max: 10, name: 'Ages 8–10', reading: 'Independent explorer', difficulty: 4 }
];

export function getAgeBand(age) {
  const numeric = Math.max(2, Math.min(10, Number(age) || 4));
  return AGE_BANDS.find((band) => numeric >= band.min && numeric <= band.max) || AGE_BANDS[1];
}

export function getAdventureTheme(themeId) {
  return ADVENTURE_THEMES.find((theme) => theme.id === themeId) || ADVENTURE_THEMES[0];
}

const SHARED_LIBRARY = [
  { id: 'personalized-cover-v1', type: 'cover', reusable: false, personalization: 'name-theme', answerKey: false },
  { id: 'bookplate-v1', type: 'bookplate', reusable: true, personalization: 'name', answerKey: false },
  { id: 'hero-coloring-v1', type: 'hero-coloring', reusable: false, personalization: 'name-theme', answerKey: false },
  { id: 'trace-path-v1', type: 'trace-path', reusable: true, personalization: 'name', answerKey: false },
  { id: 'matching-v1', type: 'matching', reusable: true, personalization: 'light', answerKey: true },
  { id: 'counting-v1', type: 'counting', reusable: true, personalization: 'light', answerKey: true },
  { id: 'maze-v1', type: 'maze', reusable: true, personalization: 'name-theme', answerKey: true },
  { id: 'spot-difference-v1', type: 'spot-difference', reusable: true, personalization: 'light', answerKey: true },
  { id: 'pattern-v1', type: 'pattern', reusable: true, personalization: 'none', answerKey: true },
  { id: 'connect-dots-v1', type: 'connect-dots', reusable: true, personalization: 'none', answerKey: true },
  { id: 'draw-world-v1', type: 'draw-world', reusable: true, personalization: 'name-theme', answerKey: false },
  { id: 'hidden-objects-v1', type: 'hidden-objects', reusable: true, personalization: 'name-theme', answerKey: true },
  { id: 'name-tracing-v1', type: 'name-tracing', reusable: true, personalization: 'name', answerKey: false },
  { id: 'certificate-v1', type: 'certificate', reusable: true, personalization: 'name', answerKey: false },
  { id: 'next-adventure-v1', type: 'next-adventure', reusable: true, personalization: 'name', answerKey: false }
];

const YOUNGEST_OVERRIDES = {
  'spot-difference': 'big-small',
  'word-code': 'favorite-color',
  'story-choice': 'circle-choice'
};

const OLDEST_OVERRIDES = {
  'trace-path': 'logic-path',
  'name-tracing': 'creative-title',
  'story-choice': 'comic-prompt'
};

export function buildAdventurePlan({ childName, age, themeId }) {
  const band = getAgeBand(age);
  const theme = getAdventureTheme(themeId);
  const overrides = band.id === '2-3' ? YOUNGEST_OVERRIDES : band.id === '8-10' ? OLDEST_OVERRIDES : {};
  return SHARED_LIBRARY.map((activity, index) => ({
    ...activity,
    pageNumber: index + 1,
    variant: overrides[activity.type] || activity.type,
    ageBand: band.id,
    difficulty: band.difficulty,
    theme: theme.id,
    childName: String(childName || 'Explorer').trim().slice(0, 40)
  }));
}

export const ACTIVITY_LIBRARY_VERSION = 'ami-adventure-sampler-v2';
