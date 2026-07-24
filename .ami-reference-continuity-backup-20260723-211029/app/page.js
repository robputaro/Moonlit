'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase-browser';
import SiteFooter from './components/SiteFooter';
import { AMI_STYLES, normalizeAmiStyle } from '../lib/ami-styles';

const challenges = [
  ['Giving up the pacifier', 'A gentle goodbye to a familiar comfort'],
  ['Starting preschool', 'Make a new beginning feel exciting and safe'],
  ['Sleeping in their own bed', 'Build confidence around bedtime'],
  ['Welcoming a new sibling', 'Make room for mixed feelings and connection'],
  ['Visiting the dentist', 'Turn uncertainty into familiarity'],
  ['Missing someone', 'Feel close even when someone is away'],
  ['Trying new foods', 'Encourage curiosity without pressure'],
  ['Sharing', 'Practice generosity and taking turns'],
  ['Handling frustration', 'Name big feelings and find a next step'],
  ['Moving to a new home', 'Carry belonging into a new place'],
  ['Feeling nervous', 'Find courage one small step at a time'],
  ['Custom challenge', 'Describe what is happening right now']
];

const feelings = ['Brave', 'Calm', 'Safe', 'Excited', 'Understood', 'Proud'];

const funModes = [
  ['Adventure', 'A brave journey into somewhere new'],
  ['Wind Down', 'Soft, cozy, and made for bedtime'],
  ['Just for Laughs', 'Funny, surprising, and delightfully weird'],
  ['Family Memory', 'Turn a real moment into a keepsake']
];

const styles = AMI_STYLES;

const storyLoadingMessages = [
  'Learning about your child…',
  'Shaping the challenge gently…',
  'Writing the story arc…',
  'Preparing each page…',
  'Almost ready…'
];

const imageLoadingMessages = [
  'Sketching the scene…',
  'Painting the details…',
  'Finishing the page…'
];

const fallbackEngagementCards = [
  { type: 'choice', eyebrow: 'A tiny choice', question: 'Which little sidekick would your child pick?', options: ['Owl', 'Fox', 'Bunny', 'Tiny dinosaur'] },
  { type: 'fact', eyebrow: 'Tiny fact', fact: 'Some dinosaurs were smaller than a modern chicken.' },
  { type: 'about', eyebrow: 'About them', question: 'What makes your child laugh the hardest?', placeholder: 'A silly voice, dancing, their sibling…' },
  { type: 'choice', eyebrow: 'A magical detail', question: 'Which sky feels most storybook-like?', options: ['Starry', 'Moonlit', 'Rainbow', 'Cloudy and cozy'] },
  { type: 'fact', eyebrow: 'Tiny fact', fact: 'Your brain keeps organizing memories while you sleep.' },
  { type: 'about', eyebrow: 'For future stories', question: 'What is their favorite stuffed animal or comfort item?', placeholder: 'A blue dinosaur named Roar…' },
  { type: 'choice', eyebrow: 'A playful pick', question: 'Choose an adventure snack.', options: ['Apple stars', 'Moon cookies', 'Pancakes', 'Something very silly'] },
  { type: 'fact', eyebrow: 'Tiny fact', fact: 'Owls can turn their heads much farther than people can.' }
];

const AMI_DRAFT_KEY = 'ami-story-draft-v1';
const AMI_ENGAGEMENT_HISTORY_KEY = 'ami-engagement-history-v1';
const AMI_DRAFT_MAX_PHOTO_LENGTH = 2_000_000;
const AMI_ADVENTURE_PROMPT_SEEN_KEY = 'ami-adventure-prompt-seen-v1';
const AMI_ADVENTURE_INTEREST_KEY = 'ami-adventure-interest-v1';
const AMI_ADVENTURE_PROMPT_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

function canonicalSiteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://www.storiesbyami.com';
}

function readStoryDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AMI_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.form || !parsed.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoryDraft(payload) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AMI_DRAFT_KEY, JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
  } catch (error) {
    console.warn('AMI could not save the local story draft:', error);
  }
}


function cleanStoryText(value) {
  if (typeof value !== 'string') return value;

  let cleaned = value;

  // Decode named and numeric HTML entities without injecting HTML into the page.
  if (cleaned.includes('&')) {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = cleaned;
      cleaned = textarea.value;
    } else {
      cleaned = cleaned
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
    }
  }

  // Remove a malformed literal artifact occasionally returned by the story model.
  // It is not valid prose or HTML and should never appear in a book.
  return cleaned
    .replace(/\s*&\s*>\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

const decodeHtmlEntities = cleanStoryText;

function decodeStoryEntities(story) {
  if (!story || typeof story !== 'object') return story;
  return {
    ...story,
    title: decodeHtmlEntities(story.title || ''),
    summary: decodeHtmlEntities(story.summary || ''),
    takeaway: decodeHtmlEntities(story.takeaway || ''),
    dedication: decodeHtmlEntities(story.dedication || ''),
    coverPrompt: decodeHtmlEntities(story.coverPrompt || ''),
    characterBible: story.characterBible ? {
      ...story.characterBible,
      name: decodeHtmlEntities(story.characterBible.name || ''),
      description: decodeHtmlEntities(story.characterBible.description || '')
    } : story.characterBible,
    continuityBible: story.continuityBible ? {
      ...story.continuityBible,
      worldDescription: decodeHtmlEntities(story.continuityBible.worldDescription || ''),
      colorPalette: decodeHtmlEntities(story.continuityBible.colorPalette || '')
    } : story.continuityBible,
    pages: Array.isArray(story.pages) ? story.pages.map((page) => ({
      ...page,
      text: decodeHtmlEntities(page.text || ''),
      illustrationPrompt: decodeHtmlEntities(page.illustrationPrompt || ''),
      coverPrompt: decodeHtmlEntities(page.coverPrompt || '')
    })) : story.pages
  };
}

const LIBRARY_DB = 'moonlit-library';
const LIBRARY_STORE = 'stories';

function openLibraryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
        db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putSavedStory(record) {
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LIBRARY_STORE, 'readwrite');
    transaction.objectStore(LIBRARY_STORE).put(record);
    transaction.oncomplete = () => { db.close(); resolve(record); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function getSavedStories() {
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LIBRARY_STORE, 'readonly');
    const request = transaction.objectStore(LIBRARY_STORE).getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result || []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function removeSavedStory(id) {
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LIBRARY_STORE, 'readwrite');
    transaction.objectStore(LIBRARY_STORE).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function prepareReferencePhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = source;
  });
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}


const emptyForm = {
  childName: '',
  age: '4',
  pronouns: 'use-name',
  appearance: '',
  language: 'en',
  dedication: '',
  storyMode: 'Challenge',
  challenge: 'Giving up the pacifier',
  emotionalOutcome: 'Brave',
  theme: 'Adventure',
  storyIdea: '',
  favorites: '',
  lesson: '',
  style: 'Cozy Classic',
  length: '10',
  productType: 'full'
};

export default function Home() {
  const adventureBooksEnabled = process.env.NEXT_PUBLIC_AMI_ADVENTURE_BOOKS_ENABLED === 'true';
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState('create');
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [imageLoadingMessage, setImageLoadingMessage] = useState({});
  const [coverLoading, setCoverLoading] = useState(false);
  const [storyId, setStoryId] = useState(null);
  const [savedStories, setSavedStories] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const autosaveTimerRef = useRef(null);
  const autosaveBusyRef = useRef(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [localImportCount, setLocalImportCount] = useState(0);
  const [importingStories, setImportingStories] = useState(false);
  const [theme, setTheme] = useState('light');
  const [keepsakeExporting, setKeepsakeExporting] = useState(false);
  const [coverExporting, setCoverExporting] = useState(false);
  const [coverSpec, setCoverSpec] = useState({ totalWidth: '19.00', totalHeight: '10.25', spineWidth: '0.25' });
  const [backCoverBlurb, setBackCoverBlurb] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [referencePhoto, setReferencePhoto] = useState('');
  const [referencePhotoAnalysis, setReferencePhotoAnalysis] = useState(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [billingStatus, setBillingStatus] = useState(null);
  const [referralStatus, setReferralStatus] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [generationAllProgress, setGenerationAllProgress] = useState({ current: 0, total: 0 });
  const [adventurePromptOpen, setAdventurePromptOpen] = useState(false);
  const [engagementAnswers, setEngagementAnswers] = useState({});
  const [surpriseMessage, setSurpriseMessage] = useState('');
  const [engagementCardIndex, setEngagementCardIndex] = useState(0);
  const [engagementCards, setEngagementCards] = useState(fallbackEngagementCards);
  const [engagementPackLoading, setEngagementPackLoading] = useState(false);
  const engagementPackStoryRef = useRef('');
  const draftSaveTimer = useRef(null);

  const progress = useMemo(() => {
    if (step === 'create') return 1;
    if (step === 'review') return 2;
    if (step === 'read') return 3;
    return 0;
  }, [step]);

  useEffect(() => {
    const canonical = canonicalSiteUrl();
    try {
      const target = new URL(canonical);
      if (window.location.hostname !== target.hostname && ['storiesbyami.com', 'readami.com', 'www.readami.com'].includes(window.location.hostname)) {
        const next = `${target.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.replace(next);
        return;
      }
    } catch {}

    const draft = readStoryDraft();
    if (draft) {
      setForm((current) => ({ ...current, ...draft.form }));
      setReferencePhoto(draft.referencePhoto || '');
      setReferencePhotoAnalysis(draft.referencePhotoAnalysis || null);
      setStep('create');
      setDraftMessage('Your unfinished story setup was restored.');
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady || step !== 'create') return undefined;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      const safePhoto = referencePhoto && referencePhoto.length <= AMI_DRAFT_MAX_PHOTO_LENGTH ? referencePhoto : '';
      writeStoryDraft({
        form,
        step: 'create',
        referencePhoto: safePhoto,
        referencePhotoAnalysis
      });
    }, 350);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [form, step, referencePhoto, referencePhotoAnalysis, draftReady]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('moonlit-theme');
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (systemPrefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('moonlit-theme', theme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#12101d' : '#f7f0e5');
  }, [theme]);

  useEffect(() => {
    if (!adventureBooksEnabled || step !== 'create' || loading || story) return undefined;
    const lastSeen = Number(window.localStorage.getItem(AMI_ADVENTURE_PROMPT_SEEN_KEY) || 0);
    const alreadyInterested = window.localStorage.getItem(AMI_ADVENTURE_INTEREST_KEY) === 'true';
    if (alreadyInterested || Date.now() - lastSeen < AMI_ADVENTURE_PROMPT_COOLDOWN) return undefined;

    let previousY = window.scrollY;
    let furthestRatio = 0;
    const onScroll = () => {
      const pageRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, window.scrollY / pageRange);
      furthestRatio = Math.max(furthestRatio, ratio);
      const intentionallyReturning = furthestRatio >= 0.3 && window.scrollY < previousY - 14;
      const exploredEnough = ratio >= 0.45;
      previousY = window.scrollY;
      if (!intentionallyReturning && !exploredEnough) return;
      window.localStorage.setItem(AMI_ADVENTURE_PROMPT_SEEN_KEY, String(Date.now()));
      setAdventurePromptOpen(true);
      window.removeEventListener('scroll', onScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [adventureBooksEnabled, step, loading, story]);

  useEffect(() => {
    if (story?.summary && !backCoverBlurb) setBackCoverBlurb(decodeHtmlEntities(story.summary));
  }, [story?.summary]);

  useEffect(() => {
    let cancelled = false;
    async function resolveAdmin() {
      if (!user || !supabaseConfigured) { if (!cancelled) setIsAdmin(false); return; }
      const configuredAdmin = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase();
      const emailMatches = configuredAdmin && user.email?.toLowerCase() === configuredAdmin;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!cancelled) setIsAdmin(Boolean(emailMatches || data?.role === 'admin'));
    }
    resolveAdmin();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!loading) return undefined;
    let index = 0;
    setLoadingMessage(storyLoadingMessages[0]);
    const interval = setInterval(() => {
      index = Math.min(index + 1, storyLoadingMessages.length - 1);
      setLoadingMessage(storyLoadingMessages[index]);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      if (nextSession?.user) {
        setAuthOpen(false);
        window.setTimeout(async () => {
          try {
            const localStories = await getSavedStories();
            setLocalImportCount(localStories.length);
          } catch {}
        }, 0);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function requestSignIn(message = 'Create a free account to save and continue your stories anywhere.') {
    const safePhoto = referencePhoto && referencePhoto.length <= AMI_DRAFT_MAX_PHOTO_LENGTH ? referencePhoto : '';
    writeStoryDraft({ form, step: 'create', referencePhoto: safePhoto, referencePhotoAnalysis });
    setAuthMessage(message);
    setAuthOpen(true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!supabaseConfigured) return;
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({ email: authEmail, password: authPassword })
        : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (result.error) throw result.error;
      if (authMode === 'signup' && !result.data.session) {
        setAuthMessage('Check your email to confirm your account, then return to AMI.');
      } else {
        setAuthMessage('You’re signed in.');
        setAuthOpen(false);
      }
    } catch (err) {
      setAuthMessage(err.message || 'AMI could not sign you in.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabaseConfigured) return;
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${canonicalSiteUrl()}/?resume=draft`,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (googleError) throw googleError;
    } catch (err) {
      setAuthMessage(err.message || 'AMI could not start Google sign-in.');
      setAuthLoading(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSavedStories([]);
    setStep('create');
  }

  async function getAccessToken() {
    if (!supabaseConfigured) return '';
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function authenticatedFetch(url, options = {}) {
    const token = await getAccessToken();
    if (supabaseConfigured && !token) {
      requestSignIn('Sign in before creating a story so it can be saved to your shelf.');
      throw new Error('Please sign in to continue.');
    }
    return fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
  }


  async function refreshBillingStatus() {
    if (!user || !supabaseConfigured) { setBillingStatus(null); return; }
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/billing/status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (response.ok) setBillingStatus(await response.json());
    } catch {}
  }

  async function refreshReferralStatus() {
    if (!user || !supabaseConfigured) { setReferralStatus(null); setReferralError(''); return; }
    setReferralLoading(true);
    setReferralError('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/referrals/status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'AMI could not load your referral link.');
      setReferralStatus(data);
    } catch (statusError) {
      setReferralError(statusError.message || 'AMI could not load your referral link.');
    } finally {
      setReferralLoading(false);
    }
  }

  useEffect(() => {
    refreshBillingStatus();
    refreshReferralStatus();
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) window.localStorage.setItem('ami-referral-code-v1', code);
  }, []);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    const code = window.localStorage.getItem('ami-referral-code-v1');
    if (!code) return;
    authenticatedFetch('/api/referrals/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
    }).then(async (response) => {
      if (response.ok) {
        const data = await response.json();
        if (data.captured) setReferralMessage('Referral connected. Your friend will receive a bonus credit after your first paid membership invoice.');
        window.localStorage.removeItem('ami-referral-code-v1');
        refreshReferralStatus();
      }
    }).catch(() => {});
  }, [user]);

  async function signedAssetUrl(path) {
    if (!path || !supabaseConfigured) return '';
    const { data, error: signedError } = await supabase.storage.from('story-assets').createSignedUrl(path, 60 * 60 * 6);
    if (signedError) return '';
    return data.signedUrl;
  }

  async function hydrateCloudRecord(row) {
    const storyData = structuredClone(row.story_data || {});
    if (storyData.coverImagePath || row.cover_path) {
      storyData.coverImagePath = storyData.coverImagePath || row.cover_path;
      storyData.coverImageUrl = await signedAssetUrl(storyData.coverImagePath);
    }
    if (storyData.referencePhotoPath) {
      storyData.referencePhotoUrl = await signedAssetUrl(storyData.referencePhotoPath);
    }
    storyData.pages = await Promise.all((storyData.pages || []).map(async (page) => ({
      ...page,
      imageUrl: page.imagePath ? await signedAssetUrl(page.imagePath) : ''
    })));
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      title: row.title,
      childName: row.child_name,
      coverImageUrl: storyData.coverImageUrl || '',
      form: row.form_data || {},
      story: storyData
    };
  }

  async function uploadStoryAsset(path, dataUrl) {
    if (!dataUrl?.startsWith('data:image')) return path || '';
    const blob = await dataUrlToBlob(dataUrl);
    const { error: uploadError } = await supabase.storage.from('story-assets').upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'image/png',
      cacheControl: '3600'
    });
    if (uploadError) throw uploadError;
    return path;
  }

  async function saveRecordToCloud({ id, story: sourceStory, form: sourceForm, createdAt }) {
    const now = new Date().toISOString();
    const cloudStory = structuredClone(sourceStory);
    const basePath = `${user.id}/${id}`;

    if (cloudStory.coverImageUrl?.startsWith('data:image')) {
      cloudStory.coverImagePath = await uploadStoryAsset(`${basePath}/cover.png`, cloudStory.coverImageUrl);
    }
    cloudStory.coverImageUrl = '';

    const referenceSource = cloudStory.referencePhotoUrl || referencePhoto;
    if (referenceSource?.startsWith('data:image')) {
      cloudStory.referencePhotoPath = await uploadStoryAsset(`${basePath}/reference-child.jpg`, referenceSource);
    }
    cloudStory.referencePhotoUrl = '';

    cloudStory.pages = await Promise.all((cloudStory.pages || []).map(async (page, index) => {
      const next = { ...page };
      if (next.imageUrl?.startsWith('data:image')) {
        next.imagePath = await uploadStoryAsset(`${basePath}/page-${index + 1}.png`, next.imageUrl);
      }
      next.imageUrl = '';
      return next;
    }));

    const { error: saveError } = await supabase.from('stories').upsert({
      id,
      user_id: user.id,
      title: cloudStory.title,
      child_name: cloudStory.characterBible?.name || sourceForm.childName || '',
      cover_path: cloudStory.coverImagePath || null,
      form_data: sourceForm,
      story_data: cloudStory,
      created_at: createdAt || now,
      updated_at: now
    }, { onConflict: 'id' });
    if (saveError) throw saveError;
    return { id, now, cloudStory };
  }


  async function autosaveStorySnapshot(nextStory, options = {}) {
    if (!nextStory) return null;
    const id = options.id || storyId || crypto.randomUUID();
    const createdAt = nextStory.createdAt || new Date().toISOString();
    const snapshot = {
      ...nextStory,
      createdAt,
      generationStatus: options.status || nextStory.generationStatus || 'draft',
      generationId: nextStory.generationId || options.generationId || ''
    };

    setStoryId(id);
    if (!supabaseConfigured) {
      await putSavedStory({
        id,
        createdAt,
        updatedAt: new Date().toISOString(),
        title: snapshot.title || `A story for ${form.childName || 'your child'}`,
        childName: snapshot.characterBible?.name || form.childName || '',
        coverImageUrl: snapshot.coverImageUrl || '',
        form,
        story: snapshot
      });
      return id;
    }
    if (!user || autosaveBusyRef.current) return id;
    autosaveBusyRef.current = true;
    try {
      await saveRecordToCloud({ id, story: snapshot, form, createdAt });
      if (!options.silent) {
        setSaveMessage(options.message || 'Saved automatically');
        window.setTimeout(() => setSaveMessage(''), 1800);
      }
      return id;
    } finally {
      autosaveBusyRef.current = false;
    }
  }

  function scheduleStoryAutosave(nextStory, delay = 900) {
    if (!nextStory || !storyId) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveStorySnapshot(nextStory, { id: storyId, status: nextStory.generationStatus || 'draft', silent: true })
        .catch((autosaveError) => console.warn('AMI autosave failed:', autosaveError));
    }, delay);
  }

  async function importLocalStories() {
    if (!user || !supabaseConfigured) return;
    setImportingStories(true);
    setError('');
    try {
      const localStories = await getSavedStories();
      for (const record of localStories) {
        await saveRecordToCloud({
          id: record.id || crypto.randomUUID(),
          story: record.story,
          form: record.form || emptyForm,
          createdAt: record.createdAt
        });
      }
      setLocalImportCount(0);
      await refreshLibrary();
      setSaveMessage(`${localStories.length} local ${localStories.length === 1 ? 'story' : 'stories'} added to your account`);
    } catch (err) {
      console.error(err);
      setError('AMI could not import every local story. Your originals are still safe in this browser.');
    } finally {
      setImportingStories(false);
    }
  }

  function selectStoryMode(mode) {
    setForm((current) => ({
      ...current,
      storyMode: mode,
      storyIdea: '',
      ...(mode === 'Fun'
        ? { challenge: '', emotionalOutcome: '', theme: current.theme || 'Adventure' }
        : { challenge: current.challenge || 'Giving up the pacifier', emotionalOutcome: current.emotionalOutcome || 'Brave' })
    }));
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function analyzeReferencePhoto(photoData = referencePhoto) {
    if (!photoData) return null;
    setPhotoAnalyzing(true);
    try {
      const response = await authenticatedFetch('/api/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: photoData, childName: form.childName, age: form.age })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Photo analysis failed.');
      setReferencePhotoAnalysis(data.profile);
      return data.profile;
    } finally {
      setPhotoAnalyzing(false);
    }
  }

  async function handleReferencePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const prepared = await prepareReferencePhoto(file);
      setReferencePhoto(prepared);
      setReferencePhotoAnalysis(null);
      await analyzeReferencePhoto(prepared);
    } catch (photoError) {
      setError(photoError.message || 'AMI could not use that photo.');
    } finally {
      event.target.value = '';
    }
  }

  function removeReferencePhoto() {
    setReferencePhoto('');
    setReferencePhotoAnalysis(null);
  }

  function illustrationQualityFor(productType, style, kind) {
    if (productType === 'mini') return 'low';
    return 'medium';
  }

  async function requestStoryIllustration({ activeStory, activeStoryId, kind = 'page', page, anchorImage = '', priorScene = '', operation }) {
    const response = await authenticatedFetch('/api/illustrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        storyTitle: activeStory.title,
        style: activeStory.style || form.style,
        characterBible: activeStory.characterBible,
        continuityBible: activeStory.continuityBible || {},
        referencePhoto: activeStory.referencePhotoUrl || referencePhoto || '',
        referencePhotoAnalysis: activeStory.referencePhotoAnalysis || referencePhotoAnalysis,
        anchorImage,
        childAge: activeStory.childAge || form.age,
        childPronouns: activeStory.childPronouns || form.pronouns,
        priorScene,
        page,
        storyId: activeStoryId,
        productType: activeStory.productType || 'full',
        quality: illustrationQualityFor(activeStory.productType, activeStory.style || form.style, kind),
        operation: operation || (kind === 'cover' ? 'cover_generation' : 'page_generation')
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Image generation failed.');
    return data.imageUrl;
  }

  async function illustrateStoryOneClick(activeStory, activeStoryId) {
    if (!activeStory?.pages?.length) return activeStory;
    setStep('review');
    setGeneratingAll(true);
    setEngagementCardIndex(0);
    setGenerationAllProgress({ current: 0, total: activeStory.pages.length + 1 });
    setLoadingMessage('Creating the visual anchor…');
    setError('');
    let workingStory = { ...activeStory, generationStatus: 'illustrating' };
    try {
      if (workingStory.engagementPack?.length) setEngagementCards(workingStory.engagementPack);
      else generateEngagementPack(workingStory, activeStoryId).catch(() => {});

      if (!workingStory.coverImageUrl) {
        const coverImageUrl = await requestStoryIllustration({
          activeStory: workingStory,
          activeStoryId,
          kind: 'cover',
          page: { coverPrompt: workingStory.coverPrompt || workingStory.pages?.[0]?.illustrationPrompt },
          operation: 'cover_anchor_generation'
        });
        workingStory = { ...workingStory, coverImageUrl };
        setStory(workingStory);
        setGenerationAllProgress({ current: 1, total: workingStory.pages.length + 1 });
        await autosaveStorySnapshot(workingStory, { id: activeStoryId, status: 'illustrating', silent: true });
      }

      const anchorImage = workingStory.coverImageUrl || '';
      const remaining = workingStory.pages.map((page, index) => ({ page, index })).filter(({ page }) => !page.imageUrl);
      const batchSize = workingStory.productType === 'mini' ? 3 : 5;
      let completed = workingStory.pages.filter((page) => page.imageUrl).length;

      for (let start = 0; start < remaining.length; start += batchSize) {
        const batch = remaining.slice(start, start + batchSize);
        setLoadingMessage(`Illustrating ${batch.length} pages together…`);
        const settled = await Promise.allSettled(batch.map(async ({ page, index }) => ({
          index,
          imageUrl: await requestStoryIllustration({
            activeStory: workingStory,
            activeStoryId,
            page,
            anchorImage,
            priorScene: index > 0 ? workingStory.pages[index - 1]?.illustrationPrompt || '' : '',
            operation: 'page_generation'
          })
        })));
        const results = settled.filter((result) => result.status === 'fulfilled').map((result) => result.value);
        const failed = settled.map((result, index) => result.status === 'rejected' ? batch[index] : null).filter(Boolean);
        if (failed.length) {
          setLoadingMessage(`Retrying ${failed.length} page${failed.length === 1 ? '' : 's'} that need another pass…`);
          const retries = await Promise.allSettled(failed.map(async ({ page, index }) => ({
            index,
            imageUrl: await requestStoryIllustration({
              activeStory: workingStory,
              activeStoryId,
              page,
              anchorImage,
              priorScene: index > 0 ? workingStory.pages[index - 1]?.illustrationPrompt || '' : '',
              operation: 'page_generation_retry'
            })
          })));
          results.push(...retries.filter((result) => result.status === 'fulfilled').map((result) => result.value));
        }
        if (!results.length) throw new Error('AMI could not finish this group of illustrations. The completed pages are saved; please continue the book from Review.');
        const pageMap = new Map(results.map((result) => [result.index, result.imageUrl]));
        workingStory = {
          ...workingStory,
          pages: workingStory.pages.map((page, index) => pageMap.has(index) ? { ...page, imageUrl: pageMap.get(index) } : page)
        };
        completed += results.length;
        setStory(workingStory);
        setGenerationAllProgress({ current: completed + 1, total: workingStory.pages.length + 1 });
        await autosaveStorySnapshot(workingStory, { id: activeStoryId, status: 'illustrating', silent: true });
      }

      workingStory = { ...workingStory, generationStatus: 'complete' };
      setStory(workingStory);
      await autosaveStorySnapshot(workingStory, { id: activeStoryId, status: 'complete', message: 'Book saved automatically' });
      await refreshLibrary();
      if (workingStory.productType === 'mini') {
        window.setTimeout(() => document.getElementById('ami-mini-complete')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      }
      return workingStory;
    } catch (pipelineError) {
      setStory(workingStory);
      await autosaveStorySnapshot(workingStory, { id: activeStoryId, status: 'illustrating', silent: true }).catch(() => {});
      throw pipelineError;
    } finally {
      setGeneratingAll(false);
      setGenerationAllProgress({ current: 0, total: 0 });
      setLoadingMessage('');
    }
  }

  async function generateStory(event) {
    event.preventDefault();
    if (supabaseConfigured && !user) {
      requestSignIn('Create a free AMI account before generating so this story can stay on your shelf.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const activePhotoAnalysis = referencePhoto
        ? (referencePhotoAnalysis || await analyzeReferencePhoto(referencePhoto))
        : null;
      const normalizedForm = form.productType === 'mini' ? { ...form, length: '3' } : form;
      const generationInput = normalizedForm.storyMode === 'Fun'
        ? {
            ...normalizedForm,
            challenge: '',
            emotionalOutcome: '',
            storyMode: 'Fun',
            referencePhotoAnalysis: activePhotoAnalysis
          }
        : {
            ...normalizedForm,
            storyMode: 'Challenge',
            referencePhotoAnalysis: activePhotoAnalysis
          };

      const persistentStoryId = storyId || crypto.randomUUID();
      setStoryId(persistentStoryId);
      const startingStory = {
        title: `Creating a story for ${form.childName || 'your child'}…`,
        summary: 'AMI is writing this story now.',
        pages: [],
        characterBible: { name: form.childName || '', description: '', lockedWardrobe: '', visualAnchor: '' },
        language: generationInput.language || 'en',
        dedication: generationInput.dedication || '',
        referencePhotoUrl: referencePhoto || '',
        referencePhotoAnalysis: activePhotoAnalysis,
        childAge: generationInput.age,
        childPronouns: generationInput.pronouns,
        style: normalizeAmiStyle(generationInput.style),
        createdAt: new Date().toISOString(),
        generationStatus: 'writing',
        productType: generationInput.productType === 'mini' ? 'mini' : 'full',
        printEligible: generationInput.productType !== 'mini',
        regenerationsAllowed: generationInput.productType !== 'mini'
      };
      setStory(startingStory);
      await autosaveStorySnapshot(startingStory, { id: persistentStoryId, status: 'writing', silent: true });

      const response = await authenticatedFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...generationInput, generationId: persistentStoryId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Story generation failed.');
      await refreshBillingStatus();
      const generatedStory = decodeStoryEntities({
        ...data,
        language: generationInput.language || 'en',
        dedication: generationInput.dedication || '',
        referencePhotoUrl: referencePhoto || '',
        referencePhotoAnalysis: activePhotoAnalysis,
        childAge: generationInput.age,
        childPronouns: generationInput.pronouns,
        style: normalizeAmiStyle(generationInput.style),
        createdAt: startingStory.createdAt,
        generationId: data.billing?.generationId || persistentStoryId,
        generationStatus: 'manuscript_ready'
      });
      setStory(generatedStory);
      await autosaveStorySnapshot(generatedStory, { id: persistentStoryId, status: 'manuscript_ready', message: 'Story written and saved' });
      setEngagementAnswers({});
      setSurpriseMessage('');
      setEngagementCards(fallbackEngagementCards);
      setPageIndex(0);
      const completedStory = await illustrateStoryOneClick(generatedStory, persistentStoryId);
      setStory(completedStory);
      refreshReferralStatus();
      window.localStorage.removeItem(AMI_DRAFT_KEY);
      setDraftMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  function updatePage(index, value) {
    setStory((current) => {
      const nextStory = {
        ...current,
        generationStatus: current.generationStatus === 'complete' ? 'complete' : 'manuscript_ready',
        pages: current.pages.map((page, i) => i === index ? { ...page, text: value } : page)
      };
      scheduleStoryAutosave(nextStory);
      return nextStory;
    });
  }

  async function generateImageForPage(index) {
    const page = story?.pages?.[index];
    if (!page || imageLoading[index]) return;
    if (story?.productType === 'mini' && page.imageUrl) { setError('AMI Mini Stories include one illustration per page and do not include regenerations.'); return; }

    setImageLoading((current) => ({ ...current, [index]: true }));
    setImageLoadingMessage((current) => ({ ...current, [index]: imageLoadingMessages[0] }));
    setError('');
    let messageIndex = 0;
    const messageTimer = setInterval(() => {
      messageIndex = Math.min(messageIndex + 1, imageLoadingMessages.length - 1);
      setImageLoadingMessage((current) => ({ ...current, [index]: imageLoadingMessages[messageIndex] }));
    }, 4500);
    try {
      const response = await authenticatedFetch('/api/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyTitle: story.title,
          style: story.style || form.style,
          characterBible: story.characterBible,
          continuityBible: story.continuityBible || {},
          anchorImage: story.coverImageUrl || '',
          priorScene: index > 0 ? story.pages[index - 1]?.illustrationPrompt || '' : '',
          productType: story.productType || 'full',
          quality: illustrationQualityFor(story.productType),
          referencePhoto: story.referencePhotoUrl || referencePhoto || '',
          referencePhotoAnalysis: story.referencePhotoAnalysis || referencePhotoAnalysis,
          childAge: story.childAge || form.age,
          childPronouns: story.childPronouns || form.pronouns,
          page,
          storyId,
          operation: page.imageUrl ? 'page_regeneration' : 'page_generation'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image generation failed.');
      let nextStory;
      setStory((current) => {
        nextStory = {
          ...current,
          generationStatus: 'illustrating',
          pages: current.pages.map((item, i) => i === index ? { ...item, imageUrl: data.imageUrl } : item)
        };
        return nextStory;
      });
      if (nextStory) await autosaveStorySnapshot(nextStory, { id: storyId, status: 'illustrating', silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(messageTimer);
      setImageLoading((current) => ({ ...current, [index]: false }));
      setImageLoadingMessage((current) => ({ ...current, [index]: '' }));
    }
  }

  async function generateCover() {
    if (!story || coverLoading) return;
    if (story?.productType === 'mini' && story.coverImageUrl) { setError('AMI Mini Stories include one cover and do not include regenerations.'); return; }
    setCoverLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'cover',
          storyTitle: story.title,
          style: story.style || form.style,
          characterBible: story.characterBible,
          continuityBible: story.continuityBible || {},
          productType: story.productType || 'full',
          quality: illustrationQualityFor(story.productType),
          referencePhoto: story.referencePhotoUrl || referencePhoto || '',
          referencePhotoAnalysis: story.referencePhotoAnalysis || referencePhotoAnalysis,
          childAge: story.childAge || form.age,
          childPronouns: story.childPronouns || form.pronouns,
          page: { coverPrompt: story.coverPrompt || story.pages?.[0]?.illustrationPrompt },
          storyId,
          operation: story.coverImageUrl ? 'cover_regeneration' : 'cover_generation'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cover generation failed.');
      let nextStory;
      setStory((current) => {
        nextStory = { ...current, coverImageUrl: data.imageUrl, generationStatus: 'illustrating' };
        return nextStory;
      });
      if (nextStory) await autosaveStorySnapshot(nextStory, { id: storyId, status: 'illustrating', silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCoverLoading(false);
    }
  }

  function readEngagementHistory() {
    if (typeof window === 'undefined') return { cardIds: [], factIds: [] };
    try {
      const parsed = JSON.parse(window.localStorage.getItem(AMI_ENGAGEMENT_HISTORY_KEY) || '{}');
      return {
        cardIds: Array.isArray(parsed.cardIds) ? parsed.cardIds.slice(-80) : [],
        factIds: Array.isArray(parsed.factIds) ? parsed.factIds.slice(-80) : []
      };
    } catch {
      return { cardIds: [], factIds: [] };
    }
  }

  function rememberEngagementCards(cards) {
    if (typeof window === 'undefined' || !Array.isArray(cards)) return;
    try {
      const history = readEngagementHistory();
      const nextCardIds = [...history.cardIds, ...cards.map((card) => card.id).filter(Boolean)].slice(-80);
      const nextFactIds = [...history.factIds, ...cards.map((card) => card.sourceFactId).filter(Boolean)].slice(-80);
      window.localStorage.setItem(AMI_ENGAGEMENT_HISTORY_KEY, JSON.stringify({ cardIds: [...new Set(nextCardIds)], factIds: [...new Set(nextFactIds)] }));
    } catch (historyError) {
      console.warn('AMI could not remember engagement history:', historyError);
    }
  }

  async function generateEngagementPack(activeStory = story, activeStoryId = storyId) {
    if (!activeStory?.title || engagementPackLoading) return;
    const packKey = `${activeStoryId || ''}:${activeStory.title}`;
    if (engagementPackStoryRef.current === packKey && activeStory.engagementPack?.length) return;
    engagementPackStoryRef.current = packKey;
    setEngagementPackLoading(true);
    try {
      const history = readEngagementHistory();
      const firstPrompt = activeStory.pages?.[0]?.illustrationPrompt || '';
      const response = await authenticatedFetch('/api/engagement-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: activeStoryId,
          childName: activeStory.characterBible?.name || form.childName,
          age: form.age,
          title: activeStory.title,
          summary: activeStory.summary,
          theme: form.theme,
          challenge: form.challenge,
          favorites: form.favorites,
          setting: firstPrompt,
          characters: activeStory.characterBible?.description,
          recentCardIds: history.cardIds,
          recentFactIds: history.factIds
        })
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.cards) || data.cards.length < 4) throw new Error(data.error || 'Engagement pack unavailable.');
      setEngagementCards(data.cards);
      setEngagementCardIndex(0);
      rememberEngagementCards(data.cards);
      setStory((current) => {
        if (!current) return current;
        const nextStory = { ...current, engagementPack: data.cards };
        scheduleStoryAutosave(nextStory);
        return nextStory;
      });
    } catch (packError) {
      console.warn('AMI dynamic engagement pack fell back to curated defaults:', packError);
      setEngagementCards(fallbackEngagementCards);
    } finally {
      setEngagementPackLoading(false);
    }
  }

  async function answerEngagementCard(value) {
    const card = engagementCards[engagementCardIndex % engagementCards.length];
    const answer = typeof value === 'string' ? value.trim() : '';
    if (!answer) return;
    const answerKey = card.id || String(engagementCardIndex);
    const nextAnswers = { ...engagementAnswers, [answerKey]: { cardId: card.id || null, type: card.type, prompt: card.question || card.fact, answer } };
    setEngagementAnswers(nextAnswers);
    setStory((current) => {
      if (!current) return current;
      const nextStory = { ...current, engagementAnswers: nextAnswers };
      scheduleStoryAutosave(nextStory);
      return nextStory;
    });
    if (Object.keys(nextAnswers).length === 3 && storyId) {
      try {
        const response = await authenticatedFetch('/api/rewards/engagement', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId, answerCount: 3 })
        });
        const data = await response.json();
        if (response.ok && data.granted) setSurpriseMessage(data.message || 'A little surprise from AMI.');
      } catch (rewardError) {
        console.warn('AMI surprise could not be granted:', rewardError);
      }
    }
    setEngagementCardIndex((current) => (current + 1) % engagementCards.length);
  }

  function skipEngagementCard() {
    setEngagementCardIndex((current) => (current + 1) % engagementCards.length);
  }

  async function generateAllImages() {
    if (!story?.pages?.length || generatingAll) return;
    try {
      await illustrateStoryOneClick(story, storyId);
    } catch (err) {
      setError(err.message || 'AMI could not finish every illustration. Your completed pages are safely saved, and you can continue from here.');
    }
  }

  async function refreshLibrary() {
    setLibraryLoading(true);
    setError('');
    try {
      if (supabaseConfigured) {
        if (!user) {
          setSavedStories([]);
          return;
        }
        const { data, error: libraryError } = await supabase
          .from('stories')
          .select('*')
          .order('updated_at', { ascending: false });
        if (libraryError) throw libraryError;
        setSavedStories(await Promise.all((data || []).map(hydrateCloudRecord)));
      } else {
        setSavedStories(await getSavedStories());
      }
    } catch (err) {
      console.error(err);
      setError('AMI could not open your story shelf. Check the Supabase setup and try again.');
    } finally {
      setLibraryLoading(false);
    }
  }

  async function openLibrary() {
    if (supabaseConfigured && !user) {
      requestSignIn('Sign in to open your AMI story shelf.');
      return;
    }
    setStep('library');
    await refreshLibrary();
  }

  async function saveToLibrary() {
    if (!story) return;
    if (supabaseConfigured && !user) {
      requestSignIn('Sign in to save this story to your AMI shelf.');
      return;
    }
    setError('');
    setSaveMessage('Saving…');
    try {
      const id = storyId || crypto.randomUUID();
      const now = new Date().toISOString();
      if (supabaseConfigured) {
        await saveRecordToCloud({ id, story: { ...story, generationStatus: story.coverImageUrl && story.pages?.every((page) => page.imageUrl) ? 'complete' : (story.generationStatus || 'draft') }, form, createdAt: story.createdAt || now });
      } else {
        await putSavedStory({
          id,
          createdAt: story.createdAt || now,
          updatedAt: now,
          title: story.title,
          childName: story.characterBible?.name || form.childName,
          coverImageUrl: story.coverImageUrl || '',
          form,
          story: { ...story, createdAt: story.createdAt || now }
        });
      }
      setStoryId(id);
      setStory((current) => ({ ...current, createdAt: current.createdAt || now }));
      setSaveMessage(supabaseConfigured ? 'Saved to your cloud shelf' : 'Saved to My Stories');
      window.setTimeout(() => setSaveMessage(''), 2400);
    } catch (err) {
      console.error(err);
      setError('AMI could not save this story. Check your connection and Supabase policies, then try again.');
      setSaveMessage('');
    }
  }

  function loadSavedStory(record, targetStep = 'review') {
    const decodedStory = decodeStoryEntities(record.story);
    setStory(decodedStory);
    setEngagementCards(decodedStory?.engagementPack?.length ? decodedStory.engagementPack : fallbackEngagementCards);
    setEngagementAnswers(decodedStory?.engagementAnswers || {});
    setEngagementCardIndex(0);
    setForm({ ...emptyForm, ...(record.form || {}) });
    setReferencePhoto(record.story?.referencePhotoUrl || '');
    setReferencePhotoAnalysis(record.story?.referencePhotoAnalysis || null);
    setStoryId(record.id);
    setPageIndex(0);
    setStep(targetStep);
    setError('');
  }

  async function deleteSavedStory(id) {
    if (!window.confirm('Remove this story from your AMI shelf?')) return;
    if (supabaseConfigured) {
      const prefix = `${user.id}/${id}`;
      const { data: assets } = await supabase.storage.from('story-assets').list(prefix);
      if (assets?.length) {
        await supabase.storage.from('story-assets').remove(assets.map((asset) => `${prefix}/${asset.name}`));
      }
      const { error: deleteError } = await supabase.from('stories').delete().eq('id', id);
      if (deleteError) setError('AMI could not delete that story.');
    } else {
      await removeSavedStory(id);
    }
    await refreshLibrary();
  }

  async function printStory() {
    if (!story) return;

    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      setError('Your browser blocked the PDF window. Allow pop-ups for AMI and try again.');
      return;
    }

    previewWindow.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparing PDF…</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#171229;color:#fff;font:600 16px system-ui}div{text-align:center;padding:28px}.dot{display:inline-block;animation:pulse 1s infinite alternate}@keyframes pulse{to{opacity:.35}}</style></head><body><div>Preparing your storybook PDF<span class="dot">…</span></div></body></html>`);
    previewWindow.document.close();

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter', compress: true });
      const PAGE_W = 612;
      const PAGE_H = 792;
      const SAFE = 36;

      const fetchDataUrl = async (url) => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      const drawCoverImage = (dataUrl, x, y, width, height) => {
        const props = pdf.getImageProperties(dataUrl);
        const sourceRatio = props.width / props.height;
        const frameRatio = width / height;
        let drawW;
        let drawH;
        let drawX;
        let drawY;
        if (sourceRatio > frameRatio) {
          drawH = height;
          drawW = height * sourceRatio;
          drawX = x - (drawW - width) / 2;
          drawY = y;
        } else {
          drawW = width;
          drawH = width / sourceRatio;
          drawX = x;
          drawY = y - (drawH - height) / 2;
        }
        pdf.addImage(dataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
      };

      const drawContainedImage = (dataUrl, x, y, width, height) => {
        const props = pdf.getImageProperties(dataUrl);
        const ratio = Math.min(width / props.width, height / props.height);
        const drawW = props.width * ratio;
        const drawH = props.height * ratio;
        pdf.addImage(dataUrl, 'JPEG', x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH, undefined, 'FAST');
      };

      // Cover page
      pdf.setFillColor(23, 18, 41);
      pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
      let coverData = null;
      try { coverData = await fetchDataUrl(story.coverImageUrl); } catch (imageError) { console.warn('Cover image could not be loaded for PDF:', imageError); }
      if (coverData) {
        drawCoverImage(coverData, 0, 0, PAGE_W, PAGE_H);
        pdf.setFillColor(23, 18, 41);
        pdf.rect(0, PAGE_H * 0.62, PAGE_W, PAGE_H * 0.38, 'F');
      } else {
        pdf.setFillColor(91, 75, 159);
        pdf.circle(PAGE_W / 2, 245, 110, 'F');
      }

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.8);
      pdf.text('A STORY BY AMI', SAFE + 8, 590);
      pdf.setCharSpace(0);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(31);
      const titleLines = pdf.splitTextToSize(decodeHtmlEntities(story.title || 'AMI Story'), PAGE_W - (SAFE + 8) * 2);
      pdf.text(titleLines, SAFE + 8, 625, { lineHeightFactor: 1.03 });
      const titleBottom = 625 + titleLines.length * 32;
      if (story.summary) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10.5);
        pdf.setTextColor(238, 234, 247);
        const summaryLines = pdf.splitTextToSize(decodeHtmlEntities(story.summary), PAGE_W - (SAFE + 8) * 2);
        pdf.text(summaryLines.slice(0, 4), SAFE + 8, Math.min(titleBottom + 10, 742), { lineHeightFactor: 1.35 });
      }

      const dedication = decodeHtmlEntities(story.dedication || form.dedication || '');
      if (dedication) {
        pdf.addPage('letter', 'portrait');
        pdf.setFillColor(255, 252, 246);
        pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
        pdf.setTextColor(111, 97, 170);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setCharSpace(1.4);
        pdf.text('CREATED ESPECIALLY FOR YOU', PAGE_W / 2, 300, { align: 'center' });
        pdf.setCharSpace(0);
        pdf.setTextColor(48, 41, 70);
        pdf.setFont('times', 'italic');
        pdf.setFontSize(20);
        const dedicationLines = pdf.splitTextToSize(dedication, PAGE_W - 150);
        pdf.text(dedicationLines.slice(0, 8), PAGE_W / 2, 350, { align: 'center', lineHeightFactor: 1.45 });
        pdf.setTextColor(111, 97, 170);
        pdf.setFont('times', 'normal');
        pdf.setFontSize(26);
        pdf.text('M', PAGE_W / 2, 505, { align: 'center' });
      }

      // Interior pages: one explicit PDF page each — no browser pagination involved.
      for (let index = 0; index < story.pages.length; index += 1) {
        const page = story.pages[index];
        pdf.addPage('letter', 'portrait');
        pdf.setFillColor(255, 252, 246);
        pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');

        const artX = SAFE;
        const artY = SAFE;
        const artW = PAGE_W - SAFE * 2;
        const artH = 500;
        pdf.setFillColor(239, 234, 247);
        pdf.roundedRect(artX, artY, artW, artH, 10, 10, 'F');

        let pageData = null;
        try { pageData = await fetchDataUrl(page.imageUrl); } catch (imageError) { console.warn(`Page ${index + 1} image could not be loaded for PDF:`, imageError); }
        if (pageData) {
          drawContainedImage(pageData, artX + 8, artY + 8, artW - 16, artH - 16);
        } else {
          pdf.setTextColor(113, 104, 135);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.text('Illustration not generated', PAGE_W / 2, artY + artH / 2, { align: 'center' });
        }

        pdf.setTextColor(111, 97, 170);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setCharSpace(1.2);
        pdf.text(`${String(decodeHtmlEntities(story.title || '')).toUpperCase()} · ${index + 1}`, PAGE_W / 2, 566, { align: 'center', maxWidth: PAGE_W - 96 });
        pdf.setCharSpace(0);

        pdf.setTextColor(39, 33, 59);
        pdf.setFont('times', 'normal');
        pdf.setFontSize(14);
        const storyLines = pdf.splitTextToSize(decodeHtmlEntities(page.text || ''), PAGE_W - 104);
        const maxLines = 10;
        const visibleLines = storyLines.slice(0, maxLines);
        const lineHeight = 19;
        const blockHeight = visibleLines.length * lineHeight;
        const textY = Math.max(606, 650 - blockHeight / 2);
        pdf.text(visibleLines, PAGE_W / 2, textY, { align: 'center', lineHeightFactor: 1.35, maxWidth: PAGE_W - 104 });
      }

      for (let pageNumber = 1; pageNumber <= pdf.getNumberOfPages(); pageNumber += 1) {
        pdf.setPage(pageNumber);
        pdf.setTextColor(120, 112, 136);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.text('Created with AMI', PAGE_W / 2, PAGE_H - 14, { align: 'center' });
      }

      const safeName = String(decodeHtmlEntities(story.title || 'ami-story'))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'ami-story';
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      previewWindow.location.replace(blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (pdfError) {
      console.error(pdfError);
      previewWindow.close();
      setError(`We could not create the PDF: ${pdfError.message || 'Unknown error'}`);
    }
  }


  async function exportKeepsakePdf() {
    if (!story || keepsakeExporting) return;
    setKeepsakeExporting(true);
    setError('');

    try {
      const { jsPDF } = await import('jspdf');
      const PAGE = 630; // 8.75 inches at 72 pt/in: 8.5x8.5 trim plus 0.125in bleed on every edge.
      const BLEED = 9; // 0.125 in on each edge.
      const TRIM = 612; // 8.5 in at 72 pt/in.
      const FRAME_INSET_FROM_TRIM = 45;
      const FRAME_SIZE = TRIM - FRAME_INSET_FROM_TRIM * 2;
      const SAFE = 54;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE, PAGE], compress: true });
      const PAGE_W = pdf.internal.pageSize.getWidth();
      const PAGE_H = pdf.internal.pageSize.getHeight();
      const PAGE_CENTER = PAGE_W / 2;
      const FRAME_X = (PAGE_W - FRAME_SIZE) / 2;
      const FRAME_Y = (PAGE_H - FRAME_SIZE) / 2;

      const fetchDataUrl = async (url) => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      const drawCoverCrop = (dataUrl, x, y, width, height) => {
        const props = pdf.getImageProperties(dataUrl);
        const sourceRatio = props.width / props.height;
        const frameRatio = width / height;
        let drawW = width;
        let drawH = height;
        let drawX = x;
        let drawY = y;
        if (sourceRatio > frameRatio) {
          drawH = height;
          drawW = height * sourceRatio;
          drawX = x - (drawW - width) / 2;
        } else {
          drawW = width;
          drawH = width / sourceRatio;
          drawY = y - (drawH - height) / 2;
        }
        pdf.addImage(dataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
      };

      const addPaper = () => {
        pdf.setFillColor(255, 252, 246);
        pdf.rect(0, 0, PAGE, PAGE, 'F');
      };

      const addEditorialOrnament = (y, width = 52) => {
        pdf.setDrawColor(178, 163, 211);
        pdf.setLineWidth(0.8);
        pdf.line(PAGE_CENTER - width / 2, y, PAGE_CENTER - 8, y);
        pdf.line(PAGE_CENTER + 8, y, PAGE_CENTER + width / 2, y);
        pdf.setFillColor(111, 97, 170);
        pdf.circle(PAGE_CENTER, y, 2.4, 'F');
      };

      const addPage = () => {
        pdf.addPage([PAGE, PAGE], 'portrait');
        addPaper();
      };

      const keepsakeName = story.characterBible?.name || form.childName || 'You';

      // Interior page 1: designed half-title page.
      addPaper();
      pdf.setDrawColor(222, 213, 235);
      pdf.setLineWidth(1);
      pdf.roundedRect(FRAME_X, FRAME_Y, FRAME_SIZE, FRAME_SIZE, 12, 12, 'S');
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.7);
      pdf.text('A KEEPSAKE BY AMI', PAGE_CENTER, 142, { align: 'center' });
      pdf.setCharSpace(0);
      addEditorialOrnament(168, 66);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(30);
      const titleLines = pdf.splitTextToSize(decodeHtmlEntities(story.title || 'AMI Story'), PAGE - 126);
      pdf.text(titleLines, PAGE_CENTER, 222, { align: 'center', lineHeightFactor: 1.08 });
      const titleBottom = 222 + titleLines.length * 32;
      pdf.setTextColor(99, 89, 122);
      pdf.setFont('times', 'italic');
      pdf.setFontSize(13);
      pdf.text(`A personalized story for ${keepsakeName}`, PAGE_CENTER, Math.min(titleBottom + 42, 430), { align: 'center' });
      addEditorialOrnament(480, 42);

      // Interior page 2: dedication / ownership page.
      addPage();
      pdf.setDrawColor(222, 213, 235);
      pdf.setLineWidth(1);
      pdf.roundedRect(FRAME_X, FRAME_Y, FRAME_SIZE, FRAME_SIZE, 12, 12, 'S');
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.5);
      pdf.text('THIS STORY WAS CREATED ESPECIALLY FOR', PAGE_CENTER, 142, { align: 'center' });
      pdf.setCharSpace(0);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(31);
      pdf.text(keepsakeName, PAGE_CENTER, 202, { align: 'center' });
      addEditorialOrnament(230, 54);
      const dedication = decodeHtmlEntities(story.dedication || form.dedication || '');
      pdf.setTextColor(76, 68, 94);
      pdf.setFont('times', 'italic');
      pdf.setFontSize(dedication ? 17 : 15);
      const dedicationCopy = dedication || 'May this story always remind you how deeply you are known and loved.';
      const lines = pdf.splitTextToSize(dedicationCopy, PAGE - 164);
      pdf.text(lines.slice(0, 9), PAGE_CENTER, 300, { align: 'center', lineHeightFactor: 1.48 });
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setCharSpace(1.2);
      pdf.text('ONE CHILD · ONE STORY · MADE JUST FOR THEM', PAGE_CENTER, 472, { align: 'center' });
      pdf.setCharSpace(0);

      // Each scene becomes a true picture-book spread: full-art page followed by a calm text page.
      for (let index = 0; index < story.pages.length; index += 1) {
        const scene = story.pages[index];
        addPage();
        let pageData = null;
        try { pageData = await fetchDataUrl(scene.imageUrl); } catch (imageError) { console.warn(`Keepsake page ${index + 1} image could not be loaded:`, imageError); }
        if (pageData) {
          drawCoverCrop(pageData, 0, 0, PAGE, PAGE);
        } else {
          pdf.setFillColor(239, 234, 247);
          pdf.rect(0, 0, PAGE, PAGE, 'F');
          pdf.setTextColor(98, 89, 122);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(13);
          pdf.text(`Illustration ${index + 1} has not been generated`, PAGE_CENTER, PAGE_CENTER, { align: 'center' });
        }

        addPage();
        pdf.setDrawColor(223, 215, 235);
        pdf.setLineWidth(1);
        pdf.roundedRect(FRAME_X, FRAME_Y, FRAME_SIZE, FRAME_SIZE, 12, 12, 'S');
        pdf.setTextColor(111, 97, 170);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setCharSpace(1.2);
        pdf.text(`${String(decodeHtmlEntities(story.title || '')).toUpperCase()} · ${index + 1}`, PAGE_CENTER, 105, { align: 'center', maxWidth: PAGE - SAFE * 2 });
        pdf.setCharSpace(0);
        pdf.setTextColor(39, 33, 59);
        pdf.setFont('times', 'normal');
        const bilingual = (story.language || form.language) === 'en-es';
        pdf.setFontSize(bilingual ? 15.5 : 18);
        const maxWidth = PAGE - 130;
        const lines = pdf.splitTextToSize(scene.text || '', maxWidth);
        const lineHeight = bilingual ? 22 : 26;
        const blockHeight = Math.min(lines.length, bilingual ? 15 : 12) * lineHeight;
        const startY = Math.max(180, (PAGE - blockHeight) / 2 + 16);
        pdf.text(lines.slice(0, bilingual ? 15 : 12), PAGE_CENTER, startY, { align: 'center', lineHeightFactor: bilingual ? 1.38 : 1.42, maxWidth });
        addEditorialOrnament(500, 38);
      }

      // Closing page.
      addPage();
      pdf.setDrawColor(222, 213, 235);
      pdf.setLineWidth(1);
      pdf.roundedRect(FRAME_X, FRAME_Y, FRAME_SIZE, FRAME_SIZE, 12, 12, 'S');
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.4);
      pdf.text('THE END', PAGE_CENTER, 174, { align: 'center' });
      pdf.setCharSpace(0);
      addEditorialOrnament(204, 54);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'italic');
      pdf.setFontSize(18);
      const takeawayLines = pdf.splitTextToSize(story.takeaway || 'Every story leaves a little light behind.', PAGE - 164);
      pdf.text(takeawayLines.slice(0, 8), PAGE_CENTER, 278, { align: 'center', lineHeightFactor: 1.48 });
      pdf.setTextColor(99, 89, 122);
      pdf.setFont('times', 'normal');
      pdf.setFontSize(12);
      pdf.text(`A story to return to, whenever ${keepsakeName} needs it.`, PAGE_CENTER, 438, { align: 'center' });

      // Customer-facing colophon page.
      addPage();
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.3);
      pdf.text('MADE WITH AMI', PAGE_CENTER, 218, { align: 'center' });
      pdf.setCharSpace(0);
      addEditorialOrnament(244, 46);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(19);
      pdf.text(`Created especially for ${keepsakeName}`, PAGE_CENTER, 294, { align: 'center' });
      pdf.setTextColor(76, 68, 94);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const languageLabel = (story.language || form.language) === 'es' ? 'Español' : (story.language || form.language) === 'en-es' ? 'English + Español' : 'English';
      pdf.text(`Personalized keepsake · ${languageLabel}`, PAGE_CENTER, 326, { align: 'center' });
      pdf.setFont('times', 'italic');
      pdf.setFontSize(12);
      pdf.text('One story, made for one child.', PAGE_CENTER, 374, { align: 'center' });

      // Bound books are assembled in signatures. Normalize to a multiple of four with truly blank pages.
      const totalPages = pdf.getNumberOfPages();
      const normalizedTotal = Math.max(16, Math.ceil(totalPages / 4) * 4);
      while (pdf.getNumberOfPages() < normalizedTotal) {
        addPage();
      }

      const safeName = String(decodeHtmlEntities(story.title || 'ami-story'))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'ami-story';
      pdf.save(`${safeName}-8-5x8-5-lulu-interior.pdf`);
    } catch (pdfError) {
      console.error(pdfError);
      setError(`We could not create the 8.5×8.5 Lulu interior PDF: ${pdfError.message || 'Unknown error'}`);
    } finally {
      setKeepsakeExporting(false);
    }
  }


  async function exportLuluAlignmentProof() {
    try {
      const { jsPDF } = await import('jspdf');
      const PAGE = 630;
      const BLEED = 9;
      const TRIM = 612;
      const FRAME_INSET_FROM_TRIM = 45;
      const FRAME_SIZE = TRIM - FRAME_INSET_FROM_TRIM * 2;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE, PAGE], compress: true });
      const PAGE_W = pdf.internal.pageSize.getWidth();
      const PAGE_H = pdf.internal.pageSize.getHeight();
      const CENTER = PAGE_W / 2;
      const FRAME_X = (PAGE_W - FRAME_SIZE) / 2;
      const FRAME_Y = (PAGE_H - FRAME_SIZE) / 2;

      pdf.setFillColor(255, 252, 246);
      pdf.rect(0, 0, PAGE, PAGE, 'F');

      // Red = final 8.5 x 8.5 trim. The 9 pt outside edge is Lulu bleed.
      pdf.setDrawColor(220, 70, 70);
      pdf.setLineWidth(1);
      pdf.rect((PAGE_W - TRIM) / 2, (PAGE_H - TRIM) / 2, TRIM, TRIM, 'S');

      // Purple = the exact decorative frame used by the exported interior.
      pdf.setDrawColor(111, 97, 170);
      pdf.setLineWidth(1.2);
      pdf.roundedRect(FRAME_X, FRAME_Y, FRAME_SIZE, FRAME_SIZE, 12, 12, 'S');

      // Center axes must intersect at 315 pt, the center of both media and trim boxes.
      pdf.setDrawColor(70, 130, 190);
      pdf.setLineWidth(0.7);
      pdf.line(CENTER, 0, CENTER, PAGE);
      pdf.line(0, CENTER, PAGE, CENTER);

      pdf.setTextColor(39, 33, 59);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('AMI · Lulu interior alignment proof', CENTER, 80, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('Red: 8.5 in trim · Purple: content frame · Blue: exact page center', CENTER, 102, { align: 'center' });
      pdf.text(`Left frame edge: ${FRAME_X} pt`, FRAME_X, CENTER - 12, { align: 'left' });
      pdf.text(`Right frame edge: ${FRAME_X + FRAME_SIZE} pt`, FRAME_X + FRAME_SIZE, CENTER + 18, { align: 'right' });
      pdf.text(`Equal outer margins: ${FRAME_X} pt`, CENTER, CENTER + 44, { align: 'center' });

      pdf.save('stories-by-ami-lulu-alignment-proof.pdf');
    } catch (proofError) {
      console.error(proofError);
      setError(`We could not create the Lulu alignment proof: ${proofError.message || 'Unknown error'}`);
    }
  }


  async function exportWraparoundCoverPdf() {
    if (!story || coverExporting) return;
    setCoverExporting(true);
    setError('');

    try {
      const { jsPDF } = await import('jspdf');
      const totalWidthIn = Number.parseFloat(coverSpec.totalWidth);
      const totalHeightIn = Number.parseFloat(coverSpec.totalHeight);
      const spineWidthIn = Number.parseFloat(coverSpec.spineWidth);
      if (![totalWidthIn, totalHeightIn, spineWidthIn].every(Number.isFinite) || totalWidthIn <= 0 || totalHeightIn <= 0 || spineWidthIn < 0) {
        throw new Error('Enter valid cover-template dimensions before exporting.');
      }

      const W = totalWidthIn * 72;
      const H = totalHeightIn * 72;
      const SPINE = spineWidthIn * 72;
      const PANEL = (W - SPINE) / 2;
      const WRAP_SAFE = 45; // 0.625 in
      const HINGE_SAFE = 18;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [W, H], compress: true });

      const fetchDataUrl = async (url) => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`Cover image request failed (${response.status})`);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      // Required integrated-spread order: back cover, spine, front cover.
      pdf.setFillColor(31, 25, 48);
      pdf.rect(0, 0, W, H, 'F');
      pdf.setFillColor(247, 241, 232);
      pdf.rect(0, 0, PANEL, H, 'F');

      const coverData = await fetchDataUrl(story.coverImageUrl);
      if (coverData) {
        pdf.addImage(coverData, 'JPEG', PANEL + SPINE, 0, PANEL, H, undefined, 'FAST');
        pdf.setFillColor(22, 17, 37);
        pdf.setGState(new pdf.GState({ opacity: 0.58 }));
        pdf.rect(PANEL + SPINE, H * 0.61, PANEL, H * 0.39, 'F');
        pdf.setGState(new pdf.GState({ opacity: 1 }));
      } else {
        pdf.setFillColor(69, 57, 98);
        pdf.rect(PANEL + SPINE, 0, PANEL, H, 'F');
      }

      const frontCenter = PANEL + SPINE + PANEL / 2;
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.6);
      pdf.text('A STORY BY AMI', frontCenter, H * 0.70, { align: 'center' });
      pdf.setCharSpace(0);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(27);
      const titleLines = pdf.splitTextToSize(decodeHtmlEntities(story.title || 'AMI Story'), Math.max(120, PANEL - WRAP_SAFE * 2 - HINGE_SAFE));
      pdf.text(titleLines.slice(0, 4), frontCenter + HINGE_SAFE / 2, H * 0.76, { align: 'center', lineHeightFactor: 1.05 });
      pdf.setFont('times', 'italic');
      pdf.setFontSize(12);
      pdf.text(`Created especially for ${story.characterBible?.name || form.childName || 'you'}`, frontCenter + HINGE_SAFE / 2, H * 0.91, { align: 'center' });

      const backX = WRAP_SAFE;
      const backWidth = Math.max(120, PANEL - WRAP_SAFE * 2 - HINGE_SAFE);
      const backCenter = backX + backWidth / 2;
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.3);
      pdf.text('A ONE-OF-A-KIND KEEPSAKE', backCenter, H * 0.19, { align: 'center' });
      pdf.setCharSpace(0);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(20);
      const backHeadline = `A story shaped around ${story.characterBible?.name || form.childName || 'their'}'s world.`;
      const backHeadlineLines = pdf.splitTextToSize(backHeadline, backWidth);
      pdf.text(backHeadlineLines.slice(0, 3), backCenter, H * 0.25, { align: 'center', lineHeightFactor: 1.08 });
      pdf.setDrawColor(189, 176, 214);
      pdf.setLineWidth(0.8);
      pdf.line(backCenter - 24, H * 0.34, backCenter + 24, H * 0.34);
      pdf.setFont('times', 'normal');
      pdf.setFontSize(12.5);
      const blurb = decodeHtmlEntities(backCoverBlurb || story.summary || 'A personalized AMI keepsake.');
      const blurbLines = pdf.splitTextToSize(blurb, backWidth);
      pdf.text(blurbLines.slice(0, 10), backX, H * 0.40, { align: 'left', lineHeightFactor: 1.38, maxWidth: backWidth });
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setCharSpace(1.1);
      pdf.text('MADE WITH AMI', backX, H * 0.73);
      pdf.setCharSpace(0);

      const barcodeW = 260.784; // 3.622 in
      const barcodeH = 90.72; // 1.26 in
      const barcodeX = PANEL - WRAP_SAFE - barcodeW;
      const barcodeY = H - WRAP_SAFE - barcodeH;
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(barcodeX, barcodeY, barcodeW, barcodeH, 4, 4, 'F');
      pdf.setDrawColor(205, 199, 216);
      pdf.roundedRect(barcodeX, barcodeY, barcodeW, barcodeH, 4, 4, 'S');
      pdf.setTextColor(126, 117, 142);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.text('RESERVED BARCODE AREA', barcodeX + barcodeW / 2, barcodeY + barcodeH / 2 + 2, { align: 'center' });

      if (spineWidthIn >= 0.35) {
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(Math.min(10, Math.max(7, SPINE * 0.34)));
        pdf.text(decodeHtmlEntities(story.title || 'AMI Story').slice(0, 54), PANEL + SPINE / 2, H / 2, { align: 'center', angle: 90, maxWidth: H - WRAP_SAFE * 2 });
      }

      const safeName = String(decodeHtmlEntities(story.title || 'ami-story'))
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ami-story';
      pdf.save(`${safeName}-lulu-casewrap-cover-${totalWidthIn}x${totalHeightIn}.pdf`);
    } catch (coverError) {
      console.error(coverError);
      setError(`We could not create the Lulu casewrap cover PDF: ${coverError.message || 'Unknown error'}`);
    } finally {
      setCoverExporting(false);
    }
  }

  async function copyReferralLink() {
    if (!referralStatus?.referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralStatus.referralUrl);
      setReferralMessage('Referral link copied.');
    } catch {
      setReferralMessage('Copy this link: ' + referralStatus.referralUrl);
    }
  }

  function startFullVersionFromMini() {
    setForm((current) => ({ ...current, productType: 'full', length: current.length === '3' ? '10' : current.length }));
    setStory(null);
    setStoryId(null);
    setStep('create');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  const referralPanel = user ? (
    <section className="ami-referral-hub" id="ami-referrals" aria-label="AMI referrals">
      <div className="ami-referral-hub-icon" aria-hidden="true">✦</div>
      <div className="ami-referral-hub-copy">
        <span>SHARE AMI</span>
        <strong>Give a friend their first Mini Story free.</strong>
        <p>When they become a paid AMI member, you receive one full story credit.</p>
        {referralStatus?.referralStats && <small>{referralStatus.referralStats.signedUp || 0} signups · {referralStatus.referralStats.rewarded || 0} bonus credits earned</small>}
        {referralError && <small className="ami-referral-error">{referralError}</small>}
      </div>
      <div className="ami-referral-hub-actions">
        {referralStatus?.referralUrl ? <>
          <code>{referralStatus.referralUrl}</code>
          <button type="button" onClick={copyReferralLink}>Copy referral link</button>
        </> : <button type="button" onClick={refreshReferralStatus} disabled={referralLoading}>{referralLoading ? 'Preparing your link…' : 'Create my referral link'}</button>}
      </div>
    </section>
  ) : null;

  return (
    <main>
      <header className="site-header">
        <a className="brand ami-logo-link" href="#" onClick={(e) => {e.preventDefault(); setStep('create')}} aria-label="AMI home">
          <img className="ami-header-logo" src="/ami-logo.svg" alt="AMI" />
        </a>
        <div className="header-actions-global">{adventureBooksEnabled && <a className="header-platform-link adventure-header-link" href="/adventure-book">Free Adventure Book</a>}<a className="header-platform-link" href="/membership">Membership</a>{user && <a className="header-credit-chip" href="/membership" title="Story credits">{billingStatus?.isAdmin ? 'Unlimited stories' : `${billingStatus?.credits ?? '…'} credits`}</a>}{isAdmin && <a className="header-platform-link studio-link" href="/studio">Studio</a>}<button type="button" className="theme-toggle-button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Use light mode' : 'Use bedtime mode'} title={theme === 'dark' ? 'Use light mode' : 'Use bedtime mode'}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Bedtime'}</span></button><button type="button" onClick={openLibrary}>My stories</button>{supabaseConfigured ? (user ? <div className="account-chip"><span>{user.email}</span><button type="button" onClick={signOut}>Sign out</button></div> : <button type="button" className="sign-in-button" onClick={() => requestSignIn()}>Sign in</button>) : <div className="header-note">Local preview mode</div>}</div>
      </header>

      <section className="shell">
        {adventureBooksEnabled && <section className="ami-adventure-home-spotlight" aria-label="Free AMI Adventure Book">
          <div className="ami-adventure-home-copy">
            <span>PERSONALIZED PRINTABLE <b>FREE</b></span>
            <h2>Create Their First AMI Adventure Book — Free.</h2>
            <p>A polished 15-page sampler of coloring, puzzles, tracing, drawing, and creative play—personalized with your child’s name, age, and favorite world.</p>
            <div className="ami-adventure-home-details"><small>Free digital sampler</small><small>Ages 2–10</small><small>No payment required</small></div>
          </div>
          <div className="ami-adventure-home-action">
            <div className="ami-adventure-mini-cover" aria-hidden="true"><i>AMI ADVENTURE BOOK</i><b>✦</b><strong>Made for them</strong><small>FREE SAMPLER</small></div>
            <a href="/adventure-book" onClick={() => window.localStorage.setItem(AMI_ADVENTURE_INTEREST_KEY, 'true')}>Create their free book <span>→</span></a>
            <small>Or continue below to create a personalized Storybook.</small>
          </div>
        </section>}
        {user && localImportCount > 0 && <div className="import-banner"><div><strong>Bring your earlier stories with you.</strong><span>AMI found {localImportCount} {localImportCount === 1 ? 'story' : 'stories'} saved in this browser.</span></div><button type="button" onClick={importLocalStories} disabled={importingStories}>{importingStories ? 'Importing…' : 'Add to my account'}</button></div>}
        {step !== 'library' && <div className="progress-row" aria-label="Progress">
          {['Create', 'Review', 'Read'].map((label, index) => (
            <div className={`progress-item ${progress >= index + 1 ? 'active' : ''}`} key={label}>
              <span>{index + 1}</span>{label}
            </div>
          ))}
        </div>}
        {(step === 'create' || step === 'library') && referralPanel}
        {referralMessage && (step === 'create' || step === 'library') && <div className="save-message ami-referral-message">{referralMessage}</div>}

        {step === 'create' && (
          <div className="create-grid">
            <section className="intro-panel">
              <div className="eyebrow">A story for what they need tonight</div>
              <h1>Help them meet a big moment through a little story.</h1>
              <p>Create a personal storybook that gently reflects what your child is working through and how you want them to feel by the end.</p>
              <div className="promise-card">
                <div className="spark">✦</div>
                <div><strong>Personal, not preachy.</strong><br/>AMI turns a real childhood challenge into a warm, imaginative story your family can share tonight.</div>
              </div>
              <div className="floating-art" aria-hidden="true">
                <div className="moon">☾</div>
                <div className="hill one"></div>
                <div className="hill two"></div>
                <div className="star s1">✦</div><div className="star s2">✦</div><div className="star s3">•</div>
                <div className="child-shape">✦</div>
              </div>
            </section>

            <form className="builder-card" onSubmit={generateStory}>
              <div className="section-heading"><span>1</span><div><h2>Meet your storyteller</h2><p>The little person at the center of it all.</p></div></div>
              <div className="field-grid two">
                <label>Child's name<input required value={form.childName} onChange={(e) => update('childName', e.target.value)} placeholder="August" /></label>
                <label>Age<select value={form.age} onChange={(e) => update('age', e.target.value)}>{Array.from({length: 9}, (_, i) => <option key={i+2}>{i+2}</option>)}</select></label>
              </div>
              <div className="field-grid two">
                <label>Pronouns<select value={form.pronouns} onChange={(e) => update('pronouns', e.target.value)}><option value="use-name">Use child's name only</option><option value="he/him">He/him</option><option value="she/her">She/her</option><option value="they/them">They/them</option></select></label>
                <label>Appearance <span className="optional">optional</span><input value={form.appearance} onChange={(e) => update('appearance', e.target.value)} placeholder="Curly brown hair, green pajamas" /></label>
              </div>
              <div className={`photo-personalization ${referencePhoto ? 'has-photo' : ''}`}>
                <div className="photo-personalization-copy">
                  <strong>Make the character feel more like your child <span className="optional">optional</span></strong>
                  <p>Upload one clear photo to inspire the illustrated character’s hair, features, age, and overall look.</p>
                  <small>AMI creates a storybook-inspired likeness, not an exact portrait. Use a photo you have permission to upload.</small>
                </div>
                {referencePhoto ? (
                  <div className="photo-preview-wrap">
                    <img src={referencePhoto} alt="Child reference preview" />
                    <div><span>{photoAnalyzing ? 'Reading visual details…' : referencePhotoAnalysis ? 'Photo personalization enabled' : 'Photo ready'}</span><button type="button" onClick={removeReferencePhoto}>Remove</button></div>
                  </div>
                ) : (
                  <label className="photo-upload-button">Upload a photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReferencePhoto} /></label>
                )}
              </div>

              <div className="field-grid two language-fields">
                <label>Book language<select value={form.language} onChange={(e) => update('language', e.target.value)}><option value="en">English</option><option value="es">Español</option><option value="en-es">English + Español</option></select></label>
                <label>Dedication <span className="optional">optional</span><input value={form.dedication} onChange={(e) => update('dedication', e.target.value)} placeholder="For August, with all our love — Grandma and Grandpa" /></label>
              </div>
              {form.language === 'en-es' && <div className="language-note">Bilingual pages use shorter copy with English first and natural Spanish beneath it.</div>}

              <div className="divider"></div>
              <div className="section-heading"><span>2</span><div><h2>What is your child working through?</h2><p>Choose a real moment, or switch to a story made purely for fun.</p></div></div>
              <div className="mode-toggle desktop-story-mode">
                <button type="button" className={form.storyMode === 'Challenge' ? 'active' : ''} onClick={() => selectStoryMode('Challenge')}>Challenge story</button>
                <button type="button" className={form.storyMode === 'Fun' ? 'active' : ''} onClick={() => selectStoryMode('Fun')}>Just for fun</button>
              </div>

              {form.storyMode === 'Challenge' ? (
                <>
                  <label className="story-option-selector">What is your child working through?
                    <select value={form.challenge} onChange={(e) => update('challenge', e.target.value)}>
                      {challenges.map(([name]) => <option value={name} key={name}>{name}</option>)}
                    </select>
                    <small>{challenges.find(([name]) => name === form.challenge)?.[1]}</small>
                  </label>
                  <label>What is happening right now? <span className="optional">optional but helpful</span><textarea value={form.storyIdea} onChange={(e) => update('storyIdea', e.target.value)} placeholder="She asks for the pacifier whenever she is tired and gets upset when we say no. We want the story to feel reassuring, not like she is in trouble." /></label>
                  <label>How would you like them to feel by the end?</label>
                  <div className="feeling-row">
                    {feelings.map((feeling) => <button type="button" key={feeling} className={form.emotionalOutcome === feeling ? 'selected' : ''} onClick={() => update('emotionalOutcome', feeling)}>{feeling}</button>)}
                  </div>
                </>
              ) : (
                <>
                  <label className="story-option-selector">What kind of story should this be?
                    <select value={form.theme} onChange={(e) => update('theme', e.target.value)}>
                      {funModes.map(([name]) => <option value={name} key={name}>{name}</option>)}
                    </select>
                    <small>{funModes.find(([name]) => name === form.theme)?.[1]}</small>
                  </label>
                  <label>What should happen?<textarea value={form.storyIdea} onChange={(e) => update('storyIdea', e.target.value)} placeholder="August discovers a tiny dinosaur egg in the backyard and has to help the baby find its family..." /></label>
                </>
              )}

              <label>Favorite people, pets, toys, or places <span className="optional">optional</span><input value={form.favorites} onChange={(e) => update('favorites', e.target.value)} placeholder="Mabel, a blue stuffed dinosaur, Grandma's garden" /></label>
              <label>Anything the story should gently reinforce? <span className="optional">optional</span><input value={form.lesson} onChange={(e) => update('lesson', e.target.value)} placeholder="Comfort can come from hugs, songs, and cuddling a favorite stuffed animal" /></label>

              <div className="divider"></div>
              <div className="section-heading"><span>3</span><div><h2>Pick the storybook look</h2><p>This becomes the visual direction for every page.</p></div></div>
              <div className="style-grid">
                {styles.map((style) => {
                  const selected = normalizeAmiStyle(form.style) === style.id;
                  return (
                    <button type="button" key={style.id} className={`style-choice ${selected ? 'selected' : ''}`} onClick={() => update('style', style.id)} aria-pressed={selected}>
                      {selected && <span className="style-selected-check" aria-hidden="true">✓</span>}
                      <div className="style-preview"><img src={style.preview} alt={`${style.id} storybook style sample`} loading="lazy" /></div>
                      <div className="style-choice-copy"><strong>{style.id}</strong><span>{style.bestFor}</span></div>
                      <small>{style.description}</small>
                    </button>
                  );
                })}
              </div>

              <div className="ami-product-choice">
                <button type="button" className={form.productType === 'mini' ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, productType: 'mini', length: '3' }))} disabled={Boolean(user && referralStatus && !referralStatus.miniAvailable)}>
                  <span>Free first experience</span><strong>AMI Mini Story</strong><small>1 cover + 3 illustrated pages · one per verified account</small>
                </button>
                <button type="button" className={form.productType !== 'mini' ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, productType: 'full', length: current.length === '3' ? '10' : current.length }))}>
                  <span>Full experience</span><strong>Full AMI Story</strong><small>Use 1 story credit · editable and print-eligible</small>
                </button>
              </div>
              {form.productType === 'mini' ? (
                <div className="ami-mini-note"><strong>Your free AMI Mini Story includes 3 illustrated pages.</strong><span>No regenerations or print-production files. Upgrade later to continue the adventure as a full book.</span>{user && referralStatus && !referralStatus.emailVerified && <em>Confirm your email before generating.</em>}{user && referralStatus?.miniStatus === 'used' && <em>This account has already created its free Mini Story.</em>}</div>
              ) : (
                <div className="field-grid two bottom-fields">
                  <label>Book length<select value={form.length} onChange={(e) => update('length', e.target.value)}><option value="5">Quick story · 5 pages</option><option value="10">Bedtime story · 10 pages</option><option value="16">Full storybook · 16 pages</option></select></label>
                  <div className="generation-note">One click writes, plans, illustrates, and saves the complete book. You can still review and edit every page afterward.</div>
                </div>
              )}
              {draftMessage && <div className="draft-restored"><strong>Welcome back.</strong><span>{draftMessage}</span><button type="button" onClick={() => { window.localStorage.removeItem(AMI_DRAFT_KEY); setForm(emptyForm); setReferencePhoto(''); setReferencePhotoAnalysis(null); setDraftMessage(''); }}>Start fresh</button></div>}
              {loading && <div className="ami-generation-stage" role="status" aria-live="polite"><div className="ami-generation-orbit"><span>✦</span></div><div><strong>{loadingMessage || 'Writing your story…'}</strong><p>AMI is writing the story, locking the characters and recurring objects, then illustrating every page. Keep this tab open while the book comes together.</p><div className="ami-generation-steps"><span className="done">Story details</span><span className={loadingMessage?.includes('page') || loadingMessage?.includes('ready') ? 'done' : ''}>Story arc</span><span className={loadingMessage?.includes('ready') ? 'done' : ''}>Page plan</span></div></div></div>}
              {error && <div className="error">{error}</div>}
              <button className="primary-button" disabled={loading || (form.productType === 'mini' && user && referralStatus && !referralStatus.miniAvailable)}>{loading ? loadingMessage || 'Writing your story…' : form.productType === 'mini' ? 'Create my free Mini Story' : form.storyMode === 'Challenge' ? 'Create their challenge story' : 'Create my story'}<span>→</span></button>
              <p className="privacy-note">Use a first name or nickname. AMI does not need private information about your child.</p>
            </form>
          </div>
        )}

        {step === 'review' && story && (
          <section className="review-layout">
            <div className="review-header">
              {story.productType === 'mini' && <div className="photo-personalization-badge">Free AMI Mini Story · 3 pages</div>}{story.referencePhotoAnalysis && <div className="photo-personalization-badge">Photo-personalized character</div>}
              <div><div className="eyebrow">Your story draft</div><h1>{decodeHtmlEntities(story.title)}</h1><p>{decodeHtmlEntities(story.summary)}</p></div>
              <div className="header-actions"><button className="ghost" onClick={() => setStep('create')}>Edit setup</button><button className="ghost" onClick={generateCover} disabled={coverLoading || (story.productType === 'mini' && Boolean(story.coverImageUrl))}>{coverLoading ? 'Creating cover…' : story.coverImageUrl ? (story.productType === 'mini' ? 'Mini cover complete' : 'Regenerate cover') : 'Generate cover'}</button><button className="ghost" onClick={generateAllImages} disabled={generatingAll}>{generatingAll ? 'Illustrating pages…' : 'Generate all images'}</button><button className="primary-small" onClick={() => setStep('read')}>Open storybook →</button></div>
            </div>
            {story.productType === 'mini' && story.generationStatus === 'complete' && <section className="ami-mini-complete" id="ami-mini-complete">
              <div className="ami-mini-complete-art" aria-hidden="true">✦</div>
              <div className="ami-mini-complete-copy"><span>YOUR AMI MINI STORY IS READY</span><h2>Love the beginning? Continue the adventure.</h2><p>Create a full illustrated story using the same child, theme, style, and details—or explore AMI Membership for two full story credits each month.</p></div>
              <div className="ami-mini-complete-actions"><button type="button" className="primary-small" onClick={() => setStep('read')}>Read my Mini Story</button><button type="button" className="ghost" onClick={startFullVersionFromMini}>Create the full story</button><a href="/membership">Explore AMI Membership</a></div>
            </section>}
            <div className="story-meta">
              <div><small>Starring</small><strong>{story.characterBible?.name}</strong></div>
              <div><small>Visual style</small><strong>{form.style}</strong></div>
              <div><small>Gentle takeaway</small><strong>{decodeHtmlEntities(story.takeaway)}</strong></div>
            </div>
            {error && <div className="error review-error">{error}</div>}
            <div className="image-note"><strong>Your complete book was created in one pass.</strong> Review and edit the writing or regenerate an individual page only when something needs attention.</div>
            {generatingAll && (() => {
              const card = engagementCards[engagementCardIndex % engagementCards.length];
              const completed = story.pages.filter((page) => page.imageUrl).length;
              return <div className="ami-assembly-overlay" role="status" aria-live="polite"><div className="ami-assembly-workspace">
                <div className="ami-assembly-heading">
                  <div><span>YOUR BOOK IS COMING TOGETHER</span><strong>{generationAllProgress.current <= 1 ? 'Creating the visual anchor' : `Painting page ${Math.max(1, generationAllProgress.current - 1)} of ${story.pages.length}`}</strong><p>{story.characterBible?.name || form.childName || 'Your child'}’s story is written. AMI is now building each illustrated moment and saving every finished page to the shelf.</p></div>
                  <b>{generationAllProgress.total ? Math.round((generationAllProgress.current / generationAllProgress.total) * 100) : 0}%</b>
                </div>
                <div className="illustration-progress-track"><i style={{ width: `${generationAllProgress.total ? Math.round((generationAllProgress.current / generationAllProgress.total) * 100) : 0}%` }} /></div>
                <div className="ami-page-reveal" aria-label={`${completed} illustrated pages complete`}>
                  {story.pages.map((page, index) => <div key={page.pageNumber} className={`ami-page-mini ${page.imageUrl ? 'ready' : index + 1 === generationAllProgress.current ? 'painting' : ''}`}>{page.imageUrl ? <img src={page.imageUrl} alt="" /> : <span>{index + 1}</span>}</div>)}
                </div>
                <div className="ami-wait-card">
                  <div className="ami-wait-card-copy"><span>{engagementPackLoading ? 'Making this personal' : card.eyebrow}</span>{engagementPackLoading ? <><strong>AMI is finding a fresh question…</strong><p>The next cards will be shaped around this story.</p></> : card.fact ? <><strong>Did you know?</strong><p>{card.fact}</p></> : <><strong>{card.question}</strong><p>{card.type === 'about' ? 'Optional. AMI can remember this with the story for future personalization.' : 'Pick one while the next page is painted.'}</p></>}</div>
                  {!engagementPackLoading && card.options && <div className="ami-wait-options">{card.options.map((option) => <button type="button" key={option} onClick={() => answerEngagementCard(option)}>{option}</button>)}</div>}
                  {!engagementPackLoading && card.type === 'about' && <form className="ami-wait-answer" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get('answer'); answerEngagementCard(value); event.currentTarget.reset(); }}><input name="answer" placeholder={card.placeholder} /><button type="submit">Save answer</button></form>}
                  {!engagementPackLoading && card.fact && <button type="button" className="ami-next-card" onClick={skipEngagementCard}>Another one →</button>}
                  {!engagementPackLoading && !card.fact && <button type="button" className="ami-skip-card" onClick={skipEngagementCard}>Skip</button>}
                </div>
                {(surpriseMessage || Object.keys(engagementAnswers).length >= 3) && <div className="ami-little-surprise"><span>✦</span><div><strong>A little surprise from AMI</strong><p>{surpriseMessage || 'Your answers are saved. AMI occasionally adds a small extra with no points to track.'}</p></div></div>}
              </div></div>;
            })()}
            <article className={`cover-editor ${story.coverImageUrl ? 'has-image' : ''}`}>
              <div className="cover-kicker">Book cover</div>
              <div className="cover-preview">
                {story.coverImageUrl ? (
                  <>
                    <img src={story.coverImageUrl} alt={`Cover artwork for ${story.title}`} />
                    <div className="cover-title-overlay">
                      <small>A STORY BY AMI</small>
                      <h3>{decodeHtmlEntities(story.title)}</h3>
                      {story.characterBible?.name && <p>For {story.characterBible.name}</p>}
                    </div>
                  </>
                ) : (
                  <div className="cover-placeholder">
                    <span>{isAdmin ? 'Cover direction' : 'Cover artwork'}</span>
                    <h3>{decodeHtmlEntities(story.title)}</h3>
                    <p>{isAdmin ? (story.coverPrompt || 'A warm portrait cover featuring the child and the story’s central magical moment.') : 'Generate a personalized cover after you approve the story.'}</p>
                  </div>
                )}
              </div>
              <button type="button" className="image-button cover-button" onClick={generateCover} disabled={coverLoading}>
                {coverLoading ? 'Creating cover…' : story.coverImageUrl ? 'Regenerate cover' : 'Generate cover'}
              </button>
            </article>
            <div className="page-editor-list">
              {story.pages.map((page, index) => (
                <article className="page-editor" key={page.pageNumber}>
                  <div className="page-number">{String(index + 1).padStart(2, '0')}</div>
                  <div className={`illustration-placeholder ${page.imageUrl ? 'has-image' : ''}`}>
                    {page.imageUrl ? (
                      <img src={page.imageUrl} alt={`Illustration for page ${page.pageNumber}`} />
                    ) : (
                      <div className="illustration-copy"><span>{isAdmin ? 'Illustration direction' : 'Illustration'}</span><p>{isAdmin ? page.illustrationPrompt : 'Create this page’s personalized artwork when the story text is ready.'}</p></div>
                    )}
                    <button type="button" className="image-button" onClick={() => generateImageForPage(index)} disabled={imageLoading[index] || generatingAll}>
                      {imageLoading[index] ? imageLoadingMessage[index] || 'Creating illustration…' : page.imageUrl ? 'Regenerate image' : 'Generate image'}
                    </button>
                  </div>
                  <div className="page-copy"><label>Page text</label><textarea value={decodeHtmlEntities(page.text)} onChange={(e) => updatePage(index, e.target.value)} /></div>
                </article>
              ))}
            </div>
            {isAdmin && <aside className="print-production-panel">
              <div className="print-production-heading">
                <div><span className="print-readiness-kicker">Print review</span><strong>{story.coverImageUrl && story.pages.every((page) => page.imageUrl) ? 'Ready to prepare a physical proof' : 'Complete the artwork before ordering'}</strong><p>Interior: 8.5 × 8.5 in trim with bleed. Cover: Lulu casewrap spread, 19 × 10.25 in with a 0.25 in spine.</p></div>
                <div className={`production-score ${story.coverImageUrl && story.pages.every((page) => page.imageUrl) ? 'ready' : ''}`}>{story.pages.filter((page) => page.imageUrl).length + (story.coverImageUrl ? 1 : 0)}/{story.pages.length + 1}</div>
              </div>
              <div className="print-production-grid">
                <div className="print-checklist">
                  <h3>Preflight checklist</h3>
                  <ul>
                    <li className={story.coverImageUrl ? 'ready' : 'warning'}>{story.coverImageUrl ? 'Cover artwork generated' : 'Generate the cover artwork'}</li>
                    <li className={story.pages.every((page) => page.imageUrl) ? 'ready' : 'warning'}>{story.pages.filter((page) => page.imageUrl).length} of {story.pages.length} interior illustrations generated</li>
                    <li className={(story.language || form.language) === 'en-es' ? 'note' : 'ready'}>{(story.language || form.language) === 'en-es' ? 'Bilingual compact text layout active' : 'Single-language print spacing active'}</li>
                    <li className={story.pages.length === 10 ? 'ready' : 'note'}>{story.pages.length === 10 ? '24-page casewrap minimum reached' : `${story.pages.length} scenes normalize to a multiple of four`}</li>
                    <li className="note">Review image sharpness in the printer preview and physical proof</li>
                  </ul>
                </div>
                <div className="cover-settings">
                  <h3>Lulu cover template</h3>
                  <p>These defaults match your current Lulu 24-page, 8.5 × 8.5 casewrap template. Update them only if Lulu gives you a different custom cover template.</p>
                  <div className="cover-dimension-row">
                    <label>Total width (in)<input type="number" min="1" step="0.001" value={coverSpec.totalWidth} onChange={(e) => setCoverSpec((current) => ({ ...current, totalWidth: e.target.value }))} /></label>
                    <label>Total height (in)<input type="number" min="1" step="0.001" value={coverSpec.totalHeight} onChange={(e) => setCoverSpec((current) => ({ ...current, totalHeight: e.target.value }))} /></label>
                    <label>Spine width (in)<input type="number" min="0" step="0.001" value={coverSpec.spineWidth} onChange={(e) => setCoverSpec((current) => ({ ...current, spineWidth: e.target.value }))} /></label>
                  </div>
                  <label className="back-blurb-field">Back-cover blurb<textarea value={backCoverBlurb} onChange={(e) => setBackCoverBlurb(e.target.value)} maxLength={650} /></label>
                  <small>Current template: 19 × 10.25 in total size, 0.25 in spine, 3.622 × 1.26 in barcode area, and 0.625 in wrap / safety margins.</small>
                </div>
              </div>
              <div className="print-export-actions">
                <button type="button" className="ghost keepsake-button" onClick={exportKeepsakePdf} disabled={keepsakeExporting}>{keepsakeExporting ? 'Building Lulu interior…' : 'Download Lulu interior PDF'}</button>
                <button type="button" className="ghost keepsake-button" onClick={exportLuluAlignmentProof}>Download alignment proof</button>
                <button type="button" className="ghost keepsake-button" onClick={exportWraparoundCoverPdf} disabled={coverExporting || !story.coverImageUrl}>{coverExporting ? 'Building Lulu cover…' : 'Download Lulu cover PDF'}</button>
              </div>
            </aside>}
            <div className="sticky-actions"><span className="save-status">{saveMessage}</span><button className="ghost" onClick={saveToLibrary}>Save to My Stories</button><button className="ghost" onClick={printStory}>Digital PDF</button>{isAdmin && <button className="ghost keepsake-button" onClick={exportKeepsakePdf} disabled={keepsakeExporting}>{keepsakeExporting ? 'Building 8.5×8.5…' : '8.5×8.5 Lulu PDF'}</button>}<button className="primary-small" onClick={() => setStep('read')}>Read the story →</button></div>
          </section>
        )}

        {step === 'library' && (
          <section className="library-view">
            <div className="library-header">
              <div><div className="eyebrow">Your AMI shelf</div><h1>My Stories</h1><p>Your books are saved to your account and available wherever you sign in.</p></div>
              <button className="primary-small" onClick={() => { setStory(null); setStoryId(null); setForm(emptyForm); setReferencePhoto(''); setReferencePhotoAnalysis(null); setStep('create'); }}>Create a new story</button>
            </div>
            {error && <div className="error">{error}</div>}
            {libraryLoading ? (
              <div className="library-empty">Opening your story shelf…</div>
            ) : savedStories.length === 0 ? (
              <div className="library-empty"><span>☾</span><h2>Your shelf is waiting.</h2><p>Save a story after generating it and it will appear here on every device where you sign in.</p></div>
            ) : (
              <div className="library-grid">
                {savedStories.map((record) => (
                  <article className="library-card" key={record.id}>
                    <button className="library-cover" onClick={() => loadSavedStory(record, 'read')}>
                      {record.coverImageUrl ? (
                        <>
                          <img src={record.coverImageUrl} alt="" />
                          <div className="library-cover-overlay"><small>A STORY BY AMI</small><strong>{record.title}</strong></div>
                        </>
                      ) : <div><span>☾</span><strong>{record.title}</strong></div>}
                    </button>
                    <div className="library-card-copy"><small>{record.childName ? `For ${record.childName}` : 'AMI story'} · {new Date(record.updatedAt).toLocaleDateString()}</small><h2>{record.title}</h2>{record.story?.generationStatus && record.story.generationStatus !== 'complete' && <span className="library-progress-badge">In progress · {record.story.pages?.filter((page) => page.imageUrl).length || 0}/{record.story.pages?.length || 0} pages illustrated</span>}</div>
                    <div className="library-card-actions"><button onClick={() => loadSavedStory(record, 'review')}>{record.story?.generationStatus && record.story.generationStatus !== 'complete' ? 'Continue creating' : 'Edit'}</button><button onClick={() => loadSavedStory(record, 'read')} disabled={!record.story?.pages?.length}>Read</button><button className="delete-story" onClick={() => deleteSavedStory(record.id)}>Delete</button></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 'read' && story && (
          <section className="reader-wrap">
            <div className="reader-toolbar"><button onClick={() => setStep('review')}>← Back to edit</button><span>{pageIndex + 1} / {story.pages.length}</span><div className="reader-toolbar-actions">
                {saveMessage && <span className="reader-save-status" role="status">{saveMessage}</span>}
                <button type="button" onClick={saveToLibrary} disabled={saveMessage === 'Saving…'}>{saveMessage === 'Saving…' ? 'Saving…' : saveMessage ? 'Saved ✓' : 'Save'}</button>
                <button type="button" onClick={printStory}>Digital PDF</button>
                {isAdmin && <button type="button" onClick={exportKeepsakePdf} disabled={keepsakeExporting}>{keepsakeExporting ? 'Building…' : 'Lulu interior'}</button>}
              </div></div>
            {story.coverImageUrl && (
              <div className="reader-cover-strip">
                <img src={story.coverImageUrl} alt={`Cover of ${story.title}`} />
                <div><small>Cover</small><strong>{decodeHtmlEntities(story.title)}</strong></div>
              </div>
            )}
            <div className="book-stage">
              <div className="book-page">
                <div className={`reader-art ${story.pages[pageIndex].imageUrl ? 'has-image' : ''}`}>
                  {story.pages[pageIndex].imageUrl ? (
                    <img src={story.pages[pageIndex].imageUrl} alt={`Illustration for page ${pageIndex + 1}`} />
                  ) : (
                    <><div className="reader-moon">☾</div><div className="reader-stars">✦ &nbsp; · &nbsp; ✧</div><div className="prompt-caption">Generate this page's illustration from the review screen.</div></>
                  )}
                </div>
                <div className="reader-copy"><div className="tiny-title">{decodeHtmlEntities(story.title)}</div><p>{decodeHtmlEntities(story.pages[pageIndex].text)}</p></div>
              </div>
            </div>
            <div className="reader-nav"><button disabled={pageIndex === 0} onClick={() => setPageIndex((i) => i - 1)}>← Previous</button><div className="dots">{story.pages.map((_, i) => <button aria-label={`Page ${i+1}`} key={i} className={i === pageIndex ? 'active' : ''} onClick={() => setPageIndex(i)} />)}</div><button disabled={pageIndex === story.pages.length - 1} onClick={() => setPageIndex((i) => i + 1)}>Next →</button></div>
          </section>
        )}

        {adventurePromptOpen && <div className="ami-adventure-prompt-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdventurePromptOpen(false); }}>
          <section className="ami-adventure-prompt" role="dialog" aria-modal="true" aria-label="Free personalized AMI Adventure Book">
            <button type="button" className="ami-adventure-prompt-close" onClick={() => setAdventurePromptOpen(false)} aria-label="Close">×</button>
            <div className="ami-adventure-prompt-cover" aria-hidden="true"><small>AMI ADVENTURE BOOK</small><b>✦</b><strong>Made for them</strong><i>FREE SAMPLER</i></div>
            <div className="ami-adventure-prompt-copy"><span>PERSONALIZED PRINTABLE <b>FREE</b></span><h2>Create Their First AMI Adventure Book.</h2><p>Personalized for their name, age, and favorite theme. Download a 15-page printable sampler in minutes.</p><a href="/adventure-book" onClick={() => window.localStorage.setItem(AMI_ADVENTURE_INTEREST_KEY, 'true')}>Create Their Free Adventure Book <i>→</i></a><small>No payment required · Ready to print</small></div>
          </section>
        </div>}

        {authOpen && <div className="auth-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-label="AMI account">
            <button type="button" className="auth-close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button>
            <div className="auth-moon">a</div>
            <div className="eyebrow">Keep their stories close</div>
            <h2>{authMode === 'signup' ? 'Create your AMI account' : 'Welcome back'}</h2>
            <p>{authMode === 'signup' ? 'Save books, continue illustrations, and open your family shelf on any device.' : 'Sign in to open your saved stories and continue where you left off.'}</p>
            <button type="button" className="google-auth-button" onClick={signInWithGoogle} disabled={authLoading}>
              <span className="google-mark" aria-hidden="true">G</span>
              Continue with Google
            </button>
            <div className="auth-divider"><span>or continue with email</span></div>
            <form onSubmit={submitAuth}>
              <label>Email<input type="email" required autoComplete="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@example.com" /></label>
              <label>Password<input type="password" required minLength="8" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="At least 8 characters" /></label>
              {authMessage && <div className="auth-message">{authMessage}</div>}
              <button className="primary-button" disabled={authLoading}>{authLoading ? 'One moment…' : authMode === 'signup' ? 'Create free account' : 'Sign in'}<span>→</span></button>
            </form>
            <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthMessage(''); }}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New to AMI? Create an account'}</button>
            <small className="auth-privacy">Use a parent or guardian email. AMI only needs a child’s first name or nickname.</small>
          </section>
        </div>}

        {story && (
          <section className="print-book" aria-hidden="true">
            <article className="print-cover">
              {story.coverImageUrl && <img src={story.coverImageUrl} alt="" />}
              <div className="print-cover-title"><small>A STORY BY AMI</small><h1>{decodeHtmlEntities(story.title)}</h1><p>{decodeHtmlEntities(story.summary)}</p></div>
            </article>
            {story.pages.map((page, index) => (
              <article className="print-page" key={`print-${page.pageNumber}`}>
                <div className="print-image">{page.imageUrl ? <img src={page.imageUrl} alt="" /> : <div className="print-placeholder">Illustration not generated</div>}</div>
                <div className="print-copy"><small>{decodeHtmlEntities(story.title)} · {index + 1}</small><p>{decodeHtmlEntities(page.text)}</p></div>
              </article>
            ))}
          </section>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
