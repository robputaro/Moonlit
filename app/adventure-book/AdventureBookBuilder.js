'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteFooter from '../components/SiteFooter';
import { supabase, supabaseConfigured } from '../../lib/supabase-browser';
import { ACTIVITY_LIBRARY_VERSION, ADVENTURE_THEMES, buildAdventurePlan, getAgeBand } from '../../lib/adventure-activities';
import { downloadAdventureBook } from '../../lib/adventure-pdf';

const DRAFT_KEY = 'ami-adventure-book-draft-v1';

function canonicalSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '');
}

export default function AdventureBookBuilder({ enabled }) {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ childName: '', age: '4', pronouns: 'use-name', appearance: '', interests: '', themeId: 'dinosaurs' });
  const [stage, setStage] = useState('setup');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authMode, setAuthMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const band = useMemo(() => getAgeBand(form.age), [form.age]);
  const selectedTheme = ADVENTURE_THEMES.find((theme) => theme.id === form.themeId) || ADVENTURE_THEMES[0];

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
      if (saved?.form) setForm((current) => ({ ...current, ...saved.form }));
    } catch {}
    if (!supabaseConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, savedAt: new Date().toISOString() })); } catch {}
  }, [form]);

  async function authFetch(path, options = {}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return fetch(path, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthLoading(true);setMessage('');
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (authMode === 'signup' && !result.data.session) setMessage('Check your email to verify your account, then return here. Your book setup is saved.');
      else setMessage('You’re signed in. Your Adventure Book is ready to create.');
    } catch (error) { setMessage(error.message || 'AMI could not sign you in.'); }
    finally { setAuthLoading(false); }
  }

  async function googleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${canonicalSiteUrl()}/adventure-book`, queryParams: { prompt: 'select_account' } } });
    if (error) setMessage(error.message);
  }

  async function createBook() {
    if (!form.childName.trim()) { setMessage('Add the child’s first name or nickname.'); return; }
    if (!user) { setStage('account'); setMessage('Create a free parent account to make and save the book.'); return; }
    setLoading(true);setMessage('AMI is choosing age-appropriate activities…');
    const plan = buildAdventurePlan(form);
    try {
      const response = await authFetch('/api/adventure-books/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ageBand: band.id, libraryVersion: ACTIVITY_LIBRARY_VERSION, pagePlan: plan.map(({ id, type, variant, pageNumber }) => ({ id, type, variant, pageNumber })) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AMI could not create the Adventure Book.');
      const nextForm = data.existing ? {
        ...form,
        childName: data.project.childName,
        age: String(data.project.age),
        pronouns: data.project.pronouns || 'use-name',
        appearance: data.project.appearance || '',
        interests: data.project.interests || '',
        themeId: data.project.themeId || 'dinosaurs'
      } : form;
      const resolvedPlan = buildAdventurePlan(nextForm);
      setForm(nextForm);
      setProject({ ...data.project, plan: resolvedPlan });setStage('ready');
      window.localStorage.removeItem(DRAFT_KEY);
      setMessage(data.existing ? 'Your original free Adventure Book has been reopened.' : '');
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }

  function download() {
    downloadAdventureBook({ ...form, plan: project?.plan || buildAdventurePlan(form) });
  }

  if (!enabled) {
    return <main className="adventure-page"><header className="adventure-header"><Link href="/" className="ami-logo-link"><img src="/ami-logo.svg" alt="AMI" /></Link></header><section className="adventure-disabled"><span>COMING SOON</span><h1>A new kind of AMI adventure is being created.</h1><p>Personalized printable activities are on the way.</p><Link href="/">Create an AMI Storybook</Link></section><SiteFooter /></main>;
  }

  return (
    <main className="adventure-page">
      <header className="adventure-header"><Link href="/" className="ami-logo-link"><img src="/ami-logo.svg" alt="AMI" /></Link><nav><Link href="/">Storybooks</Link><Link href="/membership">Membership</Link>{user && <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>}</nav></header>
      <section className="adventure-hero">
        <div><span className="adventure-kicker">A FREE PERSONALIZED PRINTABLE</span><h1>Twenty pages made for <em>their</em> imagination.</h1><p>Create an age-appropriate AMI Adventure Book filled with coloring, puzzles, drawing, tracing, and creative play—personalized for your child.</p><div className="adventure-trust"><span>Free digital PDF</span><span>One per verified account</span><span>Made for ages 2–10</span></div></div>
        <div className={`adventure-cover-preview theme-${selectedTheme.id}`}><small>AMI ADVENTURE BOOK</small><div className="adventure-cover-symbol">{selectedTheme.id === 'outer-space' ? '✦' : selectedTheme.id === 'princess-magic' ? '♕' : '◒'}</div><strong>{form.childName ? `${form.childName}’s` : 'Your Child’s'}</strong><span>{selectedTheme.name}</span><i>{band.name}</i></div>
      </section>

      <section className="adventure-builder-shell">
        <div className="adventure-progress"><span className={stage === 'setup' ? 'active' : ''}>1 · Child</span><span className={stage === 'account' ? 'active' : ''}>2 · Account</span><span className={stage === 'ready' ? 'active' : ''}>3 · Download</span></div>
        {stage === 'setup' && <div className="adventure-builder-card">
          <div className="adventure-section-title"><span>01</span><div><h2>Who is this adventure for?</h2><p>Use a first name or nickname. AMI adjusts every activity to the selected age band.</p></div></div>
          <div className="adventure-fields two"><label>Child’s first name or nickname<input value={form.childName} onChange={(e)=>setForm({...form,childName:e.target.value})} placeholder="August" /></label><label>Age<select value={form.age} onChange={(e)=>setForm({...form,age:e.target.value})}>{[2,3,4,5,6,7,8,9,10].map(age=><option key={age} value={age}>{age} years old</option>)}</select><small>{band.name} · {band.reading}</small></label></div>
          <div className="adventure-fields two"><label>Favorite things <span>optional</span><input value={form.interests} onChange={(e)=>setForm({...form,interests:e.target.value})} placeholder="Trucks, purple, our dog Max…" /></label><label>Appearance notes <span>optional, for future hero art</span><input value={form.appearance} onChange={(e)=>setForm({...form,appearance:e.target.value})} placeholder="Curly brown hair, green glasses…" /></label></div>
          <div className="adventure-section-title compact"><span>02</span><div><h2>Choose their first world</h2><p>Each theme has its own reusable, age-aware activity pool.</p></div></div>
          <div className="adventure-theme-grid">{ADVENTURE_THEMES.map(theme=><button type="button" key={theme.id} className={form.themeId===theme.id?'selected':''} onClick={()=>setForm({...form,themeId:theme.id})}><div className={`theme-art theme-${theme.id}`}><b>{theme.id==='outer-space'?'✦':theme.id==='princess-magic'?'♕':'◒'}</b></div><strong>{theme.shortName}</strong><small>{theme.name}</small>{form.themeId===theme.id&&<i>✓</i>}</button>)}</div>
          {message && <div className="adventure-message">{message}</div>}
          <button type="button" className="adventure-primary" onClick={createBook}>Create the free Adventure Book <span>→</span></button>
        </div>}

        {stage === 'account' && <div className="adventure-builder-card adventure-account-card"><span className="adventure-kicker">SAVE THEIR ADVENTURE</span><h2>{user ? 'Your account is ready.' : authMode==='signup' ? 'Create your free parent account.' : 'Welcome back.'}</h2><p>Verification protects the one-free-book offer and keeps your child profiles and creations together.</p>{!user ? <><button type="button" className="adventure-google" onClick={googleSignIn}>Continue with Google</button><div className="adventure-auth-divider"><span>or use email</span></div><form onSubmit={submitAuth}><label>Email<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></label><label>Password<input type="password" minLength="8" required value={password} onChange={(e)=>setPassword(e.target.value)} /></label><button className="adventure-primary" disabled={authLoading}>{authLoading?'Please wait…':authMode==='signup'?'Create my account':'Sign in'}</button></form><button type="button" className="adventure-auth-switch" onClick={()=>setAuthMode(authMode==='signup'?'signin':'signup')}>{authMode==='signup'?'Already have an account? Sign in':'Need an account? Create one'}</button></> : <button type="button" className="adventure-primary" onClick={createBook} disabled={loading}>{loading?'Building the page plan…':'Create my Adventure Book →'}</button>}{message&&<div className="adventure-message">{message}</div>}<button type="button" className="adventure-back" onClick={()=>setStage('setup')}>← Edit book details</button></div>}

        {stage === 'ready' && <div className="adventure-ready-card"><div className={`adventure-ready-cover theme-${selectedTheme.id}`}><small>AMI ADVENTURE BOOK</small><strong>{form.childName}’s</strong><span>{selectedTheme.name}</span><i>20 PAGES</i></div><div><span className="adventure-kicker">READY TO PRINT</span><h2>{form.childName}’s Adventure Book is ready.</h2><p>Twenty US Letter pages, assembled from AMI’s reusable activity library for {band.name.toLowerCase()}. The cover is colorful and the activities are ink-friendly black and white.</p><ul><li>Personalized cover and ownership page</li><li>Age-appropriate activity sequence</li><li>Home-print-friendly PDF</li><li>Created with AMI</li></ul><button type="button" className="adventure-primary" onClick={download}>Download the free PDF ↓</button><div className="adventure-upsells"><div><span>COMING NEXT</span><strong>Professionally printed 50-page edition</strong><small>Full-color glossy cover · black-and-white interior</small></div><Link href="/">Turn their world into an AMI Storybook →</Link></div></div></div>}
      </section>
      <section className="adventure-how"><span className="adventure-kicker">BUILT TO GROW WITH THEM</span><h2>One child profile. A whole family of creations.</h2><div><article><b>01</b><strong>Create once</strong><p>Names, ages, interests, and character details can carry into future AMI products.</p></article><article><b>02</b><strong>Play right away</strong><p>Download a complete, age-appropriate printable without waiting for 20 new AI images.</p></article><article><b>03</b><strong>Keep exploring</strong><p>Continue into storybooks, seasonal packs, printed books, and future learning adventures.</p></article></div></section>
      <SiteFooter />
    </main>
  );
}
