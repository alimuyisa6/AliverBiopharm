 import { supabase, canAccessLevel, isAdmin, isValidLevel } from './core.js';

export async function handler(req, res, path, ctx) {
  // Check level access for lab tools
  if (req.method === 'GET') {
    // Get user's level for filtering
    let userLevel = null;
    let showAllContent = false;
    let isAdminUser = false;

    if (ctx.authenticated && ctx.userId) {
      const adminData = await isAdmin(ctx.userId, 'unknown');
      isAdminUser = !!(adminData && adminData.admin_role);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('track, role, is_approved_teacher, approved_track')
        .eq('user_id', ctx.userId)
        .maybeSingle();

      if (profile) {
        if (profile.role === 'student') {
          userLevel = profile.track;
        } else if (profile.role === 'teacher' && profile.is_approved_teacher) {
          if (profile.approved_track === 'ALL') {
            showAllContent = true;
          } else {
            userLevel = profile.approved_track || profile.track;
          }
        }
      }
    }

    // Check if user has access to lab (only Pharmacy or admin/teacher with ALL access)
    const hasLabAccess = isAdminUser || showAllContent || userLevel === 'Pharmacy';

    if (path === 'tools') {
      const data = await getLabTools(userLevel, showAllContent, isAdminUser);
      return res.status(200).json({ data });
    }

    if (path === 'drugs') {
      const level = req.query.level || null;
      // Filter by user's level if they don't have admin/ALL access
      const effectiveLevel = showAllContent ? level : (level || userLevel);
      const data = await getLabDrugs(effectiveLevel, showAllContent, isAdminUser);
      return res.status(200).json({ data });
    }

    if (path === 'interactions') {
      const { drug_a_id, drug_b_id } = req.query;
      if (!drug_a_id || !drug_b_id) {
        return res.status(400).json({ error: 'drug_a_id and drug_b_id required' });
      }
      const data = await getLabInteraction(drug_a_id, drug_b_id);
      return res.status(200).json({ data });
    }

    if (path === 'pathways') {
      const level = req.query.level || null;
      const effectiveLevel = showAllContent ? level : (level || userLevel);
      const data = await getLabPathways(effectiveLevel, showAllContent, isAdminUser);
      return res.status(200).json({ data });
    }

    if (path === 'pathway_by_slug') {
      const slug = req.query.slug;
      if (!slug) {
        return res.status(400).json({ error: 'slug required' });
      }
      const data = await getLabPathwayBySlug(slug);
      return res.status(200).json({ data });
    }

    if (path === 'cases') {
      const { level, difficulty } = req.query;
      const effectiveLevel = showAllContent ? level : (level || userLevel);
      const data = await getLabCases(effectiveLevel, difficulty || null, showAllContent, isAdminUser);
      return res.status(200).json({ data });
    }

    if (path === 'case_by_id') {
      const id = req.query.id;
      if (!id) {
        return res.status(400).json({ error: 'id required' });
      }
      const data = await getLabCaseById(id);
      return res.status(200).json({ data });
    }

    if (path === 'formulas') {
      const { level, drug } = req.query;
      const effectiveLevel = showAllContent ? level : (level || userLevel);
      const data = await getLabFormulas(effectiveLevel, drug || null, showAllContent, isAdminUser);
      return res.status(200).json({ data });
    }
  }

  if (req.method === 'POST' && path === 'submit_score') {
    if (!ctx.authenticated) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const body = req.body || {};
    const { case_id, score, max_score } = body;
    if (!case_id || score === undefined || max_score === undefined) {
      return res.status(400).json({ error: 'case_id, score, and max_score required' });
    }
    const data = await submitCaseScore(ctx.userId, case_id, score, max_score);
    return res.status(200).json({ data });
  }

  return res.status(404).json({ error: 'Lab endpoint not found' });
}

export async function getLabTools(userLevel, showAllContent, isAdminUser) {
  let query = supabase
    .from('lab_tools')
    .select('*')
    .eq('is_active', true);

  // Only Pharmacy users can see lab tools, unless admin/ALL access
  if (!isAdminUser && !showAllContent && userLevel !== 'Pharmacy') {
    return [];
  }

  // Filter tools by level (tools have a levels array)
  if (userLevel && !showAllContent) {
    query = query.filter('levels', 'cs', `{${userLevel}}`);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLabDrugs(level, showAllContent, isAdminUser) {
  let query = supabase
    .from('lab_drugs')
    .select('*')
    .eq('is_active', true);

  // Only Pharmacy users can see lab drugs, unless admin/ALL access
  if (!isAdminUser && !showAllContent) {
    // Only show if user is Pharmacy level
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('track')
      .eq('user_id', supabase.auth.userId)
      .maybeSingle();

    if (!profile || profile.track !== 'Pharmacy') {
      return [];
    }
  }

  if (level && !showAllContent) {
    query = query.eq('level', level);
  } else if (!showAllContent) {
    query = query.eq('level', 'Pharmacy');
  }

  const { data, error } = await query.order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLabInteraction(drugAId, drugBId) {
  const { data, error } = await supabase
    .from('lab_interactions')
    .select('*, drug_a:lab_drugs!lab_interactions_drug_a_id_fkey(name, drug_class), drug_b:lab_drugs!lab_interactions_drug_b_id_fkey(name, drug_class)')
    .or(`and(drug_a_id.eq.${drugAId},drug_b_id.eq.${drugBId}),and(drug_a_id.eq.${drugBId},drug_b_id.eq.${drugAId})`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLabPathways(level, showAllContent, isAdminUser) {
  let query = supabase
    .from('lab_pathways')
    .select('*')
    .eq('is_active', true);

  // Only Pharmacy users can see lab pathways, unless admin/ALL access
  if (!isAdminUser && !showAllContent) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('track')
      .eq('user_id', supabase.auth.userId)
      .maybeSingle();

    if (!profile || profile.track !== 'Pharmacy') {
      return [];
    }
  }

  if (level && !showAllContent) {
    query = query.eq('level', level);
  } else if (!showAllContent) {
    query = query.eq('level', 'Pharmacy');
  }

  const { data, error } = await query.order('title', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLabPathwayBySlug(slug) {
  const { data: pathway, error: pathwayError } = await supabase
    .from('lab_pathways')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  if (pathwayError) throw pathwayError;
  const { data: steps, error: stepsError } = await supabase
    .from('lab_pathway_steps')
    .select('*')
    .eq('pathway_id', pathway.id)
    .order('step_order', { ascending: true });
  if (stepsError) throw stepsError;
  return { ...pathway, steps };
}

export async function getLabCases(level, difficulty, showAllContent, isAdminUser) {
  let query = supabase
    .from('lab_cases')
    .select('*')
    .eq('is_active', true);

  // Only Pharmacy users can see lab cases, unless admin/ALL access
  if (!isAdminUser && !showAllContent) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('track')
      .eq('user_id', supabase.auth.userId)
      .maybeSingle();

    if (!profile || profile.track !== 'Pharmacy') {
      return [];
    }
  }

  if (level && !showAllContent) {
    query = query.eq('level', level);
  } else if (!showAllContent) {
    query = query.eq('level', 'Pharmacy');
  }

  if (difficulty) query = query.eq('difficulty', difficulty);

  const { data, error } = await query.order('title', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLabCaseById(id) {
  const { data: caseData, error: caseError } = await supabase
    .from('lab_cases')
    .select('*')
    .eq('id', id)
    .single();
  if (caseError) throw caseError;
  const { data: stages, error: stagesError } = await supabase
    .from('lab_case_stages')
    .select('*')
    .eq('case_id', id)
    .order('stage_order', { ascending: true });
  if (stagesError) throw stagesError;
  return { ...caseData, stages };
}

export async function submitCaseScore(userId, caseId, score, maxScore) {
  const { data, error } = await supabase
    .from('lab_case_scores')
    .insert({
      user_id: userId,
      case_id: caseId,
      score,
      max_score: maxScore,
      completed_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLabFormulas(level, drug, showAllContent, isAdminUser) {
  let query = supabase
    .from('lab_drug_formulas')
    .select('*')
    .eq('is_active', true);

  // Only Pharmacy users can see lab formulas, unless admin/ALL access
  if (!isAdminUser && !showAllContent) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('track')
      .eq('user_id', supabase.auth.userId)
      .maybeSingle();

    if (!profile || profile.track !== 'Pharmacy') {
      return [];
    }
  }

  if (level && !showAllContent) {
    query = query.eq('level', level);
  } else if (!showAllContent) {
    query = query.eq('level', 'Pharmacy');
  }

  if (drug) query = query.ilike('drug_name', `%${drug}%`);

  const { data, error } = await query.order('drug_name', { ascending: true });
  if (error) throw error;
  return data;
}
