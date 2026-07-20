export const CURATED_ENGAGEMENT_FACTS = [
  { id: 'dino-chicken-size', topics: ['dinosaurs', 'adventure'], fact: 'Some dinosaurs were smaller than a modern chicken.', detail: 'Not every dinosaur was enormous. A few species were tiny, quick, and feathered.' },
  { id: 'trex-teeth', topics: ['dinosaurs'], fact: 'A Tyrannosaurus rex could grow dozens of teeth.', detail: 'Its teeth were shaped for gripping and could be replaced when they wore out.' },
  { id: 'octopus-hearts', topics: ['ocean', 'animals'], fact: 'An octopus has three hearts.', detail: 'Two hearts help move blood through the gills, and one pumps blood around the body.' },
  { id: 'dolphin-names', topics: ['ocean', 'animals', 'friendship'], fact: 'Dolphins use special whistles that work a little like names.', detail: 'A dolphin can recognize its own signature whistle and the whistles of familiar dolphins.' },
  { id: 'owl-neck', topics: ['animals', 'night', 'forest'], fact: 'Owls can turn their heads much farther than people can.', detail: 'Their necks are built to rotate far in either direction while their eyes stay fixed forward.' },
  { id: 'fox-hearing', topics: ['animals', 'forest'], fact: 'A fox can hear tiny animals moving under snow.', detail: 'Its sensitive ears help it locate sounds even when the animal is hidden.' },
  { id: 'bee-dance', topics: ['animals', 'garden', 'nature'], fact: 'Honeybees dance to show other bees where flowers are.', detail: 'The direction and length of the dance help describe where food can be found.' },
  { id: 'butterfly-feet', topics: ['animals', 'garden', 'nature'], fact: 'Butterflies taste with sensors on their feet.', detail: 'Landing on a plant helps them learn whether it may be a good place to eat or lay eggs.' },
  { id: 'trees-communicate', topics: ['forest', 'nature'], fact: 'Trees can share signals through underground fungal networks.', detail: 'These connections can help move nutrients and warning signals between nearby plants.' },
  { id: 'moon-footprints', topics: ['space', 'moon', 'night'], fact: 'Footprints on the Moon can last a very long time.', detail: 'The Moon has almost no wind or rain to wash them away.' },
  { id: 'sun-star', topics: ['space'], fact: 'The Sun is a star.', detail: 'It looks larger than other stars because it is much closer to Earth.' },
  { id: 'space-silent', topics: ['space'], fact: 'Space is nearly silent.', detail: 'Sound needs matter such as air or water to travel through, and space has very little of it.' },
  { id: 'cloud-weight', topics: ['weather', 'sky'], fact: 'A cloud can weigh hundreds of thousands of pounds.', detail: 'It stays up because its tiny water droplets are spread through a huge volume of air.' },
  { id: 'rainbow-circle', topics: ['weather', 'sky', 'magic'], fact: 'A rainbow is actually a full circle.', detail: 'From the ground, the horizon usually hides the lower half.' },
  { id: 'snowflakes-six', topics: ['weather', 'winter'], fact: 'Snowflakes usually have six sides.', detail: 'Water molecules arrange themselves in a six-sided pattern as they freeze.' },
  { id: 'brain-memories-sleep', topics: ['sleep', 'bedtime', 'body'], fact: 'Your brain keeps organizing memories while you sleep.', detail: 'Sleep helps the brain sort what happened during the day and strengthen learning.' },
  { id: 'heart-beats', topics: ['body'], fact: 'A child’s heart beats faster than an adult’s heart.', detail: 'Heart rate changes with age, activity, feelings, and rest.' },
  { id: 'bones-grow', topics: ['body', 'growing'], fact: 'Children have more bones than adults.', detail: 'Some bones gradually join together as the body grows.' },
  { id: 'feelings-body', topics: ['feelings', 'bravery', 'challenge'], fact: 'Feelings can show up in the body before we find the words for them.', detail: 'A fluttery tummy, warm cheeks, or tight shoulders can be clues about how we feel.' },
  { id: 'breathing-calm', topics: ['feelings', 'calm', 'bedtime'], fact: 'Slow breathing can help the body feel safer and calmer.', detail: 'A longer, gentle exhale can signal the nervous system that it is okay to settle.' },
  { id: 'memory-smell', topics: ['memory', 'family'], fact: 'Smells can bring back strong memories.', detail: 'The brain areas involved in smell are closely connected to emotion and memory.' },
  { id: 'penguin-huddle', topics: ['animals', 'winter', 'family'], fact: 'Emperor penguins huddle together to stay warm.', detail: 'They slowly trade places so different penguins get time in the warmer center.' },
  { id: 'elephant-comfort', topics: ['animals', 'friendship', 'feelings'], fact: 'Elephants comfort one another with touch and sound.', detail: 'They may use their trunks and gentle calls when another elephant is distressed.' },
  { id: 'sea-otter-hands', topics: ['animals', 'ocean', 'family'], fact: 'Sea otters sometimes hold paws while resting.', detail: 'This can help them stay close together while floating.' }
];

export function factsForTopics(topics = [], excludedIds = [], limit = 6) {
  const normalized = new Set(topics.map((topic) => String(topic || '').toLowerCase()));
  const excluded = new Set(excludedIds || []);
  return CURATED_ENGAGEMENT_FACTS
    .filter((item) => !excluded.has(item.id))
    .map((item) => ({ item, score: item.topics.reduce((sum, topic) => sum + (normalized.has(topic) ? 2 : 0), 0) + Math.random() }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
