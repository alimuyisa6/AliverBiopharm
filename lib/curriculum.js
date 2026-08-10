import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAdmin,
  requireSuperAdmin,
  SecurityError,
} from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'levels':      return getLevels(req, res);
      case 'config':      return getLevelConfig(req, res);
      case 'groups':      return getGroups(req, res);
      case 'units':       return getUnits(req, res);
      case 'unit':        return getUnit(req, res);
      case 'unit_blocks': return getUnitBlocks(req, res);
      case 'breadcrumb':  return getBreadcrumb(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    requireSuperAdmin(ctx);
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'create_group':      return createGroup(body, res);
      case 'update_group':      return updateGroup(body, res);
      case 'delete_group':      return deleteGroup(body, res);
      case 'create_unit':       return createUnit(body, res);
      case 'update_unit':       return updateUnit(body, res);
      case 'delete_unit':       return deleteUnit(body, res);
      case 'set_unit_premium':  return setUnitPremium(body, res);
      case 'set_block_premium': return setBlockPremium(body, res);
      case 'ensure_blocks':     return ensureBlocks(body, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getLevels(req, res) {
  const { data, error } = await supabase
    .from('curriculum_levels')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw new SecurityError('Failed to fetch levels', 500);
  return res.status(200).json(data || []);
}

async function getLevelConfig(req, res) {
  const { level } = req.query;
  if (!level) throw new SecurityError('level required', 400);

  const { data: levelData, error: levelError } = await supabase
    .from('curriculum_levels')
    .select('*')
    .eq('id', level)
    .maybeSingle();

  if (levelError) throw new SecurityError('Failed to fetch level', 500);
  if (!levelData) throw new SecurityError('Level not found', 404);

  const { data: groups, error: groupsError } = await supabase
    .from('curriculum_groups')
    .select('id, name, description, icon, sequence_order')
    .eq('level_id', level)
    .eq('is_active', true)
    .order('sequence_order', { ascending: true });

  if (groupsError) throw new SecurityError('Failed to fetch groups', 500);

  return res.status(200).json({ level: levelData, groups: groups || [] });
}

async function getGroups(req, res) {
  const { level_id } = req.query;
  let query = supabase
    .from('curriculum_groups')
    .select('*')
    .eq('is_active', true)
    .order('sequence_order', { ascending: true });

  if (level_id) query = query.eq('level_id', level_id);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch groups', 500);
  return res.status(200).json(data || []);
}

async function getUnits(req, res) {
  const { group_id, level_id } = req.query;
  if (!group_id && !level_id) throw new SecurityError('group_id or level_id required', 400);

  let groupIds = null;
  if (level_id && !group_id) {
    const { data: groups } = await supabase
      .from('curriculum_groups')
      .select('id')
      .eq('level_id', level_id);
    groupIds = (groups || []).map(g => g.id);
    if (!groupIds.length) return res.status(200).json([]);
  }

  let query = supabase
    .from('curriculum_units')
    .select('*, curriculum_groups(id, name, level_id)')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (group_id) query = query.eq('group_id', group_id);
  else if (groupIds) query = query.in('group_id', groupIds);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch units', 500);

  const units = (data || []).map(u => ({
    id: u.id,
    name: u.name,
    code: u.code,
    icon: u.icon,
    display_order: u.display_order,
    is_hard_topic: u.is_hard_topic,
    is_premium: u.is_premium,
    group_id: u.group_id,
    group_name: u.curriculum_groups?.name || null,
  }));

  return res.status(200).json(units);
}

async function getUnit(req, res) {
  const { id } = req.query;
  if (!id) throw new SecurityError('id required', 400);

  const { data, error } = await supabase
    .from('curriculum_units')
    .select('*, curriculum_groups(id, name, level_id, curriculum_levels(id, display_name, group_label, unit_label, kind))')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new SecurityError('Failed to fetch unit', 500);
  if (!data) throw new SecurityError('Unit not found', 404);

  const group = data.curriculum_groups;
  const level = group?.curriculum_levels;

  return res.status(200).json({
    id: data.id,
    name: data.name,
    code: data.code,
    icon: data.icon,
    is_hard_topic: data.is_hard_topic,
    is_premium: data.is_premium,
    group: group ? { id: group.id, name: group.name } : null,
    level: level
      ? {
          id: level.id,
          display_name: level.display_name,
          group_label: level.group_label,
          unit_label: level.unit_label,
          kind: level.kind,
        }
      : null,
  });
}

async function getUnitBlocks(req, res) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const { data, error } = await supabase
    .from('curriculum_unit_blocks')
    .select('*')
    .eq('unit_id', unit_id)
    .order('block_number', { ascending: true });

  if (error) throw new SecurityError('Failed to fetch blocks', 500);
  return res.status(200).json(data || []);
}

async function getBreadcrumb(req, res) {
  const { unit_id } = req.query;
  if (!unit_id) throw new SecurityError('unit_id required', 400);

  const path = await resolveBreadcrumb(unit_id);
  if (!path) throw new SecurityError('Unit not found', 404);
  return res.status(200).json(path);
}

export async function resolveBreadcrumb(unitId) {
  const { data, error } = await supabase
    .from('curriculum_units')
    .select('id, name, curriculum_groups(id, name, curriculum_levels(id, display_name, group_label, unit_label))')
    .eq('id', unitId)
    .maybeSingle();

  if (error || !data) return null;

  const group = data.curriculum_groups;
  const level = group?.curriculum_levels;

  return [
    { label: 'Home', href: '/' },
    level ? { label: level.display_name, href: `/level/${level.id}` } : null,
    group ? { label: group.name, href: `/level/${level?.id}/group/${group.id}` } : null,
    { label: data.name, href: null },
  ].filter(Boolean);
}

export async function resolveUnitTitle(unitId) {
  const { data, error } = await supabase
    .from('curriculum_units')
    .select('name, curriculum_groups(name, curriculum_levels(group_label, unit_label))')
    .eq('id', unitId)
    .maybeSingle();

  if (error || !data) return null;

  const group = data.curriculum_groups;
  const level = group?.curriculum_levels;

  return {
    unit_name: data.name,
    group_name: group?.name || null,
    unit_label: level?.unit_label || 'Topic',
    group_label: level?.group_label || 'Class',
    full_title: level
      ? `${group?.name || ''} — ${level.unit_label}: ${data.name}`
      : data.name,
  };
}

export async function getUserCurriculumScope(userId) {
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select(
      'role, track, class_name, is_approved_teacher, approved_track, active_level_id, active_group_id'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !profile) return null;

  const isTeacher = profile.role === 'teacher';
  const isApproved = profile.is_approved_teacher;
  const approvedAll = profile.approved_track === 'ALL';

  if (isTeacher && !isApproved) {
    return {
      level: null,
      groupName: null,
      active_level_id: null,
      active_group_id: null,
      active_level_name: null,
      active_group_name: null,
      showAll: false,
      pending: true,
    };
  }

  if (isTeacher && approvedAll) {
    return {
      level: null,
      groupName: null,
      active_level_id: null,
      active_group_id: null,
      active_level_name: null,
      active_group_name: null,
      showAll: true,
      pending: false,
    };
  }

  const activeLevelId = profile.active_level_id;
  const activeGroupId = profile.active_group_id;

  if (activeLevelId && activeGroupId) {
    const [
      { data: levelData, error: levelError },
      { data: groupData, error: groupError },
    ] = await Promise.all([
      supabase
        .from('curriculum_levels')
        .select('id, display_name')
        .eq('id', activeLevelId)
        .maybeSingle(),

      supabase
        .from('curriculum_groups')
        .select('id, name, level_id, is_active')
        .eq('id', activeGroupId)
        .maybeSingle(),
    ]);

    if (
      levelError ||
      groupError ||
      !levelData ||
      !groupData ||
      groupData.level_id !== levelData.id ||
      groupData.is_active === false
    ) {
      return {
        level: profile.track || null,
        groupName: profile.class_name || null,
        active_level_id: null,
        active_group_id: null,
        active_level_name: null,
        active_group_name: null,
        showAll: false,
        pending: false,
      };
    }

    return {
      level: levelData.display_name || profile.track || null,
      groupName: groupData.name || profile.class_name || null,
      active_level_id: levelData.id,
      active_group_id: groupData.id,
      active_level_name: levelData.display_name || null,
      active_group_name: groupData.name || null,
      showAll: false,
      pending: false,
    };
  }

  return {
    level: profile.track || null,
    groupName: profile.class_name || null,
    active_level_id: null,
    active_group_id: null,
    active_level_name: null,
    active_group_name: null,
    showAll: false,
    pending: false,
  };
}

export async function getUnitAccessInfo(unitId) {
  const { data, error } = await supabase
    .from('curriculum_units')
    .select('id, is_premium, group_id, curriculum_groups(level_id)')
    .eq('id', unitId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    unit_id: data.id,
    is_premium: data.is_premium,
    level_id: data.curriculum_groups?.level_id || null,
  };
}

async function createGroup(body, res) {
  const { id, level_id, name, description, icon, sequence_order } = body;
  if (!id || !level_id || !name || sequence_order === undefined) {
    throw new SecurityError('id, level_id, name, sequence_order required', 400);
  }

  const { data, error } = await supabase
    .from('curriculum_groups')
    .insert({ id, level_id, name, description, icon, sequence_order })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to create group', 500);
  return res.status(200).json({ success: true, group: data });
}

async function updateGroup(body, res) {
  const { id, ...updates } = body;
  if (!id) throw new SecurityError('id required', 400);

  await supabase.from('curriculum_groups').update(updates).eq('id', id);
  return res.status(200).json({ success: true });
}

async function deleteGroup(body, res) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);

  await supabase.from('curriculum_groups').delete().eq('id', id);
  return res.status(200).json({ success: true });
}

async function createUnit(body, res) {
  const { group_id, name, code, icon, display_order, is_hard_topic } = body;
  if (!group_id || !name) throw new SecurityError('group_id and name required', 400);

  const { data, error } = await supabase
    .from('curriculum_units')
    .insert({
      group_id,
      name,
      code,
      icon,
      display_order,
      is_hard_topic: !!is_hard_topic,
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to create unit', 500);
  return res.status(200).json({ success: true, unit: data });
}

async function updateUnit(body, res) {
  const { id, ...updates } = body;
  if (!id) throw new SecurityError('id required', 400);

  await supabase.from('curriculum_units').update(updates).eq('id', id);
  return res.status(200).json({ success: true });
}

async function deleteUnit(body, res) {
  const { id } = body;
  if (!id) throw new SecurityError('id required', 400);

  await supabase.from('curriculum_units').delete().eq('id', id);
  return res.status(200).json({ success: true });
}

async function setUnitPremium(body, res) {
  const { unit_id, is_premium } = body;
  if (!unit_id || is_premium === undefined) {
    throw new SecurityError('unit_id and is_premium required', 400);
  }

  await supabase.from('curriculum_units').update({ is_premium }).eq('id', unit_id);
  return res.status(200).json({ success: true });
}

async function setBlockPremium(body, res) {
  const { unit_id, block_number, is_premium } = body;
  if (!unit_id || block_number === undefined || is_premium === undefined) {
    throw new SecurityError('unit_id, block_number, is_premium required', 400);
  }

  await supabase
    .from('curriculum_unit_blocks')
    .update({ is_premium })
    .eq('unit_id', unit_id)
    .eq('block_number', block_number);

  return res.status(200).json({ success: true });
}

async function ensureBlocks(body, res) {
  const { unit_id, total_blocks } = body;
  if (!unit_id || !total_blocks) {
    throw new SecurityError('unit_id and total_blocks required', 400);
  }

  const { data: existing } = await supabase
    .from('curriculum_unit_blocks')
    .select('block_number')
    .eq('unit_id', unit_id);

  const existingNumbers = new Set((existing || []).map(b => b.block_number));
  const rows = [];
  for (let i = 0; i < total_blocks; i++) {
    if (!existingNumbers.has(i)) {
      rows.push({ unit_id, block_number: i, is_premium: false });
    }
  }

  if (rows.length) {
    const { error } = await supabase.from('curriculum_unit_blocks').insert(rows);
    if (error) throw new SecurityError('Failed to create blocks', 500);
  }

  return res.status(200).json({ success: true, created: rows.length });
}
