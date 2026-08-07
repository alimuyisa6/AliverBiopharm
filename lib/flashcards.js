 import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError,
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

const VALID_MODES = ['flip', 'typed', 'multiple_choice', 'structure_identification'];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    requireAuth(ctx);
    switch (path) {
      case 'list':             return listDecks(req, res, ctx);
      case 'deck':             return getDeck(req, res, ctx);
      case 'decks':            return getDecksSummary(req, res, ctx);
      case 'active_session':   return getActiveSession(req, res, ctx);
      case 'adaptive_decks':   return getAdaptiveDecks(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'create_deck':        requireAdmin(ctx); return createDeck(body, res, ctx);
      case 'update_deck':        requireAdmin(ctx); return updateDeck(body, res, ctx);
      case 'delete_deck':        requireAdmin(ctx); return deleteDeck(body, res, ctx);
      case 'add_cards':          requireAdmin(ctx); return addCards(body, res, ctx);
      case 'remove_card':        requireAdmin(ctx); return removeCard(body, res, ctx);
      case 'toggle_known':       requireAuth(ctx); return toggleKnown(body, res, ctx);
      case 'check_answer':       requireAuth(ctx); return checkAnswer(body, res, ctx);
      case 'start_session':      requireAuth(ctx); return startSession(body, res, ctx);
      case 'update_session':     requireAuth(ctx); return updateSession(body, res, ctx);
      case 'complete_session':   requireAuth(ctx); return completeSession(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}

// ---------- helpers ----------

async function getActiveUnitIds(ctx) {
  if (ctx.adminData) return null; // admins bypass scope

  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) return [];

  const { data: units } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true);

  return (units || []).map(u => u.id);
}

function validateUnitAccess(allowedUnitIds, unitId) {
  if (allowedUnitIds !== null && !allowedUnitIds.includes(unitId)) {
    throw new SecurityError('Deck not available in your curriculum', 403);
  }
}

async function filterDecksByScope(query, allowedUnitIds) {
  if (allowedUnitIds !== null) {
    return query.in('unit_id', allowedUnitIds);
  }
  return query;
}

// ---------- endpoints ----------

async function listDecks(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json([]);
  }

  const { unit_id } = req.query;
  let query = supabase
    .from('flashcard_decks')
    .select('id, title, description, category, unit_id, card_types, difficulty_confidence')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (unit_id) {
    validateUnitAccess(allowedUnitIds, unit_id);
    query = query.eq('unit_id', unit_id);
  } else {
    query = await filterDecksByScope(query, allowedUnitIds);
  }

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function getDeck(req, res, ctx) {
  const { deck_id } = req.query;
  if (!deck_id) throw new SecurityError('deck_id required', 400);

  const { data: deck } = await supabase
    .from('flashcard_decks')
    .select('*')
    .eq('id', deck_id)
    .maybeSingle();

  if (!deck) throw new SecurityError('Deck not found', 404);

  const allowedUnitIds = await getActiveUnitIds(ctx);
  validateUnitAccess(allowedUnitIds, deck.unit_id);

  const { data: cards } = await supabase
    .from('flashcard_cards')
    .select('*')
    .eq('deck_id', deck_id)
    .order('position', { ascending: true });

  return res.status(200).json({ ...deck, cards: cards || [] });
}

async function getDecksSummary(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json([]);
  }

  const { unit_id } = req.query;
  let query = supabase
    .from('flashcard_decks')
    .select('id, title, description, category, unit_id, card_types')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (unit_id) {
    validateUnitAccess(allowedUnitIds, unit_id);
    query = query.eq('unit_id', unit_id);
  } else {
    query = await filterDecksByScope(query, allowedUnitIds);
  }

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function getActiveSession(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json(null);
  }

  const { deck_id } = req.query;
  let sessionQuery = supabase
    .from('user_flashcard_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('is_complete', false)
    .order('started_at', { ascending: false })
    .limit(1);

  if (deck_id) {
    // verify deck ownership only if a specific deck requested
    const { data: deck } = await supabase
      .from('flashcard_decks')
      .select('unit_id')
      .eq('id', deck_id)
      .maybeSingle();
    if (!deck) throw new SecurityError('Deck not found', 404);
    validateUnitAccess(allowedUnitIds, deck.unit_id);
    sessionQuery = sessionQuery.eq('deck_id', deck_id);
  } else {
    // filter sessions whose deck belongs to allowed units
    const { data: deckIds } = await supabase
      .from('flashcard_decks')
      .select('id')
      .in('unit_id', allowedUnitIds);

    const allowedDeckIds = (deckIds || []).map(d => d.id);
    if (!allowedDeckIds.length) return res.status(200).json(null);
    sessionQuery = sessionQuery.in('deck_id', allowedDeckIds);
  }

  const { data } = await sessionQuery;
  return res.status(200).json(data?.[0] || null);
}

async function getAdaptiveDecks(req, res, ctx) {
  const allowedUnitIds = await getActiveUnitIds(ctx);
  if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
    return res.status(200).json([]);
  }

  let query = supabase
    .from('flashcard_decks')
    .select('id, title, description, category, unit_id, card_types, difficulty_confidence')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  query = await filterDecksByScope(query, allowedUnitIds);

  const { data } = await query;
  return res.status(200).json(data || []);
}

async function startSession(body, res, ctx) {
  const { deck_id, mode } = body;
  if (!deck_id) throw new SecurityError('deck_id required', 400);

  const allowedUnitIds = await getActiveUnitIds(ctx);
  const { data: deck } = await supabase
    .from('flashcard_decks')
    .select('unit_id')
    .eq('id', deck_id)
    .maybeSingle();

  if (!deck) throw new SecurityError('Deck not found', 404);
  validateUnitAccess(allowedUnitIds, deck.unit_id);

  const effectiveMode = VALID_MODES.includes(mode) ? mode : 'flip';

  await supabase
    .from('user_flashcard_sessions')
    .update({ is_complete: true, completed_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('deck_id', deck_id)
    .eq('is_complete', false);

  const { data, error } = await supabase
    .from('user_flashcard_sessions')
    .insert({
      user_id: ctx.userId,
      deck_id,
      mode: effectiveMode,
      cards_seen: [],
      cards_correct: [],
      cards_incorrect: [],
      current_index: 0,
      is_complete: false,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to start session', 500);
  return res.status(200).json({ session_id: data.id });
}

async function updateSession(body, res, ctx) {
  const { session_id, card_id, correct, current_index } = body;
  if (!session_id) throw new SecurityError('session_id required', 400);

  const { data: session } = await supabase
    .from('user_flashcard_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', ctx.userId)
    .eq('is_complete', false)
    .maybeSingle();

  if (!session) throw new SecurityError('Session not found', 404);

  const cardsSeen = [...(session.cards_seen || [])];
  const cardsCorrect = [...(session.cards_correct || [])];
  const cardsIncorrect = [...(session.cards_incorrect || [])];

  if (card_id && !cardsSeen.includes(card_id)) cardsSeen.push(card_id);
  if (card_id && correct === true && !cardsCorrect.includes(card_id)) cardsCorrect.push(card_id);
  if (card_id && correct === false && !cardsIncorrect.includes(card_id)) cardsIncorrect.push(card_id);

  await supabase
    .from('user_flashcard_sessions')
    .update({
      cards_seen: cardsSeen,
      cards_correct: cardsCorrect,
      cards_incorrect: cardsIncorrect,
      current_index: current_index ?? session.current_index,
    })
    .eq('id', session_id)
    .eq('user_id', ctx.userId);

  return res.status(200).json({ success: true });
}

async function completeSession(body, res, ctx) {
  const { session_id } = body;
  if (!session_id) throw new SecurityError('session_id required', 400);

  const { data: session } = await supabase
    .from('user_flashcard_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!session) throw new SecurityError('Session not found', 404);

  await supabase
    .from('user_flashcard_sessions')
    .update({ is_complete: true, completed_at: new Date().toISOString() })
    .eq('id', session_id);

  const correct = (session.cards_correct || []).length;
  const incorrect = (session.cards_incorrect || []).length;
  const total = (session.cards_seen || []).length;

  return res.status(200).json({
    card_count: total,
    correct,
    incorrect,
    score: total ? Math.round((correct / total) * 100) : 0,
  });
}

async function toggleKnown(body, res, ctx) {
  const { flashcard_id } = body;
  if (!flashcard_id) throw new SecurityError('flashcard_id required', 400);

  const { data: existing } = await supabase
    .from('content_reactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('content_type', 'flashcard_card')
    .eq('content_id', flashcard_id)
    .eq('reaction_type', 'bookmark')
    .maybeSingle();

  if (existing) {
    await supabase.from('content_reactions').delete().eq('id', existing.id);
    return res.status(200).json({ known: false });
  }

  await supabase
    .from('content_reactions')
    .insert({
      user_id: ctx.userId,
      content_type: 'flashcard_card',
      content_id: flashcard_id,
      reaction_type: 'bookmark',
    });

  return res.status(200).json({ known: true });
}

async function checkAnswer(body, res, ctx) {
  const { flashcard_id, user_answer, check_type } = body;
  if (!flashcard_id || !user_answer) {
    throw new SecurityError('flashcard_id and user_answer required', 400);
  }

  const { data: card } = await supabase
    .from('flashcard_cards')
    .select('*')
    .eq('id', flashcard_id)
    .maybeSingle();

  if (!card) throw new SecurityError('Card not found', 404);

  if (card.card_type === 'multiple_choice') {
    const selected = parseInt(user_answer, 10);
    const correct = selected === card.mc_correct_index;
    return res.status(200).json({
      correct,
      strength: correct ? 'excellent' : 'incorrect',
      correct_answer: card.mc_options?.[card.mc_correct_index] || card.back_text,
    });
  }

  const acceptedItems = card.accepted_answers?.length
    ? card.accepted_answers
    : [{ term: card.back_text }];
  const itemsToCheck =
    check_type === 'function' && card.accepted_functions?.length
      ? card.accepted_functions
      : acceptedItems;

  const normalized = user_answer.trim();
  let result = { correct: false, strength: 'incorrect', correct_answer: card.back_text };

  for (const item of itemsToCheck) {
    const term = typeof item === 'string' ? item : item.term;
    if (normalized.toLowerCase() === term.toLowerCase()) {
      result = { correct: true, strength: 'excellent', matched: term };
      break;
    }
    if (normalized.toLowerCase().includes(term.toLowerCase()) && term.length > 3) {
      result = { correct: true, strength: 'strong', matched: term };
      break;
    }
    const dist = levenshteinDistance(normalized.toLowerCase(), term.toLowerCase());
    if (dist <= 2 && term.length > 4) {
      result = { correct: true, strength: 'strong', matched: term };
      break;
    }
  }

  return res.status(200).json(result);
}

function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[b.length][a.length];
}

// ---------- admin endpoints ----------

async function createDeck(body, res, ctx) {
  const { title, description, category, unit_id, difficulty_confidence, card_types, cards } = body;
  if (!title || !category || !unit_id) {
    throw new SecurityError('title, category, unit_id required', 400);
  }

  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('id', unit_id)
    .maybeSingle();

  if (!unit) throw new SecurityError('Curriculum unit not found', 404);

  const { data: deck } = await supabase
    .from('flashcard_decks')
    .insert({
      title,
      description: description || '',
      category,
      unit_id,
      difficulty_confidence: difficulty_confidence || null,
      card_types: card_types || ['flip'],
      is_active: true,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (!deck) throw new SecurityError('Failed to create deck', 500);

  if (cards?.length) {
    await supabase.from('flashcard_cards').insert(cards.map((c, i) => buildCardRow(deck.id, c, i)));
  }

  return res.status(200).json({ success: true, deck_id: deck.id });
}

async function updateDeck(body, res, ctx) {
  const { deck_id, ...updates } = body;
  if (!deck_id) throw new SecurityError('deck_id required', 400);

  if (updates.cards) {
    await supabase.from('flashcard_cards').delete().eq('deck_id', deck_id);
    if (updates.cards.length) {
      await supabase
        .from('flashcard_cards')
        .insert(updates.cards.map((c, i) => buildCardRow(deck_id, c, i)));
    }
    delete updates.cards;
  }

  updates.updated_at = new Date().toISOString();
  await supabase.from('flashcard_decks').update(updates).eq('id', deck_id);
  return res.status(200).json({ success: true });
}

async function deleteDeck(body, res, ctx) {
  const { deck_id } = body;
  if (!deck_id) throw new SecurityError('deck_id required', 400);
  await supabase.from('flashcard_decks').delete().eq('id', deck_id);
  return res.status(200).json({ success: true });
}

async function addCards(body, res, ctx) {
  const { deck_id, cards } = body;
  if (!deck_id || !cards?.length) throw new SecurityError('deck_id and cards required', 400);

  const { count } = await supabase
    .from('flashcard_cards')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deck_id);

  await supabase
    .from('flashcard_cards')
    .insert(cards.map((c, i) => buildCardRow(deck_id, c, (count || 0) + i)));

  return res.status(200).json({ success: true });
}

async function removeCard(body, res, ctx) {
  const { card_id } = body;
  if (!card_id) throw new SecurityError('card_id required', 400);
  await supabase.from('flashcard_cards').delete().eq('id', card_id);
  return res.status(200).json({ success: true });
}

function buildCardRow(deckId, card, position) {
  return {
    deck_id: deckId,
    front_text: card.front_text || '',
    back_text: card.back_text || '',
    image_url: card.image_url || null,
    audio_url: card.audio_url || null,
    position,
    card_type: card.card_type || 'flip',
    accepted_answers: card.accepted_answers || [],
    accepted_functions: card.accepted_functions || [],
    keywords: card.keywords || [],
    mc_options: card.mc_options || [],
    mc_correct_index: card.mc_correct_index ?? null,
    structure_name: card.structure_name || null,
    hint: card.hint || null,
  };
}
