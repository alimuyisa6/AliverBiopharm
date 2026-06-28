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

  const { data: term } = await supabase
    .from('glossary_terms')
    .select('id, term, slug')
    .eq('slug', slug)
    .single();

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

  const { data: term, error: termError } = await supabase
    .from('glossary_terms')
    .select('*')
    .eq('slug', slug)
    .contains('levels', [level])
    .maybesingle();

  if (termError || !term) throw new SecurityError('Term not found for this level', 404);

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
    const quizIds = mappings.filter(m => m.content_type === 'quiz').map(m => m.content_id);
    const pdfIds = mappings.filter(m => m.content_type === 'pdf_resource').map(m => m.content_id);
    const noteIds = mappings.filter(m => m.content_type === 'note_structure').map(m => m.content_id);
    const flashcardIds = mappings.filter(m => m.content_type === 'flashcard_deck').map(m => m.content_id);
    const paperIds = mappings.filter(m => m.content_type === 'past_paper').map(m => m.content_id);
    const recallIds = mappings.filter(m => m.content_type === 'recall_question').map(m => m.content_id);

    if (quizIds.length > 0) {
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, title, description, category, difficulty, subject')
        .in('id', quizIds.map(Number))
        .eq('is_active', true)
        .limit(5);
      if (quizzes) content.quizzes = quizzes;
    }

    if (pdfIds.length > 0) {
      const { data: pdfs } = await supabase
        .from('pdf_resources')
        .select('id, title, author, topic, subtopic, file_url, file_size')
        .in('id', pdfIds.map(Number))
        .eq('level', level)
        .eq('is_active', true)
        .limit(5);
      if (pdfs) content.pdfs = pdfs;
    }

    if (noteIds.length > 0) {
      const { data: notes } = await supabase
        .from('notes_structure')
        .select('subtopic_id, subtopic_name, topic, level, content_preview, read_time')
        .in('subtopic_id', noteIds)
        .eq('level', level)
        .limit(5);
      if (notes) content.notes = notes;
    }

    if (flashcardIds.length > 0) {
      const { data: decks } = await supabase
        .from('flashcard_decks')
        .select('id, title, description, category')
        .in('id', flashcardIds)
        .eq('level', level)
        .limit(5);
      if (decks) content.flashcards = decks;
    }

    if (paperIds.length > 0) {
      const { data: papers } = await supabase
        .from('past_papers')
        .select('id, title, subject, year, paper_type, topic')
        .in('id', paperIds)
        .eq('level', level)
        .eq('is_active', true)
        .limit(5);
      if (papers) content.past_papers = papers;
    }

    if (recallIds.length > 0) {
      const numericIds = recallIds.map(Number).filter(n => !isNaN(n));
      if (numericIds.length > 0) {
        const { data: recall } = await supabase
          .from('recall_questions_bank')
          .select('id, question_text, topic, difficulty')
          .in('id', numericIds)
          .eq('level', level)
          .eq('is_active', true)
          .limit(5);
        if (recall) content.recall_questions = recall;
      }
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

  const result = { term, content };
  return res.status(200).json(result);
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
