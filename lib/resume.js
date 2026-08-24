import { supabase } from './core.js';
import { SecurityError } from './security-middleware.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'get_resume') return getResume(req, res, ctx);

  throw new SecurityError('Invalid path', 400);
}

async function getResume(req, res, ctx) {
  if (!ctx.authenticated) return res.status(200).json({ resume: null });

  const userId = ctx.userId;

  const [quizResult, flashcardResult, recallResult, readingResult] = await Promise.all([
    supabase
      .from('user_quiz_resume_state')
      .select('state, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_flashcard_state')
      .select('last_topic, last_deck_id, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('recall_sessions')
      .select('session_id, topic, level, class_name, unit_id, group_id, current_index, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reading_progress')
      .select('note_id, completed, last_accessed')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('last_accessed', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const candidates = [];

  if (quizResult.data?.updated_at && quizResult.data?.state) {
    candidates.push({
      module: 'quiz',
      updated_at: quizResult.data.updated_at,
      payload: quizResult.data.state
    });
  }

  if (flashcardResult.data?.updated_at && flashcardResult.data?.last_deck_id) {
    candidates.push({
      module: 'flashcards',
      updated_at: flashcardResult.data.updated_at,
      payload: {
        deck_id: flashcardResult.data.last_deck_id,
        topic: flashcardResult.data.last_topic
      }
    });
  }

  if (recallResult.data?.updated_at) {
    candidates.push({
      module: 'recall',
      updated_at: recallResult.data.updated_at,
      payload: {
        session_id: recallResult.data.session_id,
        topic: recallResult.data.topic,
        level: recallResult.data.level,
        class_name: recallResult.data.class_name,
        unit_id: recallResult.data.unit_id,
        group_id: recallResult.data.group_id,
        current_index: recallResult.data.current_index
      }
    });
  }

  if (readingResult.data?.last_accessed && readingResult.data?.note_id) {
    candidates.push({
      module: 'notes',
      updated_at: readingResult.data.last_accessed,
      payload: { note_id: readingResult.data.note_id }
    });
  }

  if (candidates.length === 0) return res.status(200).json({ resume: null });

  candidates.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return res.status(200).json({ resume: candidates[0] });
}
