import { supabase } from './core.js';
import { SecurityError } from './security-middleware.js';

const LEVEL_CONFIG = {
  'O-Level': {
    display_name: 'Secondary School Biology',
    description: 'Comprehensive biology for secondary school students',
    icon: 'fa-seedling',
    color: '#0a7e7e',
    class_label: 'Class',
    class_options: ['Form 1', 'Form 2', 'Form 3', 'Form 4']
  },
  'A-Level': {
    display_name: 'Advanced Secondary Biology',
    description: 'Advanced biology for upper secondary students',
    icon: 'fa-flask',
    color: '#b8873a',
    class_label: 'Class',
    class_options: ['Form 5', 'Form 6']
  },
  'Pharmacy': {
    display_name: 'Pharmacy & Pharmaceutical Sciences',
    description: 'Pharmacy education from certificate to degree level',
    icon: 'fa-capsules',
    color: '#10b981',
    class_label: 'Programme',
    class_options: ['Certificate', 'Diploma', 'Degree']
  }
};

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'config') {
    return getLevelConfig(req, res);
  }
  if (req.method === 'GET' && path === 'user-level') {
    return getUserLevelInfo(req, res, ctx);
  }
  throw new SecurityError('Invalid action', 400);
}

async function getLevelConfig(req, res) {
  const { data, error } = await supabase
    .from('level_config')
    .select('*')
    .order('level', { ascending: true });

  if (error) {
    return res.status(200).json(Object.values(LEVEL_CONFIG));
  }

  if (data && data.length > 0) {
    return res.status(200).json(data);
  }

  const configs = Object.entries(LEVEL_CONFIG).map(([key, value]) => ({
    level: key,
    ...value
  }));

  return res.status(200).json(configs);
}

async function getUserLevelInfo(req, res, ctx) {
  if (!ctx.authenticated || !ctx.userId) {
    return res.status(200).json({ level: null, class_name: null, config: null });
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('track, class_name, role, is_approved_teacher, approved_track')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (error || !profile) {
    return res.status(200).json({ level: null, class_name: null, config: null });
  }

  let level = profile.track;
  let className = profile.class_name;

  if (profile.role === 'teacher') {
    if (!profile.is_approved_teacher) {
      return res.status(200).json({ level: null, class_name: null, config: null, pending: true });
    }
    if (profile.approved_track === 'ALL') {
      return res.status(200).json({
        level: 'ALL',
        class_name: null,
        config: null,
        show_all: true
      });
    }
    level = profile.approved_track || profile.track;
  }

  const config = LEVEL_CONFIG[level] || null;

  return res.status(200).json({
    level,
    class_name: className,
    config,
    display_name: config?.display_name || level,
    class_label: config?.class_label || 'Class',
    class_options: config?.class_options || []
  });
}
