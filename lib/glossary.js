 import { supabase, isValidLevel, getCached, setCached } from './core.js';
import { SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'list': return listTerms(req, res);
      case 'term': return getTerm(req, res);
      case 'categories': return getCategories(req, res);
      case 'debug': return debugMappings(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function debugMappings(req, res) {
  const { slug } = req.query;
  if (!slug) throw new SecurityError('Slug is required', 400);

  const { data } = await supabase
    .from('glossary_terms')
    .select('id, term, slug')
    .eq('slug', slug)
    .limit(1);

  const term = data && data.length > 0 ? data[0] : null;
  if (!term) throw new SecurityError('Term not found', 404);

  const { data: mappings, error } = await supabase
    .from('glossary_term_mappings')
    .select('content_type, content_id')
    .eq('term_id', term.id);

  return res.status(200).json({
    term_id: term.id,
    term_slug: term.slug,
    mapping_count: mappings ? mappings.length : 0,
    mappings: mappings || [],
    error: error ? error.message : null
  });
}

async function listTerms(req, res) {
  const { level, category, search } = req.query;

  if (!level || !isValidLevel(level)) {
    throw new SecurityError('Valid level is required', 400);
  }

  const cacheKey = `glossary:list:${level}:${category || 'all'}:${search || ''}`;
  const cached = getCached(cacheKey);
  if (cached) return res.status(200).json(cached);

  let query = supabase
    .from('glossary_terms')
    .select('id, term, slug, plain_definition, category, levels, pronunciation')
    .contains('levels', [level])
    .order('term', { ascending: true });

  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('term', `%${search}%`);

  const { data, error } = await query;

  if (error) throw new SecurityError('Failed to fetch glossary terms', 500);

  const result = data || [];
  setCached(cacheKey, result, 300000);
  return res.status(200).json(result);
}

async function getTerm(req, res) {
  const { slug, level } = req.query;

  if (!slug) throw new SecurityError('Slug is required', 400);
  if (!level || !isValidLevel(level)) throw new SecurityError('Valid level is required', 400);

  const { data, error: termError } = await supabase
    .from('glossary_terms')
    .select('*')
    .eq('slug', slug)
    .contains('levels', [level])
    .limit(1);

  if (termError) throw new SecurityError('Failed to fetch term', 500);

  const term = data && data.length > 0 ? data[0] : null;
  if (!term) throw new SecurityError('Term not found for this level', 404);

  const { data: mappings, error: mapError } = await supabase
    .from('glossary_term_mappings')
    .select('content_type, content_id')
    .eq('term_id', term.id);

  if (mapError) {
    console.error('Mappings fetch error:', mapError.message);
  }

  const content = {
    quizzes: [],
    pdfs: [],
    notes: [],
    flashcards: [],
    past_papers: [],
    recall_questions: []
  };

  if (mappings && mappings.length > 0) {
    const typeMap = {
      'quiz': 'quizzes',
      'note_structure': 'notes',
      'note': 'notes',
      'pdf_resource': 'pdf_resources',
      'flashcard_deck': 'flashcard_decks',
      'past_paper': 'past_papers',
      'recall_question': 'recall_questions_bank',
      'recall_questions_bank': 'recall_questions_bank'
    };

    const tableIds = {};
    for (const m of mappings) {
      const targetType = typeMap[m.content_type] || m.content_type;
      if (!tableIds[targetType]) tableIds[targetType] = [];
      tableIds[targetType].push(m.content_id);
    }

    const fetchPromises = [];
    for (const [table, ids] of Object.entries(tableIds)) {
      if (ids.length === 0) continue;

      let query;
      if (table === 'notes') {
        query = supabase
          .from('notes')
          .select('id, slug, title, content_preview, read_time, unit_id, curriculum_units(name)')
          .in('id', ids)
          .eq('is_active', true)
          .limit(5);
      } else if (table === 'pdf_resources') {
        query = supabase
          .from('pdf_resources')
          .select('id, title, author, file_url, file_size')
          .in('id', ids)
          .eq('is_active', true)
          .limit(5);
      } else if (table === 'flashcard_decks') {
        query = supabase
          .from('flashcard_decks')
          .select('id, title, description, category')
          .in('id', ids)
          .eq('is_active', true)
          .limit(5);
      } else if (table === 'past_papers') {
        query = supabase
          .from('past_papers')
          .select('id, title, subject, year, paper_type')
          .in('id', ids)
          .eq('is_active', true)
          .limit(5);
      } else if (table === 'quizzes') {
        query = supabase
          .from('quizzes')
          .select('id, title, description, category, difficulty, subject')
          .in('id', ids.map(Number))
          .eq('is_active', true)
          .limit(5);
      } else if (table === 'recall_questions_bank') {
        const numericIds = ids.map(Number).filter(n => !isNaN(n));
        if (numericIds.length > 0) {
          query = supabase
            .from('recall_questions_bank')
            .select('id, question_text, unit_id, difficulty, curriculum_units(name)')
            .in('id', numericIds)
            .eq('is_active', true)
            .limit(5);
        }
      }

      if (query) fetchPromises.push(query);
    }

    const results = await Promise.all(fetchPromises);
    let idx = 0;
    for (const [table, ids] of Object.entries(tableIds)) {
      if (ids.length === 0) continue;
      if (table === 'notes') {
        content.notes = results[idx]?.data || [];
      } else if (table === 'pdf_resources') {
        content.pdfs = results[idx]?.data || [];
      } else if (table === 'flashcard_decks') {
        content.flashcards = results[idx]?.data || [];
      } else if (table === 'past_papers') {
        content.past_papers = results[idx]?.data || [];
      } else if (table === 'quizzes') {
        content.quizzes = results[idx]?.data || [];
      } else if (table === 'recall_questions_bank') {
        content.recall_questions = results[idx]?.data || [];
      }
      idx++;
    }
  }

  if (term.related_terms && term.related_terms.length > 0) {
    const { data: related } = await supabase
      .from('glossary_terms')
      .select('term, slug, plain_definition')
      .in('slug', term.related_terms)
      .contains('levels', [level]);
    term.related_terms_data = related || [];
  } else {
    term.related_terms_data = [];
  }

  return res.status(200).json({ term, content });
}

async function getCategories(req, res) {
  const { level } = req.query;

  if (!level || !isValidLevel(level)) {
    throw new SecurityError('Valid level is required', 400);
  }

  const cacheKey = `glossary:categories:${level}`;
  const cached = getCached(cacheKey);
  if (cached) return res.status(200).json(cached);

  const { data, error } = await supabase
    .from('glossary_terms')
    .select('category')
    .contains('levels', [level])
    .order('category');

  if (error) throw new SecurityError('Failed to fetch categories', 500);

  const categories = [...new Set((data || []).map(d => d.category).filter(Boolean))];
  setCached(cacheKey, categories, 600000);
  return res.status(200).json(categories);
}
