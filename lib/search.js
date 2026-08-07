 import { supabase } from './core.js';
import { requireAuth, SecurityError } from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'global') {
    requireAuth(ctx);
    return globalSearch(req, res, ctx);
  }
  throw new SecurityError('Invalid action', 400);
}

async function globalSearch(req, res, ctx) {
  const query = (req.query.q || '').trim().slice(0, 100);
  if (query.length < 2) return res.status(200).json({ query, results: [] });

  const isAdminUser = !!ctx.adminData;
  const scope = await getUserCurriculumScope(ctx.userId);
  const activeGroupId = scope?.active_group_id;
  const activeLevelId = scope?.active_level_id;
  const activeLevelName = scope?.level;

  if (!isAdminUser && !activeGroupId) {
    return res.status(200).json({ query, results: [], message: 'Your curriculum context is not set.' });
  }

  let allowedUnitIds = null;
  if (!isAdminUser && activeGroupId) {
    const { data: units } = await supabase
      .from('curriculum_units')
      .select('id')
      .eq('group_id', activeGroupId)
      .eq('is_active', true);
    allowedUnitIds = (units || []).map(u => u.id);
    if (!allowedUnitIds.length) {
      return res.status(200).json({ query, results: [] });
    }
  }

  const results = [];
  const tsquery = query
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(w => w.length)
    .map(w => `${w}:*`)
    .join(' & ');

  if (!tsquery) {
    return res.status(200).json({ query, results: [] });
  }

  if (allowedUnitIds || isAdminUser) {
    let notesQuery = supabase
      .from('notes')
      .select('id, slug, title, content_preview, unit_id')
      .eq('is_active', true)
      .textSearch('search_vector', tsquery)
      .limit(5);

    if (allowedUnitIds) {
      notesQuery = notesQuery.in('unit_id', allowedUnitIds);
    }
    const { data: notes } = await notesQuery;
    if (notes) results.push(...notes.map(n => ({ type: 'note', id: n.id, slug: n.slug, title: n.title, preview: n.content_preview })));

    let pastPaperQuery = supabase
      .from('past_papers')
      .select('id, title, subject, year, unit_id')
      .eq('is_active', true)
      .ilike('title', `%${query}%`)
      .limit(5);

    if (allowedUnitIds) {
      pastPaperQuery = pastPaperQuery.in('unit_id', allowedUnitIds);
    }
    const { data: papers } = await pastPaperQuery;
    if (papers) results.push(...papers.map(p => ({ type: 'past_paper', id: p.id, title: p.title, preview: `${p.subject} ${p.year}` })));

    let flashcardQuery = supabase
      .from('flashcard_decks')
      .select('id, title, description, unit_id')
      .eq('is_active', true)
      .ilike('title', `%${query}%`)
      .limit(5);

    if (allowedUnitIds) {
      flashcardQuery = flashcardQuery.in('unit_id', allowedUnitIds);
    }
    const { data: flashcards } = await flashcardQuery;
    if (flashcards) results.push(...flashcards.map(f => ({ type: 'flashcard_deck', id: f.id, title: f.title, preview: f.description })));

    let unitQuery = supabase
      .from('curriculum_units')
      .select('id, name')
      .eq('is_active', true)
      .ilike('name', `%${query}%`)
      .limit(5);

    if (allowedUnitIds) {
      unitQuery = unitQuery.in('id', allowedUnitIds);
    }
    const { data: units } = await unitQuery;
    if (units) results.push(...units.map(u => ({ type: 'curriculum_unit', id: u.id, title: u.name, preview: 'Topic' })));
  }

  if (activeLevelName && activeLevelName !== 'ALL') {
    const glossaryQuery = supabase
      .from('glossary_terms')
      .select('id, term, slug, plain_definition')
      .textSearch('search_vector', tsquery)
      .contains('levels', [activeLevelName])
      .limit(5);
    const { data: glossary } = await glossaryQuery;
    if (glossary) results.push(...glossary.map(g => ({ type: 'glossary_term', id: g.id, slug: g.slug, title: g.term, preview: g.plain_definition })));
  } else if (isAdminUser) {
    const glossaryQuery = supabase
      .from('glossary_terms')
      .select('id, term, slug, plain_definition')
      .textSearch('search_vector', tsquery)
      .limit(5);
    const { data: glossary } = await glossaryQuery;
    if (glossary) results.push(...glossary.map(g => ({ type: 'glossary_term', id: g.id, slug: g.slug, title: g.term, preview: g.plain_definition })));
  }

  if (isAdminUser) {
    const articleQuery = supabase
      .from('articles')
      .select('id, slug, title, excerpt')
      .eq('status', 'published')
      .textSearch('search_vector', tsquery)
      .limit(5);
    const { data: articles } = await articleQuery;
    if (articles) results.push(...articles.map(a => ({ type: 'article', id: a.id, slug: a.slug, title: a.title, preview: a.excerpt })));
  }

  return res.status(200).json({ query, results: results.slice(0, 20) });
}
