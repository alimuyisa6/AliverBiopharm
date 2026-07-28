 import { supabase, canAccessLevel, isAdmin } from './core.js';
import { parseAndValidateBody, requireAuth, requireAdmin, SecurityError } from './security-middleware.js';

const VALID_MODES = ['flip', 'typed', 'multiple_choice', 'structure_identification'];
const VALID_CONFIDENCE = ['Beginner', 'Fair', 'Good', 'Great', 'Expert'];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'list': return listDecks(req, res, ctx);
      case 'deck': return getDeck(req, res, ctx);
      case 'decks': return getDecksSummary(req, res, ctx);
      case 'onboarding_state': requireAuth(ctx); return getOnboardingState(req, res, ctx);
      case 'active_session': requireAuth(ctx); return getActiveSession(req, res, ctx);
      case 'adaptive_decks': requireAuth(ctx); return getAdaptiveDecks(req, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'create_deck': requireAdmin(ctx); return createDeck(body, res, ctx);
      case 'update_deck': requireAdmin(ctx); return updateDeck(body, res, ctx);
      case 'delete_deck': requireAdmin(ctx); return deleteDeck(body, res, ctx);
      case 'add_cards': requireAdmin(ctx); return addCards(body, res, ctx);
      case 'remove_card': requireAdmin(ctx); return removeCard(body, res, ctx);
      case 'toggle_known': requireAuth(ctx); return toggleKnown(body, res, ctx);
      case 'check_answer': return checkAnswer(body, res, ctx);
      case 'save_onboarding': requireAuth(ctx); return saveOnboarding(body, res, ctx);
      case 'reset_onboarding': requireAuth(ctx); return resetOnboarding(res, ctx);
      case 'start_session': requireAuth(ctx); return startSession(body, res, ctx);
      case 'update_session': requireAuth(ctx); return updateSession(body, res, ctx);
      case 'complete_session': requireAuth(ctx); return completeSession(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

async function listDecks(req, res, ctx) {
  const { unit_id } = req.query;
  let query = supabase.from('flashcard_decks').select('id, title, description, category, unit_id, card_types, difficulty_confidence').eq('is_active', true).order('created_at', { ascending: false });
  if (unit_id) query = query.eq('unit_id', unit_id);
  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch decks', 500);
  return res.status(200).json(data || []);
}

async function getDeck(req, res, ctx) {
  const { deck_id } = req.query;
  if (!deck_id) throw new SecurityError('deck_id required', 400);
  const { data: deck, error } = await supabase.from('flashcard_decks').select('*').eq('id', deck_id).maybeSingle();
  if (error || !deck) throw new SecurityError('Deck not found', 404);
  const { data: cards } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deck_id).order('position', { ascending: true });
  return res.status(200).json({ ...deck, cards: cards || [] });
}

async function getDecksSummary(req, res, ctx) {
  const { unit_id } = req.query;
  let query = supabase.from('flashcard_decks').select('id, title, description, category, unit_id, card_types, difficulty_confidence').eq('is_active', true).order('created_at', { ascending: false });
  if (unit_id) query = query.eq('unit_id', unit_id);
  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch decks', 500);
  return res.status(200).json(data || []);
}

async function getOnboardingState(req, res, ctx) {
  const { data } = await supabase.from('user_flashcard_state').select('*').eq('user_id', ctx.userId).maybeSingle();
  return res.status(200).json(data || { onboarding_complete: false });
}

async function saveOnboarding(body, res, ctx) {
  const { selected_level, selected_discipline, selected_class, confidence_level, onboarding_complete } = body;
  await supabase.from('user_flashcard_state').upsert({
    user_id: ctx.userId,
    selected_level: selected_level || null,
    selected_discipline: selected_discipline || null,
    selected_class: selected_class || null,
    confidence_level: confidence_level || null,
    onboarding_complete: onboarding_complete || false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  return res.status(200).json({ success: true });
}

async function resetOnboarding(res, ctx) {
  await supabase.from('user_flashcard_state').delete().eq('user_id', ctx.userId);
  return res.status(200).json({ success: true });
}

async function getActiveSession(req, res, ctx) {
  const { deck_id } = req.query;
  let query = supabase.from('user_flashcard_sessions').select('*').eq('user_id', ctx.userId).eq('is_complete', false).order('started_at', { ascending: false }).limit(1);
  if (deck_id) query = query.eq('deck_id', deck_id);
  const { data } = await query;
  return res.status(200).json(data?.[0] || null);
}

async function startSession(body, res, ctx) {
  const { deck_id, mode } = body;
  if (!deck_id) throw new SecurityError('deck_id required', 400);
  const effectiveMode = VALID_MODES.includes(mode) ? mode : 'flip';
  await supabase.from('user_flashcard_sessions').update({ is_complete: true, completed_at: new Date().toISOString() }).eq('user_id', ctx.userId).eq('deck_id', deck_id).eq('is_complete', false);
  const { data, error } = await supabase.from('user_flashcard_sessions').insert({
    user_id: ctx.userId, deck_id, mode: effectiveMode,
    cards_seen: [], cards_correct: [], cards_incorrect: [],
    current_index: 0, is_complete: false, started_at: new Date().toISOString()
  }).select().single();
  if (error) throw new SecurityError('Failed to start session', 500);
  await supabase.from('user_flashcard_state').upsert({ user_id: ctx.userId, last_deck_id: deck_id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return res.status(200).json({ session_id: data.id });
}

async function updateSession(body, res, ctx) {
  const { session_id, card_id, correct, current_index } = body;
  if (!session_id) throw new SecurityError('session_id required', 400);
  const { data: session } = await supabase.from('user_flashcard_sessions').select('*').eq('id', session_id).eq('user_id', ctx.userId).eq('is_complete', false).maybeSingle();
  if (!session) throw new SecurityError('Session not found', 404);
  const cardsSeen = [...(session.cards_seen || [])];
  const cardsCorrect = [...(session.cards_correct || [])];
  const cardsIncorrect = [...(session.cards_incorrect || [])];
  if (card_id && !cardsSeen.includes(card_id)) cardsSeen.push(card_id);
  if (card_id && correct === true && !cardsCorrect.includes(card_id)) cardsCorrect.push(card_id);
  if (card_id && correct === false && !cardsIncorrect.includes(card_id)) cardsIncorrect.push(card_id);
  await supabase.from('user_flashcard_sessions').update({
    cards_seen: cardsSeen, cards_correct: cardsCorrect, cards_incorrect: cardsIncorrect,
    current_index: current_index ?? session.current_index
  }).eq('id', session_id).eq('user_id', ctx.userId);
  return res.status(200).json({ success: true });
}

async function completeSession(body, res, ctx) {
  const { session_id } = body;
  if (!session_id) throw new SecurityError('session_id required', 400);
  const { data: session } = await supabase.from('user_flashcard_sessions').select('*').eq('id', session_id).eq('user_id', ctx.userId).maybeSingle();
  if (!session) throw new SecurityError('Session not found', 404);
  await supabase.from('user_flashcard_sessions').update({ is_complete: true, completed_at: new Date().toISOString() }).eq('id', session_id);
  const correct = (session.cards_correct || []).length;
  const incorrect = (session.cards_incorrect || []).length;
  const total = (session.cards_seen || []).length;
  return res.status(200).json({ card_count: total, correct, incorrect, score: total ? Math.round((correct / total) * 100) : 0 });
}

async function getAdaptiveDecks(req, res, ctx) {
  const { data: state } = await supabase.from('user_flashcard_state').select('*').eq('user_id', ctx.userId).maybeSingle();
  if (!state?.selected_level || !state?.selected_discipline || !state?.selected_class) return res.status(200).json([]);
  let query = supabase.from('flashcard_decks').select('id, title, description, category, unit_id, card_types, difficulty_confidence').eq('is_active', true).eq('level', state.selected_level).eq('discipline', state.selected_discipline).eq('class_programme', state.selected_class);
  const { data } = await query.order('created_at', { ascending: false });
  if (!data) return res.status(200).json([]);
  const confidenceRank = { Beginner: 0, Fair: 1, Good: 2, Great: 3, Expert: 4 };
  const targetRank = confidenceRank[state.confidence_level] ?? 0;
  data.sort((a, b) => {
    const ra = a.difficulty_confidence ? (confidenceRank[a.difficulty_confidence] ?? 0) : 0;
    const rb = b.difficulty_confidence ? (confidenceRank[b.difficulty_confidence] ?? 0) : 0;
    return Math.abs(ra - targetRank) - Math.abs(rb - targetRank);
  });
  return res.status(200).json(data);
}

async function toggleKnown(body, res, ctx) {
  const { flashcard_id } = body;
  if (!flashcard_id) throw new SecurityError('flashcard_id required', 400);
  const { data: existing } = await supabase.from('content_reactions').select('id').eq('user_id', ctx.userId).eq('content_type', 'flashcard_card').eq('content_id', flashcard_id).eq('reaction_type', 'bookmark').maybeSingle();
  if (existing) {
    await supabase.from('content_reactions').delete().eq('id', existing.id);
    return res.status(200).json({ known: false });
  }
  await supabase.from('content_reactions').insert({ user_id: ctx.userId, content_type: 'flashcard_card', content_id: flashcard_id, reaction_type: 'bookmark' });
  return res.status(200).json({ known: true });
}

async function checkAnswer(body, res, ctx) {
  const { flashcard_id, user_answer, check_type } = body;
  if (!flashcard_id || !user_answer) throw new SecurityError('flashcard_id and user_answer required', 400);
  const { data: card } = await supabase.from('flashcard_cards').select('*').eq('id', flashcard_id).maybeSingle();
  if (!card) throw new SecurityError('Card not found', 404);
  if (card.card_type === 'multiple_choice') {
    const selected = parseInt(user_answer, 10);
    const correct = selected === card.mc_correct_index;
    return res.status(200).json({ correct, strength: correct ? 'excellent' : 'incorrect', correct_answer: card.mc_options?.[card.mc_correct_index] || card.back_text });
  }
  const acceptedItems = card.accepted_answers?.length ? card.accepted_answers : [{ term: card.back_text }];
  const itemsToCheck = check_type === 'function' && card.accepted_functions?.length ? card.accepted_functions : acceptedItems;
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
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      matrix[j][i] = Math.min(matrix[j-1][i] + 1, matrix[j][i-1] + 1, matrix[j-1][i-1] + (a[i-1] === b[j-1] ? 0 : 1));
    }
  }
  return matrix[b.length][a.length];
}

async function createDeck(body, res, ctx) {
  const { title, description, category, unit_id, difficulty_confidence, card_types, cards } = body;
  if (!title || !category || !unit_id) throw new SecurityError('title, category, unit_id required', 400);
  const { data: deck, error } = await supabase.from('flashcard_decks').insert({
    title, description: description || '', category, unit_id,
    difficulty_confidence: difficulty_confidence || null,
    card_types: card_types || ['flip'],
    is_active: true,
    created_by: ctx.userId
  }).select().single();
  if (error) throw new SecurityError('Failed to create deck', 500);
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
      await supabase.from('flashcard_cards').insert(updates.cards.map((c, i) => buildCardRow(deck_id, c, i)));
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
  const { count } = await supabase.from('flashcard_cards').select('id', { count: 'exact', head: true }).eq('deck_id', deck_id);
  await supabase.from('flashcard_cards').insert(cards.map((c, i) => buildCardRow(deck_id, c, (count || 0) + i)));
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
    hint: card.hint || null
  };
}
