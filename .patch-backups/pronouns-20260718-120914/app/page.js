'use client';

import { useEffect, useMemo, useState } from 'react';

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

  const progress = useMemo(() => {
    if (step === 'create') return 1;
    if (step === 'review') return 2;
    if (step === 'read') return 3;
    return 0;
  }, [step]);

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

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function generateStory(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
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
      const response = await fetch('/api/illustrate', {
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
      const response = await fetch('/api/illustrate', {
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
      setSavedStories(await getSavedStories());
    } catch (err) {
      setError('Moonlit could not open the story library in this browser.');
    } finally {
      setLibraryLoading(false);
    }
  }

  async function openLibrary() {
    setStep('library');
    await refreshLibrary();
  }

  async function saveToLibrary() {
    if (!story) return;
    setError('');
    setSaveMessage('Saving…');
    try {
      const id = storyId || crypto.randomUUID();
      const now = new Date().toISOString();
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
      setStoryId(id);
      setStory((current) => ({ ...current, createdAt: current.createdAt || now }));
      setSaveMessage('Saved to My Stories');
      window.setTimeout(() => setSaveMessage(''), 2400);
    } catch (err) {
      console.error(err);
      setError('This story was too large for browser storage. Try saving after generating fewer images, or export it as a PDF.');
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
    if (!window.confirm('Remove this story from this browser?')) return;
    await removeSavedStory(id);
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
        <div className="header-actions-global"><button type="button" onClick={openLibrary}>My stories</button><div className="header-note">Made for little imaginations</div></div>
      </header>

      <section className="shell">
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
                <div className="child-shape">♟</div>
              </div>
            </section>

            <form className="builder-card" onSubmit={generateStory}>
              <div className="section-heading"><span>1</span><div><h2>Meet your storyteller</h2><p>The little person at the center of it all.</p></div></div>
              <div className="field-grid two">
                <label>Child's name<input required value={form.childName} onChange={(e) => update('childName', e.target.value)} placeholder="August" /></label>
                <label>Age<select value={form.age} onChange={(e) => update('age', e.target.value)}>{Array.from({length: 9}, (_, i) => <option key={i+2}>{i+2}</option>)}</select></label>
              </div>
              <div className="field-grid two">
                <label>Pronouns<select value={form.pronouns} onChange={(e) => update('pronouns', e.target.value)}><option value="use-name">Use child’s name only</option><option value="he/him">He/him</option><option value="she/her">She/her</option><option value="they/them">They/them</option></select></label>
                <label>Appearance <span className="optional">optional</span><input value={form.appearance} onChange={(e) => update('appearance', e.target.value)} placeholder="Curly brown hair, green pajamas" /></label>
              </div>

              <div className="divider"></div>
              <div className="section-heading"><span>2</span><div><h2>What is your child working through?</h2><p>Choose a real moment, or switch to a story made purely for fun.</p></div></div>
              <div className="mode-toggle">
                <button type="button" className={form.storyMode === 'Challenge' ? 'active' : ''} onClick={() => update('storyMode', 'Challenge')}>Challenge story</button>
                <button type="button" className={form.storyMode === 'Fun' ? 'active' : ''} onClick={() => update('storyMode', 'Fun')}>Just for fun</button>
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
              <div><div className="eyebrow">Saved in this browser</div><h1>My Stories</h1><p>Open a story, continue illustrating it, or save a printable copy.</p></div>
              <button className="primary-small" onClick={() => { setStory(null); setStoryId(null); setForm(emptyForm); setStep('create'); }}>Create a new story</button>
            </div>
            {error && <div className="error">{error}</div>}
            {libraryLoading ? (
              <div className="library-empty">Opening your story shelf…</div>
            ) : savedStories.length === 0 ? (
              <div className="library-empty"><span>☾</span><h2>Your shelf is waiting.</h2><p>Save a story after generating it and it will appear here on this browser.</p></div>
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
