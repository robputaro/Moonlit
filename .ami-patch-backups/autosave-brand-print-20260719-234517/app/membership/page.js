'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SiteFooter from '../components/SiteFooter';
import { supabase, supabaseConfigured } from '../../lib/supabase-browser';

export default function MembershipPage() {
  const [user, setUser] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function token() {
    if (!supabaseConfigured) return '';
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function loadBilling() {
    const accessToken = await token();
    if (!accessToken) { setBilling(null); setLoading(false); return; }
    const response = await fetch('/api/billing/status', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const data = await response.json();
    setBilling(response.ok ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return undefined; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); loadBilling(); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      window.setTimeout(loadBilling, 0);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') setMessage('Membership checkout completed. Credits may take a few seconds to appear.');
    if (params.get('checkout') === 'cancelled') setMessage('Checkout was cancelled. Nothing was charged.');
    return () => listener.subscription.unsubscribe();
  }, []);

  async function startAction(path) {
    setActionLoading(true);
    setMessage('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Sign in from the Ami home page first.');
      const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ami could not continue.');
      window.location.href = data.url;
    } catch (error) {
      setMessage(error.message);
      setActionLoading(false);
    }
  }

  const active = ['active', 'trialing', 'past_due'].includes(billing?.subscription?.status);
  const periodEnd = billing?.subscription?.currentPeriodEnd
    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <main className="platform-page membership-page">
      <div className="platform-shell membership-shell">
        <header className="membership-hero">
          <Link href="/" className="membership-back">← Stories by Ami</Link>
          <span className="platform-kicker">Stories for the moments you are living now</span>
          <h1>Two new personalized stories every month.</h1>
          <p>Create one for a real-life moment and one purely for fun. Save every story, read it anywhere, and turn your favorites into printed keepsakes.</p>
        </header>

        <section className="membership-card">
          <div className="membership-price"><span>$</span><strong>9.99</strong><small>/ month</small></div>
          <h2>Ami Membership</h2>
          <ul>
            <li>2 digital story credits each month</li><li>English, Spanish, or bilingual books</li><li>Reader mode and downloadable PDF</li><li>Cloud story library</li><li>3 individual page regenerations per book</li><li>1 cover regeneration per book</li><li>Unused credits roll over up to 4</li><li>$5 off standard hardcover copies</li>
          </ul>

          {loading ? <div className="membership-status">Loading membership…</div> : user ? (
            <div className="membership-account-panel">
              <div><span>Story credits</span><strong>{billing?.isAdmin ? 'Unlimited' : billing?.credits ?? 0}</strong></div>
              <div><span>Status</span><strong>{billing?.isAdmin ? 'Admin access' : active ? 'Active member' : 'Not active'}</strong></div>
              {periodEnd && <small>{billing?.subscription?.cancelAtPeriodEnd ? `Access ends ${periodEnd}` : `Next billing date ${periodEnd}`}</small>}
              {active ? <button type="button" onClick={() => startAction('/api/billing/portal')} disabled={actionLoading}>{actionLoading ? 'Opening…' : 'Manage membership'}</button> : <button type="button" className="membership-join-button" onClick={() => startAction('/api/billing/checkout')} disabled={actionLoading}>{actionLoading ? 'Opening secure checkout…' : 'Join Ami Membership'}</button>}
            </div>
          ) : (
            <div className="membership-account-panel"><p>Sign in on the Ami home page, then return here to start your membership.</p><Link className="membership-signin-link" href="/">Sign in or create an account</Link></div>
          )}
          {message && <div className="membership-message">{message}</div>}
          <small>Cancel anytime. Cancellation takes effect at the end of the current billing period.</small>
        </section>

        <section className="membership-compare">
          <article><span>One-time digital story</span><strong>$12.99</strong><p>A complete personalized story without a subscription. Checkout coming in a later milestone.</p></article>
          <article><span>Member hardcover</span><strong>$34.99</strong><p>Standard hardcover member price, plus shipping.</p></article>
          <article><span>Ami Studio</span><strong>From $79</strong><p>Human-created and reviewed premium keepsakes.</p></article>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
