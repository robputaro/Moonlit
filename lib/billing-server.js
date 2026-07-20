import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role is not configured.');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getAuthenticatedBillingUser(request) {
  const { authenticateRequest } = await import('./supabase-server');
  const auth = await authenticateRequest(request);
  if (!auth.configured || !auth.user) return { user: null, profile: null, isAdmin: false };
  const admin = getAdminClient();
  const { data: profile } = await admin.from('profiles').select('id,email,role').eq('id', auth.user.id).maybeSingle();
  return { user: auth.user, profile, isAdmin: profile?.role === 'admin' };
}

export async function stripeRequest(path, { method = 'POST', body } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured.');
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe request failed.');
  return data;
}

export function siteUrl(request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || request?.headers?.get('origin') || 'http://localhost:3000').replace(/\/$/, '');
}

export function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const parts = signatureHeader.split(',').map((part) => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return signatures.some((candidate) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
    } catch {
      return false;
    }
  });
}

export async function retrieveStripeSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  return stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'GET' });
}
