import { supabase } from './core.js';
import { SecurityError } from './security-middleware.js';

const RESULT_LIMIT_PER_CATEGORY = 4;
const MAX_QUERY_LENGTH = 100;
const MIN_QUERY_LENGTH = 2;

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'global') {
    return globalSearch(req, res);
  }
  throw new SecurityError('Invalid action', 400);
}

async function globalSearch(req, res) {
  const rawQuery = req.query.q || '';
  const query = rawQuery.trim();

  if (query.length < MIN_QUERY_LENGTH) {
    return res.status(200).json({
      query,
      notes: [],
      glossary: [],
      past_papers: [],
      flashcards: [],
      quizzes: []
    });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw new SecurityError('Search query too long', 400);
  }

  // Escape SQL LIKE wildcards the user might type, so they can't
  // widen their own match pattern (e.g. searching "%" matching everything)
  const escaped = query.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const likePattern = `%${escaped}%`;

  const [notesRes, glossaryRes, papersRes, flashcardsRes, quizzesRes] = await Promise.all([
    supabase
      .from('notes_structure')
      .select('subtopic_id, subtopic_name, topic, level')
      .ilike('subtopic_name', likePattern)
      .limit(RESULT_LIMIT_PER_CATEGORY),
    supabase
      .from('glossary_terms')
      .select('id, term, slug, plain_definition, levels')
      .ilike('term', likePattern)
      .limit(RESULT_LIMIT_PER_CATEGORY),
    supabase
      .from('past_papers')
      .select('id, title, subject, year, level')
      .eq('is_active', true)
      .ilike('title', likePattern)
      .limit(RESULT_LIMIT_PER_CATEGORY),
    supabase
      .from('flashcard_decks')
      .select('id, title, description, level, category')
      .eq('is_active', true)
      .ilike('title', likePattern)
      .limit(RESULT_LIMIT_PER_CATEGORY),
    supabase
      .from('quiz_topics')
      .select('id, topic_name, level')
      .ilike('topic_name', likePattern)
      .limit(RESULT_LIMIT_PER_CATEGORY)
  ]);

  return res.status(200).json({
    query,
    notes: notesRes.data || [],
    glossary: glossaryRes.data || [],
    past_papers: papersRes.data || [],
    flashcards: flashcardsRes.data || [],
    quizzes: quizzesRes.data || []
  });
}
