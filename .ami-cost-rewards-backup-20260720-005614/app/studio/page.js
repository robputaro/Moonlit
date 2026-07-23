'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, supabaseConfigured } from '../../lib/supabase-browser';

const statusGroups = [
  ['New orders', ['new_order', 'details_needed']],
  ['In production', ['ready_to_generate', 'draft_in_progress', 'internal_review']],
  ['Customer review', ['proof_sent', 'revision_requested', 'approved']],
  ['Print queue', ['print_ready', 'submitted_to_lulu', 'in_production', 'shipped']],
];

export default function StudioPage() {
  const [user, setUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setMessage('Connect Supabase to use AMI Studio.');
      return undefined;
    }

    let cancelled = false;

    async function loadStudio() {
      const { data: sessionData } = await supabase.auth.getSession();
      const nextUser = sessionData.session?.user || null;
      if (cancelled) return;
      setUser(nextUser);

      if (!nextUser) {
        setLoading(false);
        return;
      }

      const configuredAdmin = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase();
      const emailMatches = configuredAdmin && nextUser.email?.toLowerCase() === configuredAdmin;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', nextUser.id)
        .maybeSingle();

      const canAccess = emailMatches || profile?.role === 'admin';
      if (cancelled) return;
      setAuthorized(canAccess);

      if (canAccess) {
        const { data, error } = await supabase
          .from('studio_orders')
          .select('id, customer_name, child_name, source, product_type, language, status, due_date, created_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (!cancelled) {
          if (error) setMessage('Studio is ready, but the order tables still need the supplied Supabase setup SQL.');
          else setOrders(data || []);
        }
      }
      if (!cancelled) setLoading(false);
    }

    loadStudio();
    const { data: listener } = supabase.auth.onAuthStateChange(() => loadStudio());
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <main className="platform-page"><div className="platform-shell"><p>Opening AMI Studio…</p></div></main>;

  if (!user) {
    return (
      <main className="platform-page">
        <div className="platform-shell platform-gate">
          <span className="platform-kicker">AMI Studio</span>
          <h1>Sign in to AMI first.</h1>
          <p>Studio is reserved for the AMI production team.</p>
          <Link className="platform-primary" href="/">Return to AMI</Link>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="platform-page">
        <div className="platform-shell platform-gate">
          <span className="platform-kicker">AMI Studio</span>
          <h1>This account does not have Studio access.</h1>
          <p>Signed in as {user.email}</p>
          <Link className="platform-primary" href="/">Return to AMI</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <div className="platform-shell">
        <header className="studio-header">
          <div>
            <span className="platform-kicker">Private production workspace</span>
            <h1>AMI Studio</h1>
            <p>Create Etsy and premium orders, manage proofs, and prepare approved books for print.</p>
          </div>
          <div className="studio-header-actions">
            <Link href="/">Public AMI</Link>
            <button type="button" disabled title="Project intake arrives in Studio v1.1">New project</button>
          </div>
        </header>

        {message && <div className="platform-notice">{message}</div>}

        <section className="studio-metrics">
          {statusGroups.map(([label, statuses]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{orders.filter((order) => statuses.includes(order.status)).length}</strong>
            </article>
          ))}
        </section>

        <section className="studio-board">
          <div className="studio-board-heading">
            <div><span className="platform-kicker">Projects</span><h2>Production queue</h2></div>
            <span>{orders.length} total</span>
          </div>

          {orders.length === 0 ? (
            <div className="studio-empty">
              <strong>No Studio projects yet.</strong>
              <p>The foundation is connected. Manual Etsy order intake, versions, and proof links are the next Studio milestone.</p>
            </div>
          ) : (
            <div className="studio-order-list">
              {orders.map((order) => (
                <article key={order.id}>
                  <div><small>{order.source || 'AMI'} · {order.product_type || 'Keepsake'}</small><h3>{order.child_name || 'Untitled child project'}</h3><p>{order.customer_name || 'Customer details pending'}</p></div>
                  <div><span className="studio-status">{String(order.status || 'new_order').replaceAll('_', ' ')}</span><small>{order.due_date ? `Due ${new Date(order.due_date).toLocaleDateString()}` : 'No due date'}</small></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
