 import { supabase, canAccessLevel, isAdmin, isValidLevel } from './core.js';
import { SecurityError } from './security-middleware.js';

const RESULT_LIMIT_PER_CATEGORY = 4;
const MAX_QUERY_LENGTH = 100;
const MIN_QUERY_LENGTH = 2;

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'global') {
    return globalSearch(req, res, ctx);
  }
  throw new SecurityError('Invalid action', 400);
}

async function globalSearch(req, res, ctx) {
  const rawQuery = req.query.q || '';
  const query = rawQuery.trim();

  if (query.length < MIN_QUERY_LENGTH) {
    return res.status(200).json({
      query,
      notes: [],
      glossary: [],
      past_papers: [],
      flashcards: [],
      quizzes: [],
      recall: []
    });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw new SecurityError('Search query too long', 400);
  }

  // Get user's effective level for filtering
  let userLevel = null;
  let isAdminUser = false;
  let isApprovedTeacher = false;
  let approvedTrack = null;
  let showAllContent = false;

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
      } else if (profile.role === 'teacher') {
        if (profile.is_approved_teacher) {
          isApprovedTeacher = true;
          approvedTrack = profile.approved_track;
          if (approvedTrack === 'ALL') {
            showAllContent = true;
          } else {
            userLevel = approvedTrack || profile.track;
          }
        } else {
          // Unapproved teacher sees nothing
          return res.status(200).json({
            query,
            notes: [],
            glossary: [],
            past_papers: [],
            flashcards: [],
            quizzes: [],
            recall: [],
            error: 'Teacher account pending approval'
          });
        }
      }
    }
  }

  // Escape SQL LIKE wildcards
  const escaped = query.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const likePattern = `%${escaped}%`;

  // Build query helper with level filtering
  const buildQuery = (table, select, ilikeColumn, additionalFilters = []) => {
    let q = supabase.from(table).select(select).ilike(ilikeColumn, likePattern);

    // Apply level filter if user has a specific level and not admin/ALL access
    if (userLevel && !showAllContent && !isAdminUser) {
      if (table === 'notes_structure') {
        q = q.eq('level', userLevel);
      } else if (table === 'glossary_terms') {
        q = q.filter('levels', 'cs', `{${userLevel}}`);
      } else if (table === 'past_papers') {
        q = q.eq('level', userLevel);
      } else if (table === 'flashcard_decks') {
        q = q.eq('level', userLevel);
      } else if (table === 'quiz_topics') {
        q = q.eq('level', userLevel);
      } else if (table === 'recall_questions_bank') {
        q = q.eq('level', userLevel);
      }
    } else if (isAdminUser || showAllContent) {
      // Admin or teacher with ALL access sees everything
    }

    // Apply additional filters
    for (const filter of additionalFilters) {
      q = q[filter.method || 'eq'](filter.column, filter.value);
    }

    return q.limit(RESULT_LIMIT_PER_CATEGORY);
  };

  const [notesRes, glossaryRes, papersRes, flashcardsRes, quizzesRes, recallRes] = await Promise.all([
    buildQuery('notes_structure', 'subtopic_id, subtopic_name, topic, level', 'subtopic_name'),
    buildQuery('glossary_terms', 'id, term, slug, plain_definition, levels', 'term'),
    buildQuery('past_papers', 'id, title, subject, year, level', 'title', [
      { column: 'is_active', value: true }
    ]),
    buildQuery('flashcard_decks', 'id, title, description, level, category', 'title', [
      { column: 'is_active', value: true }
    ]),
    buildQuery('quiz_topics', 'id, topic_name, level', 'topic_name'),
    buildQuery('recall_questions_bank', 'id, question_text, topic, level, difficulty', 'question_text', [
      { column: 'is_active', value: true }
    ])
  ]);

  return res.status(200).json({
    query,
    notes: notesRes.data || [],
    glossary: glossaryRes.data || [],
    past_papers: papersRes.data || [],
    flashcards: flashcardsRes.data || [],
    quizzes: quizzesRes.data || [],
    recall: recallRes.data || [],
    filtered_by_level: !!userLevel,
    level: userLevel,
    show_all: showAllContent || isAdminUser
  });
}
