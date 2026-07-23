import { NextResponse } from 'next/server';
import { getAdminClient, getAuthenticatedBillingUser } from '../../../../lib/billing-server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user) return NextResponse.json({ signedIn: false, credits: 0, subscription: null, isAdmin: false });
    const admin = getAdminClient();
    const [{ data: subscription }, { data: ledger }] = await Promise.all([
      admin.from('subscriptions').select('*').eq('user_id', auth.user.id).maybeSingle(),
      admin.from('story_credit_ledger').select('amount').eq('user_id', auth.user.id)
    ]);
    const credits = Math.max(0, (ledger || []).reduce((sum, row) => sum + Number(row.amount || 0), 0));
    return NextResponse.json({
      signedIn: true,
      credits,
      isAdmin: auth.isAdmin,
      subscription: subscription ? {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
        memberPrintDiscountCents: subscription.member_print_discount_cents
      } : null
    });
  } catch (error) {
    console.error('Billing status failed:', error);
    return NextResponse.json({ error: 'Ami could not load membership details.' }, { status: 500 });
  }
}
