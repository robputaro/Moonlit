import { NextResponse } from 'next/server';
import { getAdminClient, getAuthenticatedBillingUser, siteUrl, stripeRequest } from '../../../../lib/billing-server';

export async function POST(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user) return NextResponse.json({ error: 'Please sign in before starting a membership.' }, { status: 401 });
    const priceId = process.env.STRIPE_AMI_MONTHLY_PRICE_ID;
    if (!priceId) return NextResponse.json({ error: 'The AMI membership price is not configured yet.' }, { status: 503 });
    const admin = getAdminClient();
    const { data: existing } = await admin.from('subscriptions').select('stripe_customer_id,status').eq('user_id', auth.user.id).maybeSingle();
    if (['active', 'trialing', 'past_due'].includes(existing?.status)) {
      return NextResponse.json({ error: 'This account already has a membership. Use Manage membership instead.' }, { status: 409 });
    }
    const base = siteUrl(request);
    const body = {
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${base}/membership?checkout=success`,
      cancel_url: `${base}/membership?checkout=cancelled`,
      client_reference_id: auth.user.id,
      'metadata[user_id]': auth.user.id,
      'subscription_data[metadata][user_id]': auth.user.id,
      allow_promotion_codes: 'true'
    };
    if (existing?.stripe_customer_id) body.customer = existing.stripe_customer_id;
    else body.customer_email = auth.user.email || auth.profile?.email || '';
    const session = await stripeRequest('/checkout/sessions', { body });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session failed:', error);
    return NextResponse.json({ error: error.message || 'AMI could not start checkout.' }, { status: 500 });
  }
}
