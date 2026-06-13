import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function setCorsHeaders(res, req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://aliverbiopharm.com').split(',').map(o => o.trim());
  const requestOrigin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

async function validateSession(token) {
  if (!token || token.length < 20) return null;
  const hashedToken = hashToken(token);
  const { data, error } = await supabase.from('user_sessions').select('user_id, expires_at, is_active').eq('session_token_hash', hashedToken).eq('is_active', true).single();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('user_sessions').update({ is_active: false }).eq('session_token_hash', hashedToken);
    return null;
  }
  return data;
}

async function isAdmin(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('admin_master').select('admin_role, permissions').eq('admin_id', userId).eq('is_active', true).maybeSingle();
  return data;
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const cookies = parseCookies(req);
  const token = cookies.session || '';
  let userId = null;
  let adminData = null;

  if (token) {
    const session = await validateSession(token);
    if (session) userId = session.user_id;
    if (userId) adminData = await isAdmin(userId);
  }

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
    switch (path) {
      case 'create_deck': return createDeck(req, res, userId, adminData);
      case 'update_deck': return updateDeck(req, res, userId, adminData);
      case 'delete_deck': return deleteDeck(req, res, userId, adminData);
      case 'add_cards': return addCards(req, res, userId, adminData);
      case 'remove_card': return removeCard(req, res, userId, adminData);
      case 'toggle_known': return toggleKnown(req, res, userId);
      case 'rate': return rateCard(req, res, userId);
      case 'check_answer': return checkAnswer(req, res);
      case 'toggle_bookmark': return toggleBookmark(req, res, userId);
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

async function createDeck(req, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { title, description, category, level, cards } = req.body;
  if (!title || !category || !level) return res.status(400).json({ error: 'title, category and level required' });
  const { data: deck, error } = await supabase.from('flashcard_decks').insert({ title, description: description || '', category, level, created_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (cards && cards.length > 0) {
    const cardRows = cards.map((c, i) => ({ deck_id: deck.id, front_text: c.front_text, back_text: c.back_text, image_url: c.image_url || null, position: i, created_at: new Date().toISOString() }));
    await supabase.from('flashcard_cards').insert(cardRows);
  }
  return res.status(200).json({ success: true, deck_id: deck.id });
}

async function updateDeck(req, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { deck_id, title, description, category, level, cards } = req.body;
  if (!deck_id) return res.status(400).json({ error: 'deck_id required' });
  await supabase.from('flashcard_decks').update({ title, description, category, level, updated_at: new Date().toISOString() }).eq('id', deck_id);
  if (cards) {
    await supabase.from('flashcard_cards').delete().eq('deck_id', deck_id);
    const cardRows = cards.map((c, i) => ({ deck_id, front_text: c.front_text, back_text: c.back_text, image_url: c.image_url || null, position: i, created_at: new Date().toISOString() }));
    await supabase.from('flashcard_cards').insert(cardRows);
  }
  return res.status(200).json({ success: true });
}

async function deleteDeck(req, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { deck_id } = req.body;
  if (!deck_id) return res.status(400).json({ error: 'deck_id required' });
  await supabase.from('flashcard_cards').delete().eq('deck_id', deck_id);
  await supabase.from('flashcard_decks').delete().eq('id', deck_id);
  return res.status(200).json({ success: true });
}

async function addCards(req, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { deck_id, cards } = req.body;
  if (!deck_id || !cards || cards.length === 0) return res.status(400).json({ error: 'deck_id and cards required' });
  const { count } = await supabase.from('flashcard_cards').select('id', { count: 'exact', head: true }).eq('deck_id', deck_id);
  const cardRows = cards.map((c, i) => ({ deck_id, front_text: c.front_text, back_text: c.back_text, image_url: c.image_url || null, position: (count || 0) + i, created_at: new Date().toISOString() }));
  const { error } = await supabase.from('flashcard_cards').insert(cardRows);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function removeCard(req, res, userId, adminData) {
  if (!adminData) return res.status(403).json({ error: 'Admin required' });
  const { card_id } = req.body;
  if (!card_id) return res.status(400).json({ error: 'card_id required' });
  await supabase.from('flashcard_cards').delete().eq('id', card_id);
  return res.status(200).json({ success: true });
}

async function toggleKnown(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { flashcard_id } = req.body;
  if (!flashcard_id) return res.status(400).json({ error: 'flashcard_id required' });
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('interaction_type', 'favorite').filter('metadata->>type', 'eq', 'flashcard_known').filter('metadata->>flashcard_id', 'eq', flashcard_id).maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ known: false });
  }
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'favorite', metadata: { type: 'flashcard_known', flashcard_id } });
  return res.status(200).json({ known: true });
}

async function rateCard(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { flashcard_id, difficulty } = req.body;
  if (!flashcard_id || !difficulty) return res.status(400).json({ error: 'flashcard_id and difficulty required' });
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'rating', metadata: { type: 'flashcard_rating', flashcard_id, difficulty } });
  return res.status(200).json({ success: true });
}

async function checkAnswer(req, res) {
  const { flashcard_id, user_answer } = req.body;
  if (!flashcard_id || !user_answer) return res.status(400).json({ error: 'flashcard_id and user_answer required' });
  const { data: card, error } = await supabase.from('flashcard_cards').select('back_text').eq('id', flashcard_id).single();
  if (error || !card) return res.status(404).json({ error: 'Card not found' });
  const correct = card.back_text.trim().toLowerCase() === user_answer.trim().toLowerCase();
  return res.status(200).json({ correct, correct_answer: card.back_text });
}

async function toggleBookmark(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { flashcard_id } = req.body;
  if (!flashcard_id) return res.status(400).json({ error: 'flashcard_id required' });
  const { data: existing } = await supabase.from('user_interactions').select('id').eq('user_id', userId).eq('interaction_type', 'favorite').filter('metadata->>type', 'eq', 'flashcard_bookmark').filter('metadata->>flashcard_id', 'eq', flashcard_id).maybeSingle();
  if (existing) {
    await supabase.from('user_interactions').delete().eq('id', existing.id);
    return res.status(200).json({ bookmarked: false });
  }
  await supabase.from('user_interactions').insert({ user_id: userId, interaction_type: 'favorite', metadata: { type: 'flashcard_bookmark', flashcard_id } });
  return res.status(200).json({ bookmarked: true });
}
