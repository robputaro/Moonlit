import { NextResponse } from 'next/server';
import { getAuthenticatedBillingUser, getAdminClient } from '../../../../lib/billing-server';

export async function GET(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user || !auth.isAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    const admin = getAdminClient();
    const [{ data: usage, error: usageError }, { data: rewards, error: rewardsError }] = await Promise.all([
      admin.from('ai_usage_events').select('story_id,operation,provider,model,status,input_tokens,output_tokens,image_count,estimated_cost_micros,created_at').order('created_at', { ascending: false }).limit(2000),
      admin.from('ami_reward_ledger').select('id,user_id,reward_type,quantity,consumed_quantity,trigger,metadata,created_at,expires_at').order('created_at', { ascending: false }).limit(250)
    ]);
    if (usageError) throw usageError;
    if (rewardsError) throw rewardsError;
    const rows = usage || [];
    const totalMicros = rows.reduce((sum,row) => sum + Number(row.estimated_cost_micros || 0), 0);
    const successful = rows.filter(row => row.status === 'succeeded');
    const storyMap = new Map();
    for (const row of successful) {
      if (!row.story_id) continue;
      storyMap.set(row.story_id, (storyMap.get(row.story_id) || 0) + Number(row.estimated_cost_micros || 0));
    }
    const recentStories = [...storyMap.entries()].map(([storyId,costMicros]) => ({ storyId, costMicros })).sort((a,b) => b.costMicros-a.costMicros).slice(0,20);
    return NextResponse.json({
      totals: {
        estimatedCostMicros: totalMicros,
        calls: rows.length,
        failedCalls: rows.filter(row => row.status === 'failed').length,
        images: rows.reduce((sum,row) => sum + Number(row.image_count || 0), 0),
        trackedStories: storyMap.size,
        averageStoryCostMicros: storyMap.size ? Math.round([...storyMap.values()].reduce((a,b)=>a+b,0)/storyMap.size) : 0
      },
      recentUsage: rows.slice(0,50), recentStories, rewards: rewards || []
    });
  } catch (error) {
    console.error('Studio insights failed:', error);
    return NextResponse.json({ error: 'Cost tracking tables may still need the AMI migration.' }, { status: 500 });
  }
}
