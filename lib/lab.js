import { supabase } from './core.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'tools') {
    const data = await getLabTools();
    return res.status(200).json({ data });
  }

  if (req.method === 'GET' && path === 'drugs') {
    const level = req.query.level || null;
    const data = await getLabDrugs(level);
    return res.status(200).json({ data });
  }

  if (req.method === 'GET' && path === 'interactions') {
    const { drug_a_id, drug_b_id } = req.query;
    if (!drug_a_id || !drug_b_id) {
      return res.status(400).json({ error: 'drug_a_id and drug_b_id required' });
    }
    const data = await getLabInteraction(drug_a_id, drug_b_id);
    return res.status(200).json({ data });
  }

  if (req.method === 'GET' && path === 'pathways') {
    const level = req.query.level || null;
    const data = await getLabPathways(level);
    return res.status(200).json({ data });
  }

  if (req.method === 'GET' && path === 'pathway_by_slug') {
    const slug = req.query.slug;
    if (!slug) {
      return res.status(400).json({ error: 'slug required' });
    }
    const data = await getLabPathwayBySlug(slug);
    return res.status(200).json({ data });
  }

  if (req.method === 'GET' && path === 'cases') {
    const { level, difficulty } = req.query;
    const data = await getLabCases(level || null, difficulty || null);
    return res.status(200).json({ data });
  }

  if (req.method === 'GET' && path === 'case_by_id') {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }
    const data = await getLabCaseById(id);
    return res.status(200).json({ data });
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

  if (req.method === 'GET' && path === 'formulas') {
    const { level, drug } = req.query;
    const data = await getLabFormulas(level || null, drug || null);
    return res.status(200).json({ data });
  }

  return res.status(404).json({ error: 'Lab endpoint not found' });
}

export async function getLabTools() {
  const { data, error } = await supabase
    .from('lab_tools')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLabDrugs(level) {
  let query = supabase
    .from('lab_drugs')
    .select('*')
    .eq('is_active', true);
  if (level) query = query.eq('level', level);
  const { data, error } = await query.order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLabInteraction(drugAId, drugBId) {
  const { data, error } = await supabase
    .from('lab_interactions')
    .select('*, drug_a:lab_drugs!lab_interactions_drug_a_id_fkey(name, drug_class), drug_b:lab_drugs!lab_interactions_drug_b_id_fkey(name, drug_class)')
    .or(`(drug_a_id.eq.${drugAId},drug_b_id.eq.${drugBId}),(drug_a_id.eq.${drugBId},drug_b_id.eq.${drugAId})`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLabPathways(level) {
  let query = supabase
    .from('lab_pathways')
    .select('*')
    .eq('is_active', true);
  if (level) query = query.eq('level', level);
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

export async function getLabCases(level, difficulty) {
  let query = supabase
    .from('lab_cases')
    .select('*')
    .eq('is_active', true);
  if (level) query = query.eq('level', level);
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

export async function getLabFormulas(level, drug) {
  let query = supabase
    .from('lab_drug_formulas')
    .select('*')
    .eq('is_active', true);
  if (level) query = query.eq('level', level);
  if (drug) query = query.ilike('drug_name', `%${drug}%`);
  const { data, error } = await query.order('drug_name', { ascending: true });
  if (error) throw error;
  return data;
}
