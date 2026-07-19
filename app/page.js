'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase-browser';

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

const styles = [
  ['Watercolor', 'Soft and dreamy'],
  ['Picture Book', 'Bright and playful'],
  ['Paper Cutout', 'Textured and whimsical']
];

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


function decodeHtmlEntities(value) {
  if (typeof value !== 'string' || !value.includes('&')) return value;

  // Decode both named and numeric HTML entities without injecting HTML into the page.
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

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
  style: 'Watercolor',
  length: '10'
};

export default function Home() {
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

  const progress = useMemo(() => {
    if (step === 'create') return 1;
    if (step === 'review') return 2;
    if (step === 'read') return 3;
    return 0;
  }, [step]);

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
        setAuthMessage('Check your email to confirm your account, then return to Moonlit.');
      } else {
        setAuthMessage('You’re signed in.');
        setAuthOpen(false);
      }
    } catch (err) {
      setAuthMessage(err.message || 'Moonlit could not sign you in.');
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
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (googleError) throw googleError;
    } catch (err) {
      setAuthMessage(err.message || 'Moonlit could not start Google sign-in.');
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
    return { id, now };
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
      setError('Moonlit could not import every local story. Your originals are still safe in this browser.');
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

  async function generateStory(event) {
    event.preventDefault();
    if (supabaseConfigured && !user) {
      requestSignIn('Create a free Moonlit account before generating so this story can stay on your shelf.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const generationInput = form.storyMode === 'Fun'
        ? {
            ...form,
            challenge: '',
            emotionalOutcome: '',
            storyMode: 'Fun'
          }
        : {
            ...form,
            storyMode: 'Challenge'
          };

      const response = await authenticatedFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generationInput)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Story generation failed.');
      setStory(decodeStoryEntities({ ...data, language: generationInput.language || 'en', dedication: generationInput.dedication || '' }));
      setStoryId(null);
      setStep('review');
      setPageIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  function updatePage(index, value) {
    setStory((current) => ({
      ...current,
      pages: current.pages.map((page, i) => i === index ? { ...page, text: value } : page)
    }));
  }

  async function generateImageForPage(index) {
    const page = story?.pages?.[index];
    if (!page || imageLoading[index]) return;

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
          style: form.style,
          characterBible: story.characterBible,
          page
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image generation failed.');
      setStory((current) => ({
        ...current,
        pages: current.pages.map((item, i) => i === index ? { ...item, imageUrl: data.imageUrl } : item)
      }));
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
    setCoverLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'cover',
          storyTitle: story.title,
          style: form.style,
          characterBible: story.characterBible,
          page: { coverPrompt: story.coverPrompt || story.pages?.[0]?.illustrationPrompt }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cover generation failed.');
      setStory((current) => ({ ...current, coverImageUrl: data.imageUrl }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCoverLoading(false);
    }
  }

  async function generateAllImages() {
    if (!story?.pages?.length || generatingAll) return;
    setGeneratingAll(true);
    setError('');
    try {
      for (let i = 0; i < story.pages.length; i += 1) {
        if (!story.pages[i].imageUrl) await generateImageForPage(i);
      }
    } finally {
      setGeneratingAll(false);
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
      setError('Moonlit could not open your story shelf. Check the Supabase setup and try again.');
    } finally {
      setLibraryLoading(false);
    }
  }

  async function openLibrary() {
    if (supabaseConfigured && !user) {
      requestSignIn('Sign in to open your Moonlit story shelf.');
      return;
    }
    setStep('library');
    await refreshLibrary();
  }

  async function saveToLibrary() {
    if (!story) return;
    if (supabaseConfigured && !user) {
      requestSignIn('Sign in to save this story to your Moonlit shelf.');
      return;
    }
    setError('');
    setSaveMessage('Saving…');
    try {
      const id = storyId || crypto.randomUUID();
      const now = new Date().toISOString();
      if (supabaseConfigured) {
        await saveRecordToCloud({ id, story, form, createdAt: story.createdAt || now });
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
      setError('Moonlit could not save this story. Check your connection and Supabase policies, then try again.');
      setSaveMessage('');
    }
  }

  function loadSavedStory(record, targetStep = 'review') {
    setStory(decodeStoryEntities(record.story));
    setForm({ ...emptyForm, ...(record.form || {}) });
    setStoryId(record.id);
    setPageIndex(0);
    setStep(targetStep);
    setError('');
  }

  async function deleteSavedStory(id) {
    if (!window.confirm('Remove this story from your Moonlit shelf?')) return;
    if (supabaseConfigured) {
      const prefix = `${user.id}/${id}`;
      const { data: assets } = await supabase.storage.from('story-assets').list(prefix);
      if (assets?.length) {
        await supabase.storage.from('story-assets').remove(assets.map((asset) => `${prefix}/${asset.name}`));
      }
      const { error: deleteError } = await supabase.from('stories').delete().eq('id', id);
      if (deleteError) setError('Moonlit could not delete that story.');
    } else {
      await removeSavedStory(id);
    }
    await refreshLibrary();
  }

  async function printStory() {
    if (!story) return;

    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      setError('Your browser blocked the PDF window. Allow pop-ups for Moonlit and try again.');
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
      pdf.text('A MOONLIT STORY', SAFE + 8, 590);
      pdf.setCharSpace(0);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(31);
      const titleLines = pdf.splitTextToSize(decodeHtmlEntities(story.title || 'Moonlit Story'), PAGE_W - (SAFE + 8) * 2);
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
        pdf.text('☾', PAGE_W / 2, 505, { align: 'center' });
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

      const safeName = String(decodeHtmlEntities(story.title || 'moonlit-story'))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'moonlit-story';
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
      const PAGE = 594; // 8.25 inches at 72 pt/in: 8x8 trim plus 0.125in bleed on every edge.
      const TRIM_INSET = 9;
      const SAFE = 42;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE, PAGE], compress: true });

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

      const addMoon = (y = PAGE - 66) => {
        pdf.setTextColor(111, 97, 170);
        pdf.setFont('times', 'normal');
        pdf.setFontSize(24);
        pdf.text('☾', PAGE / 2, y, { align: 'center' });
      };

      const addPage = () => {
        pdf.addPage([PAGE, PAGE], 'portrait');
        addPaper();
      };

      // Interior page 1: half title.
      addPaper();
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.7);
      pdf.text('A MOONLIT KEEPSAKE', PAGE / 2, 180, { align: 'center' });
      pdf.setCharSpace(0);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(29);
      const titleLines = pdf.splitTextToSize(decodeHtmlEntities(story.title || 'Moonlit Story'), PAGE - SAFE * 2);
      pdf.text(titleLines, PAGE / 2, 230, { align: 'center', lineHeightFactor: 1.08 });
      addMoon(420);

      // Interior page 2: dedication / created-for page.
      addPage();
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.5);
      pdf.text('CREATED ESPECIALLY FOR', PAGE / 2, 170, { align: 'center' });
      pdf.setCharSpace(0);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(28);
      pdf.text(story.characterBible?.name || form.childName || 'You', PAGE / 2, 218, { align: 'center' });
      const dedication = decodeHtmlEntities(story.dedication || form.dedication || '');
      if (dedication) {
        pdf.setFont('times', 'italic');
        pdf.setFontSize(17);
        const lines = pdf.splitTextToSize(dedication, PAGE - 140);
        pdf.text(lines.slice(0, 9), PAGE / 2, 310, { align: 'center', lineHeightFactor: 1.45 });
      }
      addMoon(470);

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
          pdf.text(`Illustration ${index + 1} has not been generated`, PAGE / 2, PAGE / 2, { align: 'center' });
        }

        addPage();
        pdf.setDrawColor(223, 215, 235);
        pdf.setLineWidth(1);
        pdf.roundedRect(TRIM_INSET + 20, TRIM_INSET + 20, PAGE - (TRIM_INSET + 20) * 2, PAGE - (TRIM_INSET + 20) * 2, 12, 12, 'S');
        pdf.setTextColor(111, 97, 170);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setCharSpace(1.2);
        pdf.text(`${String(decodeHtmlEntities(story.title || '')).toUpperCase()} · ${index + 1}`, PAGE / 2, 105, { align: 'center', maxWidth: PAGE - SAFE * 2 });
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
        pdf.text(lines.slice(0, bilingual ? 15 : 12), PAGE / 2, startY, { align: 'center', lineHeightFactor: bilingual ? 1.38 : 1.42, maxWidth });
        addMoon(505);
      }

      // Closing page.
      addPage();
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.4);
      pdf.text('THE END', PAGE / 2, 190, { align: 'center' });
      pdf.setCharSpace(0);
      pdf.setTextColor(39, 33, 59);
      pdf.setFont('times', 'italic');
      pdf.setFontSize(18);
      const takeawayLines = pdf.splitTextToSize(story.takeaway || 'Every story leaves a little light behind.', PAGE - 150);
      pdf.text(takeawayLines.slice(0, 8), PAGE / 2, 270, { align: 'center', lineHeightFactor: 1.45 });
      addMoon(440);

      // Creation / rights page.
      addPage();
      pdf.setTextColor(111, 97, 170);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setCharSpace(1.3);
      pdf.text('MADE WITH MOONLIT', PAGE / 2, 250, { align: 'center' });
      pdf.setCharSpace(0);
      pdf.setTextColor(76, 68, 94);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const languageLabel = (story.language || form.language) === 'es' ? 'Español' : (story.language || form.language) === 'en-es' ? 'English + Español' : 'English';
      pdf.text(`Personalized story · ${languageLabel}`, PAGE / 2, 286, { align: 'center' });
      pdf.text('Please review every page before ordering a physical copy.', PAGE / 2, 310, { align: 'center' });
      addMoon(390);

      // Bound books are assembled in signatures. Normalize the proof to a multiple of four pages.
      const totalPages = pdf.getNumberOfPages();
      const normalizedTotal = Math.max(16, Math.ceil(totalPages / 4) * 4);
      while (pdf.getNumberOfPages() < normalizedTotal) {
        addPage();
        addMoon(PAGE / 2 + 8);
      }

      const safeName = String(decodeHtmlEntities(story.title || 'moonlit-story'))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'moonlit-story';
      pdf.save(`${safeName}-8x8-keepsake-interior.pdf`);
    } catch (pdfError) {
      console.error(pdfError);
      setError(`We could not create the 8×8 keepsake PDF: ${pdfError.message || 'Unknown error'}`);
    } finally {
      setKeepsakeExporting(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#" onClick={(e) => {e.preventDefault(); setStep('create')}}>
          <span className="brand-mark">☾</span>
          <span>moonlit</span>
        </a>
        <div className="header-actions-global"><button type="button" className="theme-toggle-button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Use light mode' : 'Use bedtime mode'} title={theme === 'dark' ? 'Use light mode' : 'Use bedtime mode'}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Bedtime'}</span></button><button type="button" onClick={openLibrary}>My stories</button>{supabaseConfigured ? (user ? <div className="account-chip"><span>{user.email}</span><button type="button" onClick={signOut}>Sign out</button></div> : <button type="button" className="sign-in-button" onClick={() => requestSignIn()}>Sign in</button>) : <div className="header-note">Local preview mode</div>}</div>
      </header>

      <section className="shell">
        {user && localImportCount > 0 && <div className="import-banner"><div><strong>Bring your earlier stories with you.</strong><span>Moonlit found {localImportCount} {localImportCount === 1 ? 'story' : 'stories'} saved in this browser.</span></div><button type="button" onClick={importLocalStories} disabled={importingStories}>{importingStories ? 'Importing…' : 'Add to my account'}</button></div>}
        {step !== 'library' && <div className="progress-row" aria-label="Progress">
          {['Create', 'Review', 'Read'].map((label, index) => (
            <div className={`progress-item ${progress >= index + 1 ? 'active' : ''}`} key={label}>
              <span>{index + 1}</span>{label}
            </div>
          ))}
        </div>}

        {step === 'create' && (
          <div className="create-grid">
            <section className="intro-panel">
              <div className="eyebrow">A story for what they need tonight</div>
              <h1>Help them meet a big moment through a little story.</h1>
              <p>Create a personal storybook that gently reflects what your child is working through and how you want them to feel by the end.</p>
              <div className="promise-card">
                <div className="spark">✦</div>
                <div><strong>Personal, not preachy.</strong><br/>Moonlit turns a real childhood challenge into a warm, imaginative story your family can share tonight.</div>
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
              <div className="field-grid two language-fields">
                <label>Book language<select value={form.language} onChange={(e) => update('language', e.target.value)}><option value="en">English</option><option value="es">Español</option><option value="en-es">English + Español</option></select></label>
                <label>Dedication <span className="optional">optional</span><input value={form.dedication} onChange={(e) => update('dedication', e.target.value)} placeholder="For August, with all our love — Grandma and Grandpa" /></label>
              </div>
              {form.language === 'en-es' && <div className="language-note">Bilingual pages use shorter copy with English first and natural Spanish beneath it.</div>}

              <div className="divider"></div>
              <div className="section-heading"><span>2</span><div><h2>What is your child working through?</h2><p>Choose a real moment, or switch to a story made purely for fun.</p></div></div>
              <div className="mode-toggle">
                <button type="button" className={form.storyMode === 'Challenge' ? 'active' : ''} onClick={() => selectStoryMode('Challenge')}>Challenge story</button>
                <button type="button" className={form.storyMode === 'Fun' ? 'active' : ''} onClick={() => selectStoryMode('Fun')}>Just for fun</button>
              </div>

              {form.storyMode === 'Challenge' ? (
                <>
                  <div className="challenge-grid">
                    {challenges.map(([name, description]) => (
                      <button type="button" key={name} className={`choice ${form.challenge === name ? 'selected' : ''}`} onClick={() => update('challenge', name)}>
                        <strong>{name}</strong><small>{description}</small>
                      </button>
                    ))}
                  </div>
                  <label>What is happening right now? <span className="optional">optional but helpful</span><textarea value={form.storyIdea} onChange={(e) => update('storyIdea', e.target.value)} placeholder="She asks for the pacifier whenever she is tired and gets upset when we say no. We want the story to feel reassuring, not like she is in trouble." /></label>
                  <label>How would you like them to feel by the end?</label>
                  <div className="feeling-row">
                    {feelings.map((feeling) => <button type="button" key={feeling} className={form.emotionalOutcome === feeling ? 'selected' : ''} onClick={() => update('emotionalOutcome', feeling)}>{feeling}</button>)}
                  </div>
                </>
              ) : (
                <>
                  <div className="choice-grid">
                    {funModes.map(([name, description]) => (
                      <button type="button" key={name} className={`choice ${form.theme === name ? 'selected' : ''}`} onClick={() => update('theme', name)}>
                        <strong>{name}</strong><small>{description}</small>
                      </button>
                    ))}
                  </div>
                  <label>What should happen?<textarea value={form.storyIdea} onChange={(e) => update('storyIdea', e.target.value)} placeholder="August discovers a tiny dinosaur egg in the backyard and has to help the baby find its family..." /></label>
                </>
              )}

              <label>Favorite people, pets, toys, or places <span className="optional">optional</span><input value={form.favorites} onChange={(e) => update('favorites', e.target.value)} placeholder="Mabel, a blue stuffed dinosaur, Grandma's garden" /></label>
              <label>Anything the story should gently reinforce? <span className="optional">optional</span><input value={form.lesson} onChange={(e) => update('lesson', e.target.value)} placeholder="Comfort can come from hugs, songs, and cuddling a favorite stuffed animal" /></label>

              <div className="divider"></div>
              <div className="section-heading"><span>3</span><div><h2>Pick the storybook look</h2><p>This becomes the visual direction for every page.</p></div></div>
              <div className="style-grid">
                {styles.map(([name, description], index) => (
                  <button type="button" key={name} className={`style-choice style-${index} ${form.style === name ? 'selected' : ''}`} onClick={() => update('style', name)}>
                    <div className="style-preview"><span>☁</span><b>⌂</b></div>
                    <strong>{name}</strong><small>{description}</small>
                  </button>
                ))}
              </div>

              <div className="field-grid two bottom-fields">
                <label>Book length<select value={form.length} onChange={(e) => update('length', e.target.value)}><option value="5">Quick story · 5 pages</option><option value="10">Bedtime story · 10 pages</option><option value="16">Full storybook · 16 pages</option></select></label>
                <div className="generation-note">Your story will be generated as an editable draft before any illustrations are created.</div>
              </div>

              {error && <div className="error">{error}</div>}
              <button className="primary-button" disabled={loading}>{loading ? loadingMessage || 'Writing your story…' : form.storyMode === 'Challenge' ? 'Create their challenge story' : 'Create my story'}<span>→</span></button>
              <p className="privacy-note">Use a first name or nickname. Moonlit does not need private information about your child.</p>
            </form>
          </div>
        )}

        {step === 'review' && story && (
          <section className="review-layout">
            <div className="review-header">
              <div><div className="eyebrow">Your story draft</div><h1>{decodeHtmlEntities(story.title)}</h1><p>{decodeHtmlEntities(story.summary)}</p></div>
              <div className="header-actions"><button className="ghost" onClick={() => setStep('create')}>Edit setup</button><button className="ghost" onClick={generateCover} disabled={coverLoading}>{coverLoading ? 'Creating cover…' : story.coverImageUrl ? 'Regenerate cover' : 'Generate cover'}</button><button className="ghost" onClick={generateAllImages} disabled={generatingAll}>{generatingAll ? 'Illustrating pages…' : 'Generate all images'}</button><button className="primary-small" onClick={() => setStep('read')}>Open storybook →</button></div>
            </div>
            <div className="story-meta">
              <div><small>Starring</small><strong>{story.characterBible?.name}</strong></div>
              <div><small>Visual style</small><strong>{form.style}</strong></div>
              <div><small>Gentle takeaway</small><strong>{decodeHtmlEntities(story.takeaway)}</strong></div>
            </div>
            {error && <div className="error review-error">{error}</div>}
            <div className="image-note"><strong>Illustrations are generated separately.</strong> Create one page at a time, or generate the whole book after you approve the writing. Each image uses OpenAI API credits.</div>
            <article className={`cover-editor ${story.coverImageUrl ? 'has-image' : ''}`}>
              <div className="cover-kicker">Book cover</div>
              <div className="cover-preview">
                {story.coverImageUrl ? (
                  <>
                    <img src={story.coverImageUrl} alt={`Cover artwork for ${story.title}`} />
                    <div className="cover-title-overlay">
                      <small>A Moonlit Story</small>
                      <h3>{decodeHtmlEntities(story.title)}</h3>
                      {story.characterBible?.name && <p>For {story.characterBible.name}</p>}
                    </div>
                  </>
                ) : (
                  <div className="cover-placeholder">
                    <span>Cover direction</span>
                    <h3>{decodeHtmlEntities(story.title)}</h3>
                    <p>{story.coverPrompt || 'A warm portrait cover featuring the child and the story’s central magical moment.'}</p>
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
                      <div className="illustration-copy"><span>Illustration direction</span><p>{page.illustrationPrompt}</p></div>
                    )}
                    <button type="button" className="image-button" onClick={() => generateImageForPage(index)} disabled={imageLoading[index] || generatingAll}>
                      {imageLoading[index] ? imageLoadingMessage[index] || 'Creating illustration…' : page.imageUrl ? 'Regenerate image' : 'Generate image'}
                    </button>
                  </div>
                  <div className="page-copy"><label>Page text</label><textarea value={decodeHtmlEntities(page.text)} onChange={(e) => updatePage(index, e.target.value)} /></div>
                </article>
              ))}
            </div>
            <aside className="print-readiness-card">
              <div><span className="print-readiness-kicker">8×8 keepsake readiness</span><strong>{story.coverImageUrl && story.pages.every((page) => page.imageUrl) ? 'Ready for a proof export' : 'A few items still need attention'}</strong></div>
              <ul>
                <li className={story.coverImageUrl ? 'ready' : 'warning'}>{story.coverImageUrl ? 'Cover artwork generated' : 'Generate the cover artwork'}</li>
                <li className={story.pages.every((page) => page.imageUrl) ? 'ready' : 'warning'}>{story.pages.filter((page) => page.imageUrl).length} of {story.pages.length} interior illustrations generated</li>
                <li className={(story.language || form.language) === 'en-es' ? 'note' : 'ready'}>{(story.language || form.language) === 'en-es' ? 'Bilingual text uses the compact keepsake layout' : 'Single-language text has standard print spacing'}</li>
                <li className={story.pages.length === 10 ? 'ready' : 'note'}>{story.pages.length === 10 ? '10 scenes create a natural 24-page keepsake' : `${story.pages.length} scenes will be normalized to a multiple-of-four page count`}</li>
              </ul>
            </aside>
            <div className="sticky-actions"><span className="save-status">{saveMessage}</span><button className="ghost" onClick={saveToLibrary}>Save to My Stories</button><button className="ghost" onClick={printStory}>Digital PDF</button><button className="ghost keepsake-button" onClick={exportKeepsakePdf} disabled={keepsakeExporting}>{keepsakeExporting ? 'Building 8×8…' : '8×8 Keepsake PDF'}</button><button className="primary-small" onClick={() => setStep('read')}>Read the story →</button></div>
          </section>
        )}

        {step === 'library' && (
          <section className="library-view">
            <div className="library-header">
              <div><div className="eyebrow">Your Moonlit shelf</div><h1>My Stories</h1><p>Your books are saved to your account and available wherever you sign in.</p></div>
              <button className="primary-small" onClick={() => { setStory(null); setStoryId(null); setForm(emptyForm); setStep('create'); }}>Create a new story</button>
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
                          <div className="library-cover-overlay"><small>A Moonlit Story</small><strong>{record.title}</strong></div>
                        </>
                      ) : <div><span>☾</span><strong>{record.title}</strong></div>}
                    </button>
                    <div className="library-card-copy"><small>{record.childName ? `For ${record.childName}` : 'Moonlit story'} · {new Date(record.updatedAt).toLocaleDateString()}</small><h2>{record.title}</h2></div>
                    <div className="library-card-actions"><button onClick={() => loadSavedStory(record, 'review')}>Edit</button><button onClick={() => loadSavedStory(record, 'read')}>Read</button><button className="delete-story" onClick={() => deleteSavedStory(record.id)}>Delete</button></div>
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
                <button type="button" onClick={exportKeepsakePdf} disabled={keepsakeExporting}>{keepsakeExporting ? 'Building…' : '8×8 PDF'}</button>
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

        {authOpen && <div className="auth-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-label="Moonlit account">
            <button type="button" className="auth-close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button>
            <div className="auth-moon">☾</div>
            <div className="eyebrow">Keep their stories close</div>
            <h2>{authMode === 'signup' ? 'Create your Moonlit account' : 'Welcome back'}</h2>
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
            <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthMessage(''); }}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New to Moonlit? Create an account'}</button>
            <small className="auth-privacy">Use a parent or guardian email. Moonlit only needs a child’s first name or nickname.</small>
          </section>
        </div>}

        {story && (
          <section className="print-book" aria-hidden="true">
            <article className="print-cover">
              {story.coverImageUrl && <img src={story.coverImageUrl} alt="" />}
              <div className="print-cover-title"><small>A Moonlit Story</small><h1>{decodeHtmlEntities(story.title)}</h1><p>{decodeHtmlEntities(story.summary)}</p></div>
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
    </main>
  );
}
