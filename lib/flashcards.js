 import { supabase } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';
import { createNotification } from './notifications.js';
import crypto from 'crypto';

function normalizeString(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

function containsPhrase(sentence, phrase) {
  return sentence.toLowerCase().includes(phrase.toLowerCase().trim());
}

function isNegated(sentence, concept) {
  const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\bnot\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bisn't\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\baren't\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bwasn't\\s+${escaped}\\b`, 'i'),
  ];
  return patterns.some(p => p.test(sentence));
}

function semanticMatch(userAnswer, acceptedItems, keywords = []) {
  const normalized = normalizeString(userAnswer);

  for (const item of acceptedItems) {
    const term = typeof item === 'string' ? item : item.term;
    const explanation = typeof item === 'object' ? item.explanation || null : null;
    const normalizedTerm = normalizeString(term);

    if (normalized === normalizedTerm) {
      return { match: true, strength: 'excellent', matched: term, explanation };
    }

    if (containsPhrase(userAnswer, term) && !isNegated(userAnswer, term)) {
      return { match: true, strength: 'excellent', matched: term, explanation };
    }

    const distance = levenshteinDistance(normalized, normalizedTerm);
    const maxLen = Math.max(normalized.length, normalizedTerm.length);
    const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;
    if (normalizedTerm.length >= 5 && similarity >= 0.85) {
      return { match: true, strength: 'strong', matched: term, explanation };
    }
  }

  for (const keyword of keywords) {
    const normalizedKw = normalizeString(typeof keyword === 'string' ? keyword : keyword.term || '');
    if (normalized.includes(normalizedKw) && normalizedKw.length >= 3) {
      return { match: true, strength: 'partial', matched: keyword };
    }
  }

  return { match: false, strength: 'incorrect' };
}

function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function isValidLevel(level) {
  return ['O-Level', 'A-Level', 'Pharmacy'].includes(level);
}

function isValidConfidence(c) {
  return ['Beginner', 'Fair', 'Good', 'Great', 'Expert'].includes(c);
}

function isValidDiscipline(d) {
  return ['Biology', 'Pharmacy'].includes(d);
}

function isValidMode(m) {
  return ['flip', 'typed', 'multiple_choice', 'structure_identification'].includes(m);
}

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'list':             return listFlashcards(req, res);
      case 'decks':            return getDecks(req, res);
      case 'deck':             return getDeck(req, res);
      case 'known':            return getKnown(req, res, ctx.userId);
      case 'progress':         return getProgress(req, res, ctx.userId);
      case 'onboarding_state': requireAuth(ctx); return getOnboardingState(req, res, ctx.userId);
      case 'active_session':   requireAuth(ctx); return getActiveSession(req, res, ctx.userId);
      case 'adaptive_decks':   requireAuth(ctx); return getAdaptiveDecks(req, res, ctx.userId);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'create_deck':       return createDeck(body, res, ctx);
      case 'update_deck':       return updateDeck(body, res, ctx);
      case 'delete_deck':       return deleteDeck(body, res, ctx);
      case 'add_cards':         return addCards(body, res, ctx);
      case 'remove_card':       return removeCard(body, res, ctx);
      case 'toggle_known':      requireAuth(ctx); return toggleKnown(body, res, ctx);
      case 'rate':              requireAuth(ctx); return rateCard(body, res, ctx);
      case 'check_answer':      return checkAnswer(body, res, ctx);
      case 'toggle_bookmark':   requireAuth(ctx); return toggleBookmark(body, res, ctx);
      case 'save_onboarding':   requireAuth(ctx); return saveOnboardingState(body, res, ctx);
      case 'reset_onboarding':  requireAuth(ctx); return resetOnboardingState(res, ctx);
      case 'start_session':     requireAuth(ctx); return startSession(body, res, ctx);
      case 'update_session':    requireAuth(ctx); return updateSession(body, res, ctx);
      case 'complete_session':  requireAuth(ctx); return completeSession(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }

  throw new SecurityError('Method not allowed', 405);
}


// ─── READ ────────────────────────────────────────────────────────────────────

async function listFlashcards(req, res) {
  const { level, discipline, class_programme, confidence } = req.query;

  let query = supabase
    .from('flashcard_decks')
    .select('id, category, level, discipline, class_programme, difficulty_confidence, card_types')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (level)            query = query.eq('level', level);
  if (discipline)       query = query.eq('discipline', discipline);
  if (class_programme)  query = query.eq('class_programme', class_programme);
  if (confidence)       query = query.eq('difficulty_confidence', confidence);

  const { data: decks, error } = await query;
  if (error) throw new SecurityError('Failed to fetch flashcards', 500);

  const cards = [];
  for (const deck of (decks || [])) {
    const { data: deckCards } = await supabase
      .from('flashcard_cards')
      .select('id, front_text, back_text, image_url, position, card_type, accepted_answers, accepted_functions, keywords, mc_options, mc_correct_index, structure_name, hint')
      .eq('deck_id', deck.id)
      .order('position', { ascending: true });

    (deckCards || []).forEach(c => cards.push({
      ...c,
      category: deck.category,
      level: deck.level,
      discipline: deck.discipline,
      class_programme: deck.class_programme,
      difficulty_confidence: deck.difficulty_confidence,
      deck_id: deck.id
    }));
  }

  return res.status(200).json(cards);
}

async function getDecks(req, res) {
  const { level, discipline, class_programme, confidence } = req.query;

  let query = supabase
    .from('flashcard_decks')
    .select('id, title, description, category, level, discipline, class_programme, difficulty_confidence, card_types, author, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (level)            query = query.eq('level', level);
  if (discipline)       query = query.eq('discipline', discipline);
  if (class_programme)  query = query.eq('class_programme', class_programme);
  if (confidence)       query = query.eq('difficulty_confidence', confidence);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch decks', 500);
  return res.status(200).json(data || []);
}

async function getDeck(req, res) {
  const { deck_id } = req.query;
  if (!deck_id || !isValidUUID(deck_id)) throw new SecurityError('Invalid deck_id', 400);

  const { data: deck, error } = await supabase
    .from('flashcard_decks')
    .select('*')
    .eq('id', deck_id)
    .single();

  if (error) throw new SecurityError('Deck not found', 404);

  const { data: cards } = await supabase
    .from('flashcard_cards')
    .select('*')
    .eq('deck_id', deck_id)
    .order('position', { ascending: true });

  return res.status(200).json({ ...deck, cards: cards || [] });
}

async function getKnown(req, res, userId) {
  if (!userId) return res.status(200).json([]);

  const { data, error } = await supabase
    .from('user_interactions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('interaction_type', 'favorite')
    .filter('metadata->>type', 'eq', 'flashcard_known');

  if (error) throw new SecurityError('Failed to fetch known cards', 500);
  return res.status(200).json((data || []).map(d => d.metadata?.flashcard_id).filter(Boolean));
}

async function getProgress(req, res, userId) {
  if (!userId) return res.status(200).json({});

  const { data } = await supabase
    .from('user_interactions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('interaction_type', 'favorite')
    .filter('metadata->>type', 'eq', 'flashcard_known');

  const knownIds = new Set((data || []).map(d => d.metadata?.flashcard_id).filter(Boolean));

  const { data: decks } = await supabase
    .from('flashcard_decks')
    .select('id, category, level, discipline, class_programme')
    .eq('is_active', true);

  const progress = {};
  for (const deck of (decks || [])) {
    const { data: deckCards } = await supabase
      .from('flashcard_cards')
      .select('id')
      .eq('deck_id', deck.id);

    const total = (deckCards || []).length;
    const known = (deckCards || []).filter(c => knownIds.has(c.id)).length;

    progress[deck.id] = {
      category: deck.category,
      level: deck.level,
      discipline: deck.discipline,
      class_programme: deck.class_programme,
      total,
      known,
      percent: total > 0 ? Math.round((known / total) * 100) : 0
    };
  }

  return res.status(200).json(progress);
}

async function getOnboardingState(req, res, userId) {
  const { data, error } = await supabase
    .from('user_flashcard_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new SecurityError('Failed to fetch onboarding state', 500);
  return res.status(200).json(data || { onboarding_complete: false });
}

async function getActiveSession(req, res, userId) {
  const { deck_id } = req.query;

  let query = supabase
    .from('user_flashcard_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_complete', false)
    .order('started_at', { ascending: false })
    .limit(1);

  if (deck_id && isValidUUID(deck_id)) {
    query = query.eq('deck_id', deck_id);
  }

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch active session', 500);
  return res.status(200).json(data?.[0] || null);
}

async function getAdaptiveDecks(req, res, userId) {
  const { data: state } = await supabase
    .from('user_flashcard_state')
    .select('selected_level, selected_discipline, selected_class, confidence_level')
    .eq('user_id', userId)
    .maybeSingle();

  if (!state?.selected_level) {
    return res.status(200).json([]);
  }

  let query = supabase
    .from('flashcard_decks')
    .select('id, title, description, category, level, discipline, class_programme, difficulty_confidence, card_types, author')
    .eq('is_active', true)
    .eq('level', state.selected_level);

  if (state.selected_discipline) query = query.eq('discipline', state.selected_discipline);
  if (state.selected_class)      query = query.eq('class_programme', state.selected_class);
  if (state.confidence_level)    query = query.eq('difficulty_confidence', state.confidence_level);

  const { data: decks, error } = await query.order('created_at', { ascending: false });
  if (error) throw new SecurityError('Failed to fetch adaptive decks', 500);

  return res.status(200).json(decks || []);
}


// ─── WRITE — ONBOARDING ──────────────────────────────────────────────────────

async function saveOnboardingState(body, res, ctx) {
  const { selected_level, selected_discipline, selected_class, confidence_level, onboarding_complete, last_topic, last_deck_id } = body;

  if (selected_level && !isValidLevel(selected_level)) throw new SecurityError('Invalid level', 400);
  if (selected_discipline && !isValidDiscipline(selected_discipline)) throw new SecurityError('Invalid discipline', 400);
  if (confidence_level && !isValidConfidence(confidence_level)) throw new SecurityError('Invalid confidence level', 400);

  const payload = {
    user_id: ctx.userId,
    updated_at: new Date().toISOString()
  };

  if (selected_level !== undefined)      payload.selected_level      = selected_level;
  if (selected_discipline !== undefined) payload.selected_discipline = selected_discipline;
  if (selected_class !== undefined)      payload.selected_class      = selected_class;
  if (confidence_level !== undefined)    payload.confidence_level    = confidence_level;
  if (onboarding_complete !== undefined) payload.onboarding_complete = onboarding_complete;
  if (last_topic !== undefined)          payload.last_topic          = last_topic;
  if (last_deck_id !== undefined)        payload.last_deck_id        = last_deck_id;

  const { error } = await supabase
    .from('user_flashcard_state')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw new SecurityError('Failed to save onboarding state', 500);

  if (onboarding_complete === true) {
    await createNotification(ctx.userId, 'flashcard_onboarding_complete', {
      level: selected_level || '',
      discipline: selected_discipline || ''
    });
  }

  return res.status(200).json({ success: true });
}

async function resetOnboardingState(res, ctx) {
  const { error } = await supabase
    .from('user_flashcard_state')
    .upsert({
      user_id: ctx.userId,
      selected_level: null,
      selected_discipline: null,
      selected_class: null,
      confidence_level: null,
      onboarding_complete: false,
      last_topic: null,
      last_deck_id: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw new SecurityError('Failed to reset onboarding state', 500);
  return res.status(200).json({ success: true });
}


// ─── WRITE — SESSIONS ────────────────────────────────────────────────────────

async function startSession(body, res, ctx) {
  const { deck_id, mode } = body;
  if (!deck_id || !isValidUUID(deck_id)) throw new SecurityError('Invalid deck_id', 400);
  if (mode && !isValidMode(mode)) throw new SecurityError('Invalid mode', 400);

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
      mode: mode || 'flip',
      cards_seen: [],
      cards_correct: [],
      cards_incorrect: [],
      current_index: 0,
      is_complete: false,
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to start session', 500);

  await supabase
    .from('user_flashcard_state')
    .upsert({
      user_id: ctx.userId,
      last_deck_id: deck_id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  return res.status(200).json({ session_id: data.id });
}

async function updateSession(body, res, ctx) {
  const { session_id, card_id, correct, current_index } = body;
  if (!session_id || !isValidUUID(session_id)) throw new SecurityError('Invalid session_id', 400);

  const { data: session, error } = await supabase
    .from('user_flashcard_sessions')
    .select('cards_seen, cards_correct, cards_incorrect')
    .eq('id', session_id)
    .eq('user_id', ctx.userId)
    .eq('is_complete', false)
    .single();

  if (error || !session) throw new SecurityError('Session not found', 404);

  const cardsSeen    = [...(session.cards_seen    || [])];
  const cardsCorrect = [...(session.cards_correct || [])];
  const cardsIncorrect = [...(session.cards_incorrect || [])];

  if (card_id && !cardsSeen.includes(card_id)) cardsSeen.push(card_id);
  if (card_id && correct === true  && !cardsCorrect.includes(card_id))   cardsCorrect.push(card_id);
  if (card_id && correct === false && !cardsIncorrect.includes(card_id)) cardsIncorrect.push(card_id);

  const updates = {
    cards_seen: cardsSeen,
    cards_correct: cardsCorrect,
    cards_incorrect: cardsIncorrect
  };

  if (typeof current_index === 'number') updates.current_index = current_index;

  await supabase
    .from('user_flashcard_sessions')
    .update(updates)
    .eq('id', session_id)
    .eq('user_id', ctx.userId);

  return res.status(200).json({ success: true });
}

async function completeSession(body, res, ctx) {
  const { session_id } = body;
  if (!session_id || !isValidUUID(session_id)) throw new SecurityError('Invalid session_id', 400);

  const { data: session, error } = await supabase
    .from('user_flashcard_sessions')
    .select('cards_seen, cards_correct, cards_incorrect, deck_id')
    .eq('id', session_id)
    .eq('user_id', ctx.userId)
    .single();

  if (error || !session) throw new SecurityError('Session not found', 404);

  await supabase
    .from('user_flashcard_sessions')
    .update({ is_complete: true, completed_at: new Date().toISOString() })
    .eq('id', session_id)
    .eq('user_id', ctx.userId);

  const cardCount  = (session.cards_seen    || []).length;
  const correct    = (session.cards_correct  || []).length;
  const incorrect  = (session.cards_incorrect || []).length;
  const score      = cardCount > 0 ? Math.round((correct / cardCount) * 100) : 0;

  if (cardCount > 0) {
    await createNotification(ctx.userId, 'flashcard_session_complete', { card_count: cardCount });
  }

  return res.status(200).json({ success: true, card_count: cardCount, correct, incorrect, score });
}


// ─── WRITE — CARDS ───────────────────────────────────────────────────────────

async function toggleKnown(body, res, ctx) {
  const { flashcard_id } = body;
  if (!flashcard_id || !isValidUUID(flashcard_id)) throw new SecurityError('Invalid flashcard_id', 400);

  const { data: existing } = await supabase
    .from('user_interactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'favorite')
    .filter('metadata->>type', 'eq', 'flashcard_known')
    .filter('metadata->>flashcard_id', 'eq', flashcard_id)
    .maybeSingle();

  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ known: false });
  }

  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'favorite',
    metadata: { type: 'flashcard_known', flashcard_id }
  });

  return res.status(200).json({ known: true });
}

async function rateCard(body, res, ctx) {
  const { flashcard_id, difficulty } = body;
  if (!flashcard_id || !difficulty) throw new SecurityError('flashcard_id and difficulty required', 400);

  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'rating',
    metadata: { type: 'flashcard_rating', flashcard_id, difficulty }
  });

  return res.status(200).json({ success: true });
}

async function checkAnswer(body, res, ctx) {
  const { flashcard_id, user_answer, check_type } = body;
  if (!flashcard_id || !isValidUUID(flashcard_id)) throw new SecurityError('Invalid flashcard_id', 400);
  if (!user_answer || typeof user_answer !== 'string') throw new SecurityError('user_answer required', 400);
  if (user_answer.length > 500) throw new SecurityError('Answer too long', 400);

  const { data: card, error } = await supabase
    .from('flashcard_cards')
    .select('back_text, card_type, accepted_answers, accepted_functions, keywords, mc_correct_index, mc_options, structure_name')
    .eq('id', flashcard_id)
    .single();

  if (error || !card) throw new SecurityError('Card not found', 404);

  if (card.card_type === 'multiple_choice') {
    const selected = parseInt(user_answer, 10);
    const correct  = selected === card.mc_correct_index;
    return res.status(200).json({
      correct,
      strength: correct ? 'excellent' : 'incorrect',
      correct_answer: card.mc_options?.[card.mc_correct_index] || card.back_text
    });
  }

  const primaryAnswer  = [{ term: card.back_text }];
  const acceptedItems  = (card.accepted_answers?.length ? card.accepted_answers : primaryAnswer);
  const checkFunctions = check_type === 'function';
  const itemsToCheck   = checkFunctions && card.accepted_functions?.length
    ? card.accepted_functions
    : acceptedItems;

  const result = semanticMatch(user_answer, itemsToCheck, card.keywords || []);

  if (ctx.userId && result.match) {
    await supabase.from('user_interactions').insert({
      user_id: ctx.userId,
      interaction_type: 'rating',
      metadata: { type: 'flashcard_answer', flashcard_id, strength: result.strength }
    }).catch(() => {});
  }

  return res.status(200).json({
    correct:        result.match,
    strength:       result.strength,
    matched:        result.matched || null,
    explanation:    result.explanation || null,
    correct_answer: card.back_text,
    structure_name: card.structure_name || null
  });
}

async function toggleBookmark(body, res, ctx) {
  const { flashcard_id } = body;
  if (!flashcard_id || !isValidUUID(flashcard_id)) throw new SecurityError('Invalid flashcard_id', 400);

  const { data: existing } = await supabase
    .from('user_interactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'favorite')
    .filter('metadata->>type', 'eq', 'flashcard_bookmark')
    .filter('metadata->>flashcard_id', 'eq', flashcard_id)
    .maybeSingle();

  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ bookmarked: false });
  }

  await supabase.from('user_interactions').insert({
    user_id: ctx.userId,
    interaction_type: 'favorite',
    metadata: { type: 'flashcard_bookmark', flashcard_id }
  });

  return res.status(200).json({ bookmarked: true });
}


// ─── ADMIN — DECK CRUD ───────────────────────────────────────────────────────

async function createDeck(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin required', 403);

  const { title, description, category, level, discipline, class_programme, difficulty_confidence, card_types, cards } = body;
  if (!title || !category || !level) throw new SecurityError('title, category and level required', 400);
  if (!isValidLevel(level)) throw new SecurityError('Invalid level', 400);
  if (discipline && !isValidDiscipline(discipline)) throw new SecurityError('Invalid discipline', 400);
  if (difficulty_confidence && !isValidConfidence(difficulty_confidence)) throw new SecurityError('Invalid confidence', 400);

  const { data: deck, error } = await supabase
    .from('flashcard_decks')
    .insert({
      title,
      description:          description || '',
      category,
      level,
      discipline:           discipline || null,
      class_programme:      class_programme || null,
      difficulty_confidence: difficulty_confidence || null,
      card_types:           card_types || ['flip'],
      is_active:            true,
      created_by:           ctx.userId,
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new SecurityError('Failed to create deck', 500);

  if (cards?.length) {
    const cardRows = cards.map((c, i) => buildCardRow(deck.id, c, i));
    await supabase.from('flashcard_cards').insert(cardRows);
  }

  return res.status(200).json({ success: true, deck_id: deck.id });
}

async function updateDeck(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin required', 403);

  const { deck_id, title, description, category, level, discipline, class_programme, difficulty_confidence, card_types, is_active, cards } = body;
  if (!deck_id || !isValidUUID(deck_id)) throw new SecurityError('Invalid deck_id', 400);
  if (level && !isValidLevel(level)) throw new SecurityError('Invalid level', 400);
  if (discipline && !isValidDiscipline(discipline)) throw new SecurityError('Invalid discipline', 400);
  if (difficulty_confidence && !isValidConfidence(difficulty_confidence)) throw new SecurityError('Invalid confidence', 400);

  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined)                updates.title                 = title;
  if (description !== undefined)          updates.description           = description;
  if (category !== undefined)             updates.category              = category;
  if (level !== undefined)                updates.level                 = level;
  if (discipline !== undefined)           updates.discipline            = discipline;
  if (class_programme !== undefined)      updates.class_programme       = class_programme;
  if (difficulty_confidence !== undefined) updates.difficulty_confidence = difficulty_confidence;
  if (card_types !== undefined)           updates.card_types            = card_types;
  if (is_active !== undefined)            updates.is_active             = is_active;

  await supabase.from('flashcard_decks').update(updates).eq('id', deck_id);

  if (cards !== undefined) {
    await supabase.from('flashcard_cards').delete().eq('deck_id', deck_id);
    if (cards.length) {
      const cardRows = cards.map((c, i) => buildCardRow(deck_id, c, i));
      await supabase.from('flashcard_cards').insert(cardRows);
    }
  }

  return res.status(200).json({ success: true });
}

async function deleteDeck(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin required', 403);
  const { deck_id } = body;
  if (!deck_id || !isValidUUID(deck_id)) throw new SecurityError('Invalid deck_id', 400);

  await supabase.from('flashcard_cards').delete().eq('deck_id', deck_id);
  await supabase.from('user_flashcard_sessions').delete().eq('deck_id', deck_id);
  await supabase.from('flashcard_decks').delete().eq('id', deck_id);

  return res.status(200).json({ success: true });
}

async function addCards(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin required', 403);
  const { deck_id, cards } = body;
  if (!deck_id || !isValidUUID(deck_id)) throw new SecurityError('Invalid deck_id', 400);
  if (!cards?.length) throw new SecurityError('cards required', 400);

  const { count } = await supabase
    .from('flashcard_cards')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deck_id);

  const cardRows = cards.map((c, i) => buildCardRow(deck_id, c, (count || 0) + i));
  const { error } = await supabase.from('flashcard_cards').insert(cardRows);
  if (error) throw new SecurityError('Failed to add cards', 500);

  return res.status(200).json({ success: true });
}

async function removeCard(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin required', 403);
  const { card_id } = body;
  if (!card_id || !isValidUUID(card_id)) throw new SecurityError('Invalid card_id', 400);
  await supabase.from('flashcard_cards').delete().eq('id', card_id);
  return res.status(200).json({ success: true });
}


// ─── HELPERS ─────────────────────────────────────────────────────────────────

function buildCardRow(deckId, c, position) {
  return {
    deck_id:            deckId,
    front_text:         c.front_text         || '',
    back_text:          c.back_text          || '',
    image_url:          c.image_url          || null,
    audio_url:          c.audio_url          || null,
    position,
    card_type:          c.card_type          || 'flip',
    accepted_answers:   c.accepted_answers   || [],
    accepted_functions: c.accepted_functions || [],
    keywords:           c.keywords           || [],
    mc_options:         c.mc_options         || [],
    mc_correct_index:   c.mc_correct_index   ?? null,
    structure_name:     c.structure_name     || null,
    hint:               c.hint               || null,
    created_at:         new Date().toISOString()
  };
}
