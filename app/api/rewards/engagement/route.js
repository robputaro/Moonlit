import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../../lib/supabase-server';
import { getAdminClient } from '../../../../lib/billing-server';

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    const input = await request.json();
    const storyId = String(input.storyId || '');
    const answerCount = Number(input.answerCount || 0);
    if (!storyId || answerCount < 3) return NextResponse.json({ granted: false });
    const admin = getAdminClient();
    const { data, error } = await admin.rpc('grant_ami_reward', {
      p_user_id: auth.user.id,
      p_reward_type: 'extra_regeneration',
      p_quantity: 1,
      p_trigger: 'engagement_three_answers',
      p_reference_id: storyId,
      p_metadata: { message: 'A little surprise from AMI', answer_count: answerCount },
      p_granted_by: null,
      p_expires_at: null
    });
    if (error) throw error;
    return NextResponse.json({ granted: true, reward: { type: 'extra_regeneration', quantity: 1, id: data?.id || null }, message: 'A little surprise from AMI: one extra page regeneration.' });
  } catch (error) {
    console.error('Engagement reward failed:', error);
    return NextResponse.json({ error: 'AMI could not save that surprise yet.' }, { status: 500 });
  }
}
