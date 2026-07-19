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
      setStory(data);
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
    setStory(record.story);
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

  function printStory() {
    if (!story) return;
    window.print();
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
              <div><div className="eyebrow">Your story draft</div><h1>{story.title}</h1><p>{story.summary}</p></div>
              <div className="header-actions"><button className="ghost" onClick={() => setStep('create')}>Edit setup</button><button className="ghost" onClick={generateCover} disabled={coverLoading}>{coverLoading ? 'Creating cover…' : story.coverImageUrl ? 'Regenerate cover' : 'Generate cover'}</button><button className="ghost" onClick={generateAllImages} disabled={generatingAll}>{generatingAll ? 'Illustrating pages…' : 'Generate all images'}</button><button className="primary-small" onClick={() => setStep('read')}>Open storybook →</button></div>
            </div>
            <div className="story-meta">
              <div><small>Starring</small><strong>{story.characterBible?.name}</strong></div>
              <div><small>Visual style</small><strong>{form.style}</strong></div>
              <div><small>Gentle takeaway</small><strong>{story.takeaway}</strong></div>
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
                      <h3>{story.title}</h3>
                      {story.characterBible?.name && <p>For {story.characterBible.name}</p>}
                    </div>
                  </>
                ) : (
                  <div className="cover-placeholder">
                    <span>Cover direction</span>
                    <h3>{story.title}</h3>
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
                  <div className="page-copy"><label>Page text</label><textarea value={page.text} onChange={(e) => updatePage(index, e.target.value)} /></div>
                </article>
              ))}
            </div>
            <div className="sticky-actions"><span className="save-status">{saveMessage}</span><button className="ghost" onClick={saveToLibrary}>Save to My Stories</button><button className="ghost" onClick={printStory}>Print / Save PDF</button><button className="primary-small" onClick={() => setStep('read')}>Read the story →</button></div>
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
            <div className="reader-toolbar"><button onClick={() => setStep('review')}>← Back to edit</button><span>{pageIndex + 1} / {story.pages.length}</span><div><button onClick={saveToLibrary}>Save</button><button onClick={printStory}>PDF</button></div></div>
            {story.coverImageUrl && (
              <div className="reader-cover-strip">
                <img src={story.coverImageUrl} alt={`Cover of ${story.title}`} />
                <div><small>Cover</small><strong>{story.title}</strong></div>
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
                <div className="reader-copy"><div className="tiny-title">{story.title}</div><p>{story.pages[pageIndex].text}</p></div>
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
              <div className="print-cover-title"><small>A Moonlit Story</small><h1>{story.title}</h1><p>{story.summary}</p></div>
            </article>
            {story.pages.map((page, index) => (
              <article className="print-page" key={`print-${page.pageNumber}`}>
                <div className="print-image">{page.imageUrl ? <img src={page.imageUrl} alt="" /> : <div className="print-placeholder">Illustration not generated</div>}</div>
                <div className="print-copy"><small>{story.title} · {index + 1}</small><p>{page.text}</p></div>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
