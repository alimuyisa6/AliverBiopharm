 import { supabase, canAccessLevel, isAdmin } from './core.js';
import { SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'global') return globalSearch(req, res, ctx);
  throw new SecurityError('Invalid action', 400);
}

async function globalSearch(req, res, ctx) {
  const query = (req.query.q || '').trim().slice(0, 100);
  if (query.length < 2) return res.status(200).json({ query, results: [] });

  let userLevel = null, showAll = false;
  if (ctx.authenticated && ctx.userId) {
    const adminData = await isAdmin(ctx.userId, 'unknown');
    if (adminData?.admin_role) showAll = true;
    else {
      const { data: profile } = await supabase.from('user_profiles').select('track, role, is_approved_teacher, approved_track').eq('user_id', ctx.userId).maybeSingle();
      if (profile) {
        if (profile.role === 'teacher' && profile.is_approved_teacher) {
          if (profile.approved_track === 'ALL') showAll = true;
          else userLevel = profile.approved_track || profile.track;
        } else if (profile.role === 'student') {
          userLevel = profile.track;
        }
      }
    }
  }

  const results = [];
  const tsquery = query.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(w => w.length).map(w => `${w}:*`).join(' & ');

  if (tsquery) {
    let notesQuery = supabase.from('notes').select('id, slug, title, content_preview, unit_id').eq('is_active', true).textSearch('search_vector', tsquery).limit(5);
    if (userLevel && !showAll) {
      notesQuery = notesQuery.filter('curriculum_units.curriculum_groups.level_id', 'eq', userLevel);
    }
    const { data: notes } = await notesQuery;
    if (notes) results.push(...notes.map(n => ({ type: 'note', id: n.id, slug: n.slug, title: n.title, preview: n.content_preview })));

    let glossaryQuery = supabase.from('glossary_terms').select('id, term, slug, plain_definition').textSearch('search_vector', tsquery).limit(5);
    if (userLevel && !showAll) {
      glossaryQuery = glossaryQuery.contains('levels', [userLevel]);
    }
    const { data: glossary } = await glossaryQuery;
    if (glossary) results.push(...glossary.map(g => ({ type: 'glossary_term', id: g.id, slug: g.slug, title: g.term, preview: g.plain_definition })));

    let articleQuery = supabase.from('articles').select('id, slug, title, excerpt').eq('status', 'published').textSearch('search_vector', tsquery).limit(5);
    const { data: articles } = await articleQuery;
    if (articles) results.push(...articles.map(a => ({ type: 'article', id: a.id, slug: a.slug, title: a.title, preview: a.excerpt })));
  }

  const likePattern = `%${query}%`;
  const commonQuery = async (table, select, column, extraFilter = null) => {
    let q = supabase.from(table).select(select).ilike(column, likePattern).limit(5);
    if (extraFilter) q = extraFilter(q);
    return q;
  };

  if (!showAll && userLevel) {
    const { data: papers } = await commonQuery('past_papers', 'id, title, subject, year', 'title', q => q.eq('is_active', true).eq('level', userLevel));
    if (papers) results.push(...papers.map(p => ({ type: 'past_paper', id: p.id, title: p.title, preview: `${p.subject} ${p.year}` })));

    const { data: flashcards } = await commonQuery('flashcard_decks', 'id, title, description', 'title', q => q.eq('is_active', true).eq('level', userLevel));
    if (flashcards) results.push(...flashcards.map(f => ({ type: 'flashcard_deck', id: f.id, title: f.title, preview: f.description })));

    const { data: quizzes } = await commonQuery('curriculum_units', 'id, name', 'name', q => q.eq('is_active', true).filter('curriculum_groups.level_id', 'eq', userLevel));
    if (quizzes) results.push(...quizzes.map(u => ({ type: 'curriculum_unit', id: u.id, title: u.name, preview: 'Quiz topic' })));
  } else {
    const { data: papers } = await commonQuery('past_papers', 'id, title, subject, year', 'title', q => q.eq('is_active', true));
    if (papers) results.push(...papers.map(p => ({ type: 'past_paper', id: p.id, title: p.title, preview: `${p.subject} ${p.year}` })));

    const { data: flashcards } = await commonQuery('flashcard_decks', 'id, title, description', 'title', q => q.eq('is_active', true));
    if (flashcards) results.push(...flashcards.map(f => ({ type: 'flashcard_deck', id: f.id, title: f.title, preview: f.description })));

    const { data: quizzes } = await commonQuery('curriculum_units', 'id, name', 'name', q => q.eq('is_active', true));
    if (quizzes) results.push(...quizzes.map(u => ({ type: 'curriculum_unit', id: u.id, title: u.name, preview: 'Quiz topic' })));
  }

  return res.status(200).json({ query, results: results.slice(0, 20) });
}
