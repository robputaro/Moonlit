import { NextResponse } from 'next/server';
import { getAdminClient, getAuthenticatedBillingUser } from '../../../../lib/billing-server';

export async function POST(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const { code } = await request.json();
    if (!code) return NextResponse.json({ captured: false });
    const admin = getAdminClient();
    const { data, error } = await admin.rpc('capture_ami_referral', { p_referred_user_id: auth.user.id, p_code: code });
    if (error) throw error;
    return NextResponse.json({ captured: Boolean(data) });
  } catch (error) {
    console.error('Referral capture failed:', error);
    return NextResponse.json({ error: 'AMI could not save that referral.' }, { status: 500 });
  }
}
