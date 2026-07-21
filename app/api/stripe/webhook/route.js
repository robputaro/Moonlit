import { NextResponse } from 'next/server';
import { getAdminClient, retrieveStripeSubscription, verifyStripeSignature } from '../../../../lib/billing-server';

export const runtime = 'nodejs';

function iso(seconds) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionIdFromInvoice(invoice) {
  const candidates = [
    invoice?.subscription,
    invoice?.parent?.subscription_details?.subscription,
    invoice?.subscription_details?.subscription,
    invoice?.lines?.data?.[0]?.subscription,
    invoice?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription
  ];
  const value = candidates.find(Boolean);
  return typeof value === 'string' ? value : value?.id || null;
}

async function resolveUserId(admin, object, subscription) {
  const explicit = object?.metadata?.user_id || object?.client_reference_id || subscription?.metadata?.user_id;
  if (explicit) return explicit;
  const customerId = typeof object?.customer === 'string' ? object.customer : object?.customer?.id;
  if (!customerId) return null;
  const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
  return data?.user_id || null;
}

async function upsertSubscription(admin, userId, customerId, subscription) {
  if (!userId || !subscription) return;
  const payload = {
    user_id: userId,
    stripe_customer_id: customerId || subscription.customer,
    stripe_subscription_id: subscription.id,
    plan: 'ami_monthly',
    status: subscription.status || 'inactive',
    current_period_start: iso(subscription.current_period_start),
    current_period_end: iso(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    member_print_discount_cents: 500,
    updated_at: new Date().toISOString()
  };
  const { error } = await admin.from('subscriptions').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function POST(request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!verifyStripeSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }
  let event;
  try { event = JSON.parse(payload); } catch { return NextResponse.json({ error: 'Invalid event.' }, { status: 400 }); }
  const admin = getAdminClient();
  const { data: existing } = await admin.from('stripe_webhook_events').select('event_id').eq('event_id', event.id).maybeSingle();
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  try {
    const object = event.data?.object;
    if (event.type === 'checkout.session.completed' && object?.mode === 'subscription') {
      const subscription = await retrieveStripeSubscription(object.subscription);
      const userId = await resolveUserId(admin, object, subscription);
      await upsertSubscription(admin, userId, object.customer, subscription);
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const userId = await resolveUserId(admin, object, object);
      await upsertSubscription(admin, userId, object.customer, object);
    }

    if (event.type === 'invoice.paid') {
      const subscriptionId = subscriptionIdFromInvoice(object);
      const subscription = await retrieveStripeSubscription(subscriptionId);
      const userId = await resolveUserId(admin, object, subscription);
      if (userId && subscription) {
        await upsertSubscription(admin, userId, object.customer, subscription);
        const { error: grantError } = await admin.rpc('grant_monthly_story_credits', {
          p_user_id: userId,
          p_invoice_id: object.id,
          p_amount: 2,
          p_cap: 4
        });
        if (grantError) throw grantError;
        const { error: referralError } = await admin.rpc('reward_paid_referral', {
          p_referred_user_id: userId,
          p_invoice_id: object.id,
          p_monthly_cap: 5
        });
        if (referralError) throw referralError;
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const subscriptionId = subscriptionIdFromInvoice(object);
      const subscription = await retrieveStripeSubscription(subscriptionId);
      const userId = await resolveUserId(admin, object, subscription);
      await upsertSubscription(admin, userId, object.customer, subscription);
    }

    const { error: eventError } = await admin.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString()
    });
    if (eventError && eventError.code !== '23505') throw eventError;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook failed:', event.type, error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
