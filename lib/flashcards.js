// /lib/flashcards.js
import { supabase, parseCookies, hashToken, validateSession, isAdmin } from './core.js';

async function parseBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); }

export async function handler(req, res, path, ctx) {
  const { userId, adminData, ip } = ctx;

  if (req.method === 'GET') {
    switch (path) {
      case 'list': return listFlashcards(req, res);
      case 'decks': return getDecks(req, res);
      case 'deck': return getDeck(req, res);
      case 'known': return getKnown(req, res, userId);
      case 'progress': return getProgress(req, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  if (req.method === 'POST') {
    const body = await parseBody(req);
    switch (path) {
      case 'create_deck': return createDeck(body, res, userId, adminData);
      case 'update_deck': return updateDeck(body, res, userId, adminData);
      case 'delete_deck': return deleteDeck(body, res, userId, adminData);
      case 'add_cards': return addCards(body, res, userId, adminData);
      case 'remove_card': return removeCard(body, res, userId, adminData);
      case 'toggle_known': return toggleKnown(body, res, userId);
      case 'rate': return rateCard(body, res, userId);
      case 'check_answer': return checkAnswer(body, res);
      case 'toggle_bookmark': return toggleBookmark(body, res, userId);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function listFlashcards(req, res) {
  const { data: decks, error } = await supabase.from('flashcard_decks').select('id, category, level').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const cards = [];
  for (const deck of (decks || [])) {
    const { data: deckCards } = await supabase.from('flashcard_cards').select('id, front_text, back_text, image_url, position').eq('deck_id', deck.id).order('position', { ascending: true });
    (deckCards || []).forEach(c => cards.push({ ...c, category: deck.category, level: deck.level, deck_id: deck.id }));
  }
  return res.status(200).json(cards);
}

async function getDecks(req, res) {
  const { data, error } = await supabase.from('flashcard_decks').select('id, title, description, category, level, author, created_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function getDeck(req, res) {
  const { deck_id } = req.query;
  if (!deck_id) return res.status(400).json({ error: 'deck_id required' });
  const { data: deck, error } = await supabase.from('flashcard_decks').select('*').eq('id', deck_id).single();
  if (error) return res.status(404).json({ error: 'Deck not found' });
  const { data: cards } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deck_id).order('position', { ascending: true });
  return res.status(200).json({ ...deck, cards: cards || [] });
}

async function getKnown(req, res, userId) {
  if (!userId) return res.status(200).json([]);
  const { data, error } = await supabase.from('user_interactions').select('metadata').eq('user_id', userId).eq('interaction_type', 'favorite').filter('metadata->>type', 'eq', 'flashcard_known');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json((data || []).map(d => d.metadata?.flashcard_id).filter(Boolean));
}

async function getProgress(req, res, userId) {
  if (!userId) return res.status(200).json({});
  const { data } = await supabase.from('user_interactions').select('metadata').eq('user_id', userId).eq('interaction_type', 'favorite').filter('metadata->>type', 'eq', 'flashcard_known');
  const knownIds = (data || []).map(d => d.metadata?.flashcard_id).filter(Boolean);
  const { data: decks } = await supabase.from('flashcard_decks').select('id, category');
  const progress = {};
  for (const deck of (decks || [])) {
    const { count } = await supabase.from('flashcard_cards').select('id', { count: 'exact', head: true }).eq('deck_id', deck.id);
    progress[deck.category] = { total: count || 0, reviewed: 0 };
  }
  return res.status(200).json(progress);
}

async function createDeck(body, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { title, description, category, level, cards } = body;
  if (!title || !category || !level) return res.status(400).json({ error: 'title, category and level required' });
  const { data: deck, error } = await supabase.from('flashcard_decks').insert({ title, description: description || '', category, level, created_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (cards && cards.length > 0) {
    const cardRows = cards.map((c, i) => ({ deck_id: deck.id, front_text: c.front_text, back_text: c.back_text, image_url: c.image_url || null, position: i, created_at: new Date().toISOString() }));
    await supabase.from('flashcard_cards').insert(cardRows);
  }
  return res.status(200).json({ success: true, deck_id: deck.id });
}

async function updateDeck(body, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { deck_id, title, description, category, level, cards } = body;
  if (!deck_id) return res.status(400).json({ error: 'deck_id required' });
  await supabase.from('flashcard_decks').update({ title, description, category, level, updated_at: new Date().toISOString() }).eq('id', deck_id);
  if (cards) {
    await supabase.from('flashcard_cards').delete().eq('deck_id', deck_id);
    const cardRows = cards.map((c, i) => ({ deck_id, front_text: c.front_text, back_text: c.back_text, image_url: c.image_url || null, position: i, created_at: new Date().toISOString() }));
    await supabase.from('flashcard_cards').insert(cardRows);
  }
  return res.status(200).json({ success: true });
}

async function deleteDeck(body, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { deck_id } = body;
  if (!deck_id) return res.status(400).json({ error: 'deck_id required' });
  await supabase.from('flashcard_cards').delete().eq('deck_id', deck_id);
  await supabase.from('flashcard_decks').delete().eq('id', deck_id);
  return res.status(200).json({ success: true });
}

async function addCards(body, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { deck_id, cards } = body;
  if (!deck_id || !cards || cards.length === 0) return res.status(400).json({ error: 'deck_id and cards required' });
  const { count } = await supabase.from('flashcard_cards').select('id', { count: 'exact', head: true }).eq('deck_id', deck_id);
  const cardRows = cards.map((c, i) => ({ deck_id, front_text: c.front_text, back_text: c.back_text, image_url: c.image_url || null, position: (count || 0) + i, created_at: new Date().toISOString() }));
  const { error } = await supabase.from('flashcard_cards').insert(cardRows);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function removeCard(body, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { card_id } = body;
  if (!card_id) return res.status(400).json({ error: 'card_id required' });
  await supabase.from('flashcard_cards').delete().eq('id', card_id);
  return res.status(200).json({ success: true });
}

async function toggleKnown(body, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { flashcard_id } = body;
  if (!flashcard_id) return res.status(400).json({ error: 'flashcard_id required' });
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('interaction_type', 'favorite').filter('metadata->>type', 'eq', 'flashcard_known').filter('metadata->>flashcard_id', 'eq', flashcard_id).maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ known: false });
  }
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'favorite', metadata: { type: 'flashcard_known', flashcard_id } });
  return res.status(200).json({ known: true });
}

async function rateCard(body, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { flashcard_id, difficulty } = body;
  if (!flashcard_id || !difficulty) return res.status(400).json({ error: 'flashcard_id and difficulty required' });
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'rating', metadata: { type: 'flashcard_rating', flashcard_id, difficulty } });
  return res.status(200).json({ success: true });
}

async function checkAnswer(body, res) {
  const { flashcard_id, user_answer } = body;
  if (!flashcard_id || !user_answer) return res.status(400).json({ error: 'flashcard_id and user_answer required' });
  const { data: card, error } = await supabase.from('flashcard_cards').select('back_text').eq('id', flashcard_id).single();
  if (error || !card) return res.status(404).json({ error: 'Card not found' });
  const correct = card.back_text.trim().toLowerCase() === user_answer.trim().toLowerCase();
  return res.status(200).json({ correct, correct_answer: card.back_text });
}

async function toggleBookmark(body, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { flashcard_id } = body;
  if (!flashcard_id) return res.status(400).json({ error: 'flashcard_id required' });
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('interaction_type', 'favorite').filter('metadata->>type', 'eq', 'flashcard_bookmark').filter('metadata->>flashcard_id', 'eq', flashcard_id).maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ bookmarked: false });
  }
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'favorite', metadata: { type: 'flashcard_bookmark', flashcard_id } });
  return res.status(200).json({ bookmarked: true });
}
