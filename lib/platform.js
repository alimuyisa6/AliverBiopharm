 import { supabase, isAdmin, canAccessLevel } from './core.js';
import { parseAndValidateBody, requireSuperAdmin, SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'bootstrap': return bootstrap(req, res, ctx);
      case 'config': return getPlatformConfig(req, res);
      case 'header': return getHeader(req, res);
      case 'footer': return getFooter(req, res);
      case 'landing': return getLandingPage(req, res);
      case 'onboarding_config': return getOnboardingConfig(req, res);
      case 'ui_components': return getUIComponents(req, res);
      case 'nav_items': return getNavItems(req, res, ctx);
      case 'sections': return getSections(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    requireSuperAdmin(ctx);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'update_config': return updatePlatformConfig(body, res);
      case 'update_header': return updateHeader(body, res);
      case 'update_footer': return updateFooter(body, res);
      case 'update_landing': return updateLandingPage(body, res);
      case 'update_onboarding': return updateOnboardingConfig(body, res);
      case 'update_ui_component': return updateUIComponent(body, res);
      case 'update_universal': return updateUniversalConfig(body, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function bootstrap(req, res, ctx) {
  const { level } = req.query;
  const effectiveLevel = level || 'O-Level';
  let userProfile = null, userEmail = null, isAdminUser = false, canAccess = true;

  if (ctx.authenticated && ctx.userId) {
    const adminData = await isAdmin(ctx.userId, 'unknown');
    isAdminUser = !!(adminData && adminData.admin_role);
    const { data: { user } } = await supabase.auth.admin.getUserById(ctx.userId);
    userEmail = user?.email || null;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    userProfile = profile;
    if (!isAdminUser) {
      canAccess = await canAccessLevel(ctx.userId, effectiveLevel);
      if (profile?.role === 'teacher' && profile?.is_approved_teacher && profile?.approved_track === 'ALL') {
        canAccess = true;
      }
    }
  }

  const [universal, platform, header, footer, navItems, uiComponents, levelData, groups] = await Promise.all([
    supabase.from('universal_config').select('*').limit(1).maybeSingle(),
    supabase.from('platform_configs').select('*').eq('level_id', effectiveLevel).maybeSingle(),
    supabase.from('platform_headers').select('*').eq('level_id', effectiveLevel).maybeSingle(),
    supabase.from('platform_footers').select('*').eq('level_id', effectiveLevel).maybeSingle(),
    supabase.from('universal_nav_items').select('*').order('position', { ascending: true }),
    supabase.from('ui_components').select('*').or(`level_id.eq.${effectiveLevel},level_id.is.null`).order('component_key'),
    supabase.from('curriculum_levels').select('*').eq('id', effectiveLevel).maybeSingle(),
    supabase.from('curriculum_groups').select('*').eq('level_id', effectiveLevel).eq('is_active', true).order('sequence_order')
  ]);

  return res.status(200).json({
    universal: universal?.data || null,
    platform: platform?.data || null,
    header: header?.data || null,
    footer: footer?.data || null,
    nav_items: navItems?.data || [],
    ui_components: uiComponents?.data || [],
    level: levelData?.data || null,
    groups: groups?.data || [],
    user: userProfile ? {
      id: ctx.userId,
      email: userEmail,
      role: userProfile.role,
      track: userProfile.track,
      class_name: userProfile.class_name,
      onboarding_completed: userProfile.onboarding_completed,
      is_approved_teacher: userProfile.is_approved_teacher,
      approved_track: userProfile.approved_track,
      is_admin: isAdminUser,
      profile_picture_url: userProfile.profile_picture_url
    } : null,
    access: { can_access: canAccess, is_authenticated: ctx.authenticated }
  });
}

async function getPlatformConfig(req, res) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level required', 400);
  const { data } = await supabase.from('platform_configs').select('*').eq('level_id', level).maybeSingle();
  return res.status(200).json(data || null);
}

async function getHeader(req, res) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level required', 400);
  const { data } = await supabase.from('platform_headers').select('*').eq('level_id', level).maybeSingle();
  return res.status(200).json(data || null);
}

async function getFooter(req, res) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level required', 400);
  const { data } = await supabase.from('platform_footers').select('*').eq('level_id', level).maybeSingle();
  return res.status(200).json(data || null);
}

async function getLandingPage(req, res) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level required', 400);
  const { data } = await supabase.from('landing_pages').select('*').eq('level_id', level).maybeSingle();
  return res.status(200).json(data || null);
}

async function getOnboardingConfig(req, res) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level required', 400);
  const { data } = await supabase.from('onboarding_configs').select('*').eq('level_id', level).maybeSingle();
  return res.status(200).json(data || null);
}

async function getUIComponents(req, res) {
  const { level } = req.query;
  let query = supabase.from('ui_components').select('*');
  if (level) query = query.or(`level_id.eq.${level},level_id.is.null`);
  else query = query.is('level_id', null);
  const { data } = await query.order('component_key');
  return res.status(200).json(data || []);
}

async function getNavItems(req, res, ctx) {
  const { data } = await supabase.from('universal_nav_items').select('*').order('position');
  if (!ctx.authenticated) return res.status(200).json((data || []).filter(item => !item.auth_required));
  return res.status(200).json(data || []);
}

async function getSections(req, res) {
  const { level_id } = req.query;
  if (!level_id) throw new SecurityError('level_id required', 400);
  const { data, error } = await supabase
    .from('platform_sections')
    .select('section_key, content')
    .eq('level_id', level_id)
    .eq('is_active', true);
  if (error) throw new SecurityError('Failed to fetch sections', 500);
  const result = {};
  (data || []).forEach(row => { result[row.section_key] = row.content; });
  return res.status(200).json(result);
}

async function updatePlatformConfig(body, res) {
  const { level_id, ...updates } = body;
  if (!level_id) throw new SecurityError('level_id required', 400);
  await supabase.from('platform_configs').upsert({ level_id, ...updates, updated_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}

async function updateHeader(body, res) {
  const { level_id, ...updates } = body;
  if (!level_id) throw new SecurityError('level_id required', 400);
  await supabase.from('platform_headers').upsert({ level_id, ...updates, updated_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}

async function updateFooter(body, res) {
  const { level_id, ...updates } = body;
  if (!level_id) throw new SecurityError('level_id required', 400);
  await supabase.from('platform_footers').upsert({ level_id, ...updates, updated_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}

async function updateLandingPage(body, res) {
  const { level_id, ...updates } = body;
  if (!level_id) throw new SecurityError('level_id required', 400);
  await supabase.from('landing_pages').upsert({ level_id, ...updates, updated_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}

async function updateOnboardingConfig(body, res) {
  const { level_id, ...updates } = body;
  if (!level_id) throw new SecurityError('level_id required', 400);
  await supabase.from('onboarding_configs').upsert({ level_id, ...updates, updated_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}

async function updateUIComponent(body, res) {
  const { component_key, level_id, properties } = body;
  if (!component_key) throw new SecurityError('component_key required', 400);
  await supabase.from('ui_components').upsert({ component_key, level_id: level_id || null, properties: properties || {}, updated_at: new Date().toISOString() });
  return res.status(200).json({ success: true });
}

async function updateUniversalConfig(body, res) {
  const config = { ...body, updated_at: new Date().toISOString() };
  const { data: existing } = await supabase.from('universal_config').select('id').limit(1).maybeSingle();
  if (existing) await supabase.from('universal_config').update(config).eq('id', existing.id);
  else await supabase.from('universal_config').insert(config);
  return res.status(200).json({ success: true });
}
