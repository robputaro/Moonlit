import { NextResponse } from 'next/server';
import { getAdminClient, getAuthenticatedBillingUser, siteUrl } from '../../../../lib/billing-server';

export async function GET(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user) return NextResponse.json({ signedIn: false, miniAvailable: false });
    const admin = getAdminClient();
    const [{ data: entitlement }, { data: referrals }] = await Promise.all([
      admin.from('mini_story_entitlements').select('status,generation_id,used_at').eq('user_id', auth.user.id).maybeSingle(),
      admin.from('referrals').select('status,created_at,rewarded_at').eq('referrer_user_id', auth.user.id).order('created_at', { ascending: false }).limit(25)
    ]);
    const { data: code, error } = await admin.rpc('ensure_ami_referral_code', { p_user_id: auth.user.id });
    if (error) throw error;
    const emailVerified = Boolean(auth.user.email_confirmed_at || auth.user.confirmed_at || auth.user.app_metadata?.provider === 'google');
    return NextResponse.json({
      signedIn: true,
      emailVerified,
      miniStatus: entitlement?.status || 'available',
      miniAvailable: emailVerified && (!entitlement || entitlement.status === 'available'),
      referralCode: code,
      referralUrl: `${siteUrl(request)}/?ref=${encodeURIComponent(code)}`,
      referralStats: {
        signedUp: (referrals || []).length,
        paid: (referrals || []).filter((item) => ['paid','rewarded'].includes(item.status)).length,
        rewarded: (referrals || []).filter((item) => item.status === 'rewarded').length
      }
    });
  } catch (error) {
    console.error('Referral status failed:', error);
    return NextResponse.json({ error: 'AMI could not load referral status.' }, { status: 500 });
  }
}
