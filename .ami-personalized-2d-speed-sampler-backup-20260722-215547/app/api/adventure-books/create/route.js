import { NextResponse } from 'next/server';
import { getAdminClient, getAuthenticatedBillingUser } from '../../../../lib/billing-server';

function clean(value, max = 200) { return String(value || '').trim().slice(0, max); }

async function loadExistingProject(admin, userId) {
  const { data: entitlement } = await admin.from('adventure_book_entitlements').select('status,project_id,used_at').eq('user_id', userId).maybeSingle();
  if (entitlement?.status !== 'used' || !entitlement.project_id) return null;
  const { data: project } = await admin.from('ami_projects').select('id,title,theme,status,project_data,child_profiles(first_name,age,age_band,pronouns,appearance_notes,interests)').eq('id', entitlement.project_id).maybeSingle();
  if (!project) return null;
  const child = Array.isArray(project.child_profiles) ? project.child_profiles[0] : project.child_profiles;
  return {
    id: project.id, title: project.title, themeId: project.theme, status: project.status,
    childName: child?.first_name || 'Explorer', age: child?.age || 4, ageBand: child?.age_band || project.project_data?.age_band,
    pronouns: child?.pronouns || 'use-name', appearance: child?.appearance_notes || '', interests: child?.interests || '',
    libraryVersion: project.project_data?.library_version, pagePlan: project.project_data?.page_plan || [], usedAt: entitlement.used_at
  };
}

export async function GET(request) {
  try {
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user) return NextResponse.json({ signedIn: false }, { status: 401 });
    const admin = getAdminClient();
    const existingProject = await loadExistingProject(admin, auth.user.id);
    return NextResponse.json({ signedIn: true, emailVerified: Boolean(auth.user.email_confirmed_at || auth.user.confirmed_at || auth.user.app_metadata?.provider === 'google'), entitlement: existingProject ? { status: 'used', projectId: existingProject.id, usedAt: existingProject.usedAt } : { status: 'available' }, project: existingProject });
  } catch (error) {
    console.error('Adventure entitlement status failed:', error);
    return NextResponse.json({ error: 'AMI could not load the Adventure Book status.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (process.env.NEXT_PUBLIC_AMI_ADVENTURE_BOOKS_ENABLED !== 'true') return NextResponse.json({ error: 'Adventure Books are not available yet.' }, { status: 404 });
    const auth = await getAuthenticatedBillingUser(request);
    if (!auth.user) return NextResponse.json({ error: 'Create or sign in to a parent account first.' }, { status: 401 });
    const emailVerified = Boolean(auth.user.email_confirmed_at || auth.user.confirmed_at || auth.user.app_metadata?.provider === 'google');
    if (!emailVerified) return NextResponse.json({ error: 'Confirm your email before creating the free Adventure Book.' }, { status: 403 });
    const input = await request.json();
    const childName = clean(input.childName, 40);
    const age = Math.max(2, Math.min(10, Number(input.age) || 4));
    const allowedThemes = ['dinosaurs','outer-space','princess-magic'];
    if (!childName) return NextResponse.json({ error: 'Add the child’s first name or nickname.' }, { status: 400 });
    if (!allowedThemes.includes(input.themeId)) return NextResponse.json({ error: 'Choose a valid Adventure Book theme.' }, { status: 400 });
    const admin = getAdminClient();
    const existingProject = await loadExistingProject(admin, auth.user.id);
    if (existingProject) return NextResponse.json({ project: existingProject, existing: true });
    const { data, error } = await admin.rpc('create_free_ami_adventure_book', {
      p_user_id: auth.user.id,
      p_child_name: childName,
      p_age: age,
      p_age_band: clean(input.ageBand, 10),
      p_pronouns: clean(input.pronouns, 30),
      p_appearance: clean(input.appearance, 500),
      p_interests: clean(input.interests, 500),
      p_theme: input.themeId,
      p_library_version: clean(input.libraryVersion, 80),
      p_page_plan: Array.isArray(input.pagePlan) ? input.pagePlan.slice(0, 20) : []
    });
    if (error) {
      const message = error.message || '';
      if (message.includes('ADVENTURE_BOOK_ALREADY_USED')) return NextResponse.json({ error: 'This account has already created its free AMI Adventure Book.' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ project: { id: data, childName, age, ageBand: input.ageBand, themeId: input.themeId, status: 'complete' } });
  } catch (error) {
    console.error('Adventure Book creation failed:', error);
    return NextResponse.json({ error: 'AMI could not create the Adventure Book. The Adventure Book migration may still need to be run.' }, { status: 500 });
  }
}
