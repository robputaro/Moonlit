import { NextResponse } from 'next/server';
import { getAdminClient, getAuthenticatedBillingUser, siteUrl, stripeRequest } from '../../../../lib/billing-server';

export async function POST(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
    const admin = getAdminClient();
    const { data: subscription } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', auth.user.id).maybeSingle();
    if (!subscription?.stripe_customer_id) return NextResponse.json({ error: 'No Stripe membership was found for this account.' }, { status: 404 });
    const session = await stripeRequest('/billing_portal/sessions', {
      body: { customer: subscription.stripe_customer_id, return_url: `${siteUrl(request)}/membership` }
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal session failed:', error);
    return NextResponse.json({ error: error.message || 'Ami could not open membership management.' }, { status: 500 });
  }
}
