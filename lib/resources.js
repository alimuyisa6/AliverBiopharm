 import { supabase, canAccessLevel, isAdmin, isValidLevel } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';

const VALID_LEVELS = ['O-Level', 'A-Level', 'Pharmacy'];

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET') {
    switch (path) {
      case 'get_resources': return getResources(req, res, ctx);
      case 'get_filter_options': return getFilterOptions(req, res);
      case 'get_pdfs_by_level': return getPdfsByLevel(req, res, ctx);
      case 'get_notes_structure': return getNotesStructure(req, res, ctx);
      case 'get_note_content': return getNoteContent(req, res, ctx);
      case 'get_note_preview': return getNotePreview(req, res, ctx);
      case 'get_note_reactions': return getNoteReactions(req, res);
      case 'get_reading_progress': return getReadingProgress(req, res, ctx);
      case 'get_continue_reading': return getContinueReading(req, res, ctx);
      case 'get_all_ratings': return getAllRatings(req, res);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  if (req.method === 'POST') {
    const body = await parseAndValidateBody(req);
    switch (path) {
      case 'submit_resource': requireAuth(ctx); return submitResource(body, res, ctx);
      case 'approve': return approveResource(body, res, ctx);
      case 'track_pdf_preview': requireAuth(ctx); return trackPdfPreview(body, res, ctx);
      case 'track_pdf_download': requireAuth(ctx); return trackPdfDownload(body, res, ctx);
      case 'toggle_note_reaction': requireAuth(ctx); return toggleNoteReaction(body, res, ctx);
      case 'save_reading_progress': requireAuth(ctx); return saveReadingProgress(body, res, ctx);
      default: throw new SecurityError('Invalid action', 400);
    }
  }
  throw new SecurityError('Method not allowed', 405);
}

// Helper to get user's level access
async function getUserLevelAccess(userId) {
  if (!userId) return { level: null, isAdmin: false, showAll: false };

  const adminData = await isAdmin(userId, 'unknown');
  if (adminData && adminData.admin_role) {
    return { level: null, isAdmin: true, showAll: true };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('track, role, is_approved_teacher, approved_track')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) return { level: null, isAdmin: false, showAll: false };

  if (profile.role === 'student') {
    return { level: profile.track, isAdmin: false, showAll: false };
  }

  if (profile.role === 'teacher') {
    if (!profile.is_approved_teacher) {
      return { level: null, isAdmin: false, showAll: false, pending: true };
    }
    if (profile.approved_track === 'ALL') {
      return { level: null, isAdmin: false, showAll: true };
    }
    return { level: profile.approved_track || profile.track, isAdmin: false, showAll: false };
  }

  return { level: null, isAdmin: false, showAll: false };
}

async function getResources(req, res, ctx) {
  const { level, category, tag } = req.query;

  // Get user's level access
  let userLevel = null;
  let showAll = false;
  let isAdminUser = false;

  if (ctx.authenticated && ctx.userId) {
    const access = await getUserLevelAccess(ctx.userId);
    userLevel = access.level;
    showAll = access.showAll;
    isAdminUser = access.isAdmin;
  }

  let query = supabase
    .from('biology_notes')
    .select('id,title,description,author,level,category,tag,section_type,file_url,file_size,download_count,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  // Apply level filtering
  const filterLevel = level || userLevel;
  if (filterLevel && !showAll && !isAdminUser) {
    query = query.eq('level', filterLevel);
  } else if (!showAll && !isAdminUser && userLevel) {
    query = query.eq('level', userLevel);
  }

  if (category) query = query.eq('category', category);
  if (tag) query = query.eq('tag', tag);

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch resources', 500);
  return res.status(200).json(data || []);
}

async function getFilterOptions(req, res) {
  const [l, c, t] = await Promise.all([
    supabase.from('biology_notes').select('level').limit(500),
    supabase.from('biology_notes').select('category').limit(500),
    supabase.from('biology_notes').select('tag').limit(500)
  ]);
  return res.status(200).json({
    levels: [...new Set((l.data||[]).map(x=>x.level).filter(Boolean))],
    categories: [...new Set((c.data||[]).map(x=>x.category).filter(Boolean))],
    tags: [...new Set((t.data||[]).map(x=>x.tag).filter(Boolean))]
  });
}

async function getPdfsByLevel(req, res, ctx) {
  const { level } = req.query;

  // Get user's level access
  let userLevel = null;
  let showAll = false;
  let isAdminUser = false;

  if (ctx.authenticated && ctx.userId) {
    const access = await getUserLevelAccess(ctx.userId);
    userLevel = access.level;
    showAll = access.showAll;
    isAdminUser = access.isAdmin;
  }

  if (!level && !userLevel) throw new SecurityError('Level required', 400);

  let query = supabase
    .from('pdf_resources')
    .select('id,title,author,level,topic,subtopic,file_url,file_size,download_count,preview_count')
    .eq('is_active', true)
    .order('topic', { ascending: true });

  // Apply level filtering
  const filterLevel = level || userLevel;
  if (filterLevel && filterLevel !== 'all' && !showAll && !isAdminUser) {
    query = query.eq('level', filterLevel);
  } else if (level === 'all' && !showAll && !isAdminUser) {
    // If user is not admin and tries to see all, filter by their level
    if (userLevel) query = query.eq('level', userLevel);
  } else if (!showAll && !isAdminUser && userLevel) {
    query = query.eq('level', userLevel);
  }

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch PDFs', 500);
  return res.status(200).json({ pdfs: data || [] });
}

async function getNotesStructure(req, res, ctx) {
  // Get user's level access
  let userLevel = null;
  let showAll = false;
  let isAdminUser = false;

  if (ctx.authenticated && ctx.userId) {
    const access = await getUserLevelAccess(ctx.userId);
    userLevel = access.level;
    showAll = access.showAll;
    isAdminUser = access.isAdmin;
  }

  let query = supabase
    .from('notes_structure')
    .select('*')
    .order('level_order', { ascending: true })
    .order('topic_order', { ascending: true })
    .order('subtopic_order', { ascending: true });

  // Apply level filtering
  if (userLevel && !showAll && !isAdminUser) {
    query = query.eq('level', userLevel);
  }

  const { data, error } = await query;
  if (error) throw new SecurityError('Failed to fetch notes structure', 500);

  // If user is a teacher with a specific track but not admin, filter by their level
  if (!showAll && !isAdminUser && userLevel) {
    const filteredData = (data || []).filter(item => item.level === userLevel);
    return res.status(200).json(filteredData);
  }

  return res.status(200).json(data || []);
}

async function getNoteContent(req, res, ctx) {
  const { subtopic_id } = req.query;
  if (!subtopic_id) throw new SecurityError('subtopic_id required', 400);

  // Check if user can access this note's level
  if (ctx.authenticated && ctx.userId) {
    const { data: noteMeta } = await supabase
      .from('notes_structure')
      .select('level')
      .eq('subtopic_id', subtopic_id)
      .maybeSingle();

    if (noteMeta?.level) {
      const canAccess = await canAccessLevel(ctx.userId, noteMeta.level);
      const adminData = await isAdmin(ctx.userId, 'unknown');
      if (!canAccess && !(adminData && adminData.admin_role)) {
        throw new SecurityError('You do not have access to this content', 403);
      }
    }
  }

  const { data, error } = await supabase.from('note_contents').select('*').eq('subtopic_id', subtopic_id).single();
  if (error) throw new SecurityError('Failed to fetch note content', 500);
  return res.status(200).json(data);
}

async function getNotePreview(req, res, ctx) {
  const { subtopic_id } = req.query;
  if (!subtopic_id) throw new SecurityError('subtopic_id required', 400);

  // Check if user can access this note's level
  if (ctx.authenticated && ctx.userId) {
    const { data: noteMeta } = await supabase
      .from('notes_structure')
      .select('level')
      .eq('subtopic_id', subtopic_id)
      .maybeSingle();

    if (noteMeta?.level) {
      const canAccess = await canAccessLevel(ctx.userId, noteMeta.level);
      const adminData = await isAdmin(ctx.userId, 'unknown');
      if (!canAccess && !(adminData && adminData.admin_role)) {
        throw new SecurityError('You do not have access to this content', 403);
      }
    }
  }

  const { data, error } = await supabase.from('note_contents').select('content, title').eq('subtopic_id', subtopic_id).single();
  if (error) throw new SecurityError('Failed to fetch note preview', 500);
  const plainText = data?.content?.replace(/<[^>]*>/g, '') || '';
  const preview = plainText.substring(0, 400) + (plainText.length > 400 ? '...' : '');
  return res.status(200).json({ subtopic_id, title: data?.title || '', preview, read_time: Math.ceil(plainText.split(/\s+/).length / 200) });
}

async function getNoteReactions(req, res) {
  const { note_id } = req.query;
  if (!note_id) throw new SecurityError('note_id required', 400);
  const { data, error } = await supabase.from('note_reactions').select('reaction_type, user_id, created_at').eq('note_id', note_id);
  if (error) throw new SecurityError('Failed to fetch reactions', 500);
  const counts = { like: 0, love: 0, helpful: 0 };
  (data || []).forEach(r => { if (counts[r.reaction_type] !== undefined) counts[r.reaction_type]++; });
  return res.status(200).json({ counts, total: (data || []).length });
}

async function getReadingProgress(req, res, ctx) {
  if (!ctx.userId) return res.status(200).json(null);
  const { note_id } = req.query;
  const { data, error } = await supabase.from('user_interactions').select('value, metadata, created_at').eq('user_id', ctx.userId).eq('interaction_type', 'reading_progress').filter('metadata->>note_id', 'eq', note_id).maybeSingle();
  if (error) throw new SecurityError('Failed to fetch reading progress', 500);
  return res.status(200).json(data ? { scroll_percentage: data.value || 0, scroll_position: data.metadata?.scroll_position || 0, completed: data.metadata?.completed || false, last_accessed: data.created_at, time_spent: data.metadata?.time_spent || 0 } : null);
}

async function getContinueReading(req, res, ctx) {
  if (!ctx.userId) return res.status(200).json([]);
  const limit = parseInt(req.query.limit) || 10;

  // Get user's level for filtering
  const access = await getUserLevelAccess(ctx.userId);
  const userLevel = access.level;
  const showAll = access.showAll;

  const { data, error } = await supabase
    .from('user_interactions')
    .select('resource_id, value, metadata, created_at')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'reading_progress')
    .neq('value', 100)
    .gt('value', 5)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new SecurityError('Failed to fetch continue reading', 500);

  const notes = [];
  for (const item of (data || [])) {
    const { data: noteData } = await supabase
      .from('notes_structure')
      .select('subtopic_name, topic, level')
      .eq('subtopic_id', item.resource_id)
      .maybeSingle();

    if (noteData) {
      // Filter by user's level
      if (!showAll && userLevel && noteData.level !== userLevel) {
        continue;
      }
      notes.push({
        note_id: item.resource_id,
        title: noteData.subtopic_name,
        topic: noteData.topic,
        level: noteData.level,
        progress_percentage: item.value,
        last_accessed: item.created_at
      });
    }
  }

  return res.status(200).json(notes);
}

async function getAllRatings(req, res) {
  const { data, error } = await supabase
    .from('user_interactions')
    .select('resource_id, value')
    .eq('interaction_type', 'rating');

  if (error) throw new SecurityError('Failed to fetch ratings', 500);

  const ratingsMap = {};
  (data || []).forEach(r => {
    if (!ratingsMap[r.resource_id]) {
      ratingsMap[r.resource_id] = { total: 0, count: 0 };
    }
    ratingsMap[r.resource_id].total += r.value;
    ratingsMap[r.resource_id].count += 1;
  });

  const result = {};
  Object.entries(ratingsMap).forEach(([id, data]) => {
    result[id] = {
      avg: Math.round((data.total / data.count) * 10) / 10,
      count: data.count
    };
  });

  return res.status(200).json(result);
}

async function submitResource(body, res, ctx) {
  const { payload } = body;
  const { error } = await supabase.from('resource_submissions').insert({
    title: payload.title,
    description: payload.description,
    author: payload.author,
    level: payload.level,
    category: payload.category,
    tag: payload.tag,
    section_type: payload.section_type,
    file_url: payload.file_url,
    file_size: payload.file_size,
    status: 'pending'
  });
  if (error) throw new SecurityError('Failed to submit resource', 500);
  return res.status(200).json({ success: true });
}

async function approveResource(body, res, ctx) {
  if (!ctx.adminData) throw new SecurityError('Admin required', 403);
  const { submissionId, action } = body;
  if (!submissionId) throw new SecurityError('submissionId required', 400);
  if (action === 'delete') {
    await supabase.from('resource_submissions').delete().eq('id', submissionId);
  } else if (action === 'approve') {
    const { data: sub } = await supabase.from('resource_submissions').select('*').eq('id', submissionId).single();
    if (sub) {
      await supabase.from('biology_notes').insert({
        title: sub.title,
        description: sub.description,
        author: sub.author,
        level: sub.level,
        category: sub.category,
        tag: sub.tag,
        section_type: sub.section_type,
        file_url: sub.file_url,
        file_size: sub.file_size
      });
      await supabase.from('resource_submissions').update({ status: 'approved' }).eq('id', submissionId);
    }
  } else {
    await supabase.from('resource_submissions').update({ status: 'rejected' }).eq('id', submissionId);
  }
  return res.status(200).json({ success: true });
}

async function trackPdfPreview(body, res, ctx) {
  const { pdf_id } = body;
  const { data: current } = await supabase.from('pdf_resources').select('preview_count').eq('id', pdf_id).single();
  if (current) await supabase.from('pdf_resources').update({ preview_count: (current.preview_count || 0) + 1 }).eq('id', pdf_id);
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'view', resource_id: pdf_id, metadata: { pdf_id, action: 'preview' } });
  return res.status(200).json({ success: true });
}

async function trackPdfDownload(body, res, ctx) {
  const { pdf_id } = body;
  const { data: current } = await supabase.from('pdf_resources').select('download_count').eq('id', pdf_id).single();
  if (current) await supabase.from('pdf_resources').update({ download_count: (current.download_count || 0) + 1 }).eq('id', pdf_id);
  await supabase.from('user_interactions').insert({ user_id: ctx.userId, interaction_type: 'download', resource_id: pdf_id, metadata: { pdf_id, action: 'download' } });
  return res.status(200).json({ success: true });
}

async function toggleNoteReaction(body, res, ctx) {
  const { note_id, reaction_type } = body;
  const { data: existing } = await supabase.from('note_reactions').select('id, reaction_type').eq('user_id', ctx.userId).eq('note_id', note_id).maybeSingle();
  if (existing) {
    if (existing.reaction_type === reaction_type) {
      await supabase.from('note_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('note_reactions').update({ reaction_type }).eq('id', existing.id);
    }
  } else {
    await supabase.from('note_reactions').insert({ user_id: ctx.userId, note_id, reaction_type });
  }
  const { count } = await supabase.from('note_reactions').select('id', { count: 'exact', head: true }).eq('note_id', note_id);
  return res.status(200).json({ success: true, count: count || 0 });
}

async function saveReadingProgress(body, res, ctx) {
  const { note_id, scroll_percentage, scroll_position, time_spent, completed } = body;
  const numericNoteId = parseInt(note_id, 10) || 0;
  const { data: existing } = await supabase.from('user_interactions').select('id, metadata, value').eq('user_id', ctx.userId).eq('interaction_type', 'reading_progress').filter('metadata->>note_id', 'eq', note_id).maybeSingle();
  if (existing) {
    const currentTimeSpent = (existing.metadata?.time_spent || 0) + (time_spent || 0);
    await supabase.from('user_interactions').update({
      value: scroll_percentage,
      metadata: {
        note_id,
        scroll_position: scroll_position || existing.metadata?.scroll_position || 0,
        time_spent: currentTimeSpent,
        completed: completed || false,
        last_updated: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    }).eq('id', existing.id);
  } else {
    await supabase.from('user_interactions').insert({
      user_id: ctx.userId,
      interaction_type: 'reading_progress',
      resource_id: numericNoteId,
      value: scroll_percentage,
      metadata: {
        note_id,
        scroll_position: scroll_position || 0,
        time_spent: time_spent || 0,
        completed: completed || false,
        started_at: new Date().toISOString()
      }
    });
  }
  return res.status(200).json({ success: true });
}
