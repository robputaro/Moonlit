import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedBillingUser, getAdminClient } from '../../../../lib/billing-server';

export async function POST(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user || !auth.isAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    const input = await request.json();
    const email = String(input.email || '').trim().toLowerCase();
    const rewardType = String(input.rewardType || 'extra_regeneration');
    const quantity = Math.max(1, Math.min(20, Number(input.quantity) || 1));
    if (!email) return NextResponse.json({ error: 'Enter a user email.' }, { status: 400 });
    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,email').ilike('email', email).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: 'No AMI account was found for that email.' }, { status: 404 });
    const referenceId = `admin-${crypto.randomUUID()}`;
    if (rewardType === 'story_credit') {
      const { error } = await admin.from('story_credit_ledger').insert({ user_id: profile.id, amount: quantity, reason: 'AMI Studio bonus credit', reference_type: 'ami_admin_reward', reference_id: referenceId });
      if (error) throw error;
    }
    const metadata = rewardType === 'theme_unlock' ? { theme: String(input.theme || 'Seasonal Surprise') } : {};
    const { data, error } = await admin.rpc('grant_ami_reward', {
      p_user_id: profile.id, p_reward_type: rewardType, p_quantity: quantity,
      p_trigger: 'ami_studio_manual', p_reference_id: referenceId,
      p_metadata: metadata, p_granted_by: auth.user.id, p_expires_at: null
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, reward: data, email: profile.email });
  } catch (error) {
    console.error('Studio reward grant failed:', error);
    return NextResponse.json({ error: error.message || 'Reward could not be granted.' }, { status: 500 });
  }
}
