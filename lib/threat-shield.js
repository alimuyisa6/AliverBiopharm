/* lib/threat-shield.js */
import { supabase, getIpNetwork } from './core.js';

const SUSPICIOUS_PATTERNS = [
  { name: 'sql_injection', regex: /(\bunion\b.{1,40}\bselect\b)|(\bselect\b.{1,40}\bfrom\b)|(\bor\b\s+\d+\s*=\s*\d+)|(\bdrop\b\s+\btable\b)|(\bxp_cmdshell\b)|(\binformation_schema\b)/i, weight: 6 },
  { name: 'xss', regex: /<script[\s>]|javascript:\s*[a-z]|onerror\s*=|onload\s*=|<img[^>]+onerror|<svg[^>]+onload/i, weight: 6 },
  { name: 'path_traversal', regex: /\.\.\/|\.\.\\|%2e%2e%2f|%252e%252e%252f|\/etc\/passwd|\bwin\.ini\b/i, weight: 6 },
  { name: 'template_injection', regex: /\{\{.*(constructor|process|require|__proto__).*\}\}/i, weight: 6 },
  { name: 'command_injection', regex: /(\b(nc|ncat|wget|curl)\b\s+-)|(\|\|\s*cat\s+)|(`[^`]{2,}`)|(\$\([^)]{2,}\))/i, weight: 6 },
  { name: 'nosql_injection', regex: /\$where\b|\$gt\b|\$ne\b|\$regex\b/i, weight: 4 },
  { name: 'proto_pollution', regex: /__proto__|constructor\.prototype/i, weight: 5 }
];

const SCANNER_UA_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /gobuster/i,
  /dirbuster/i,
  /wpscan/i,
  /acunetix/i,
  /nessus/i,
  /nuclei/i,
  /zgrab/i,
  /havij/i,
  /w3af/i,
  /dirb\//i,
  /feroxbuster/i
];

const HONEYPOT_FIELD = '__hp_field_confirm';
const REPUTATION_WINDOW_MS = 15 * 60 * 1000;
const ipReputation = new Map();

function bumpReputation(ip, amount) {
  const now = Date.now();
  const entry = ipReputation.get(ip);

  if (!entry || now - entry.windowStart > REPUTATION_WINDOW_MS) {
    ipReputation.set(ip, { score: amount, windowStart: now });
    return amount;
  }

  entry.score += amount;
  return entry.score;
}

function scanValue(value, reasons, path) {
  if (value === null || value === undefined) return 0;

  let str;

  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  if (str.length > 4000) str = str.slice(0, 4000);

  let total = 0;

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.regex.test(str)) {
      total += pattern.weight;
      reasons.push(`${pattern.name}:${path}`);
    }
  }

  return total;
}

function scanObjectDeep(obj, reasons, prefix = '', depth = 0) {
  if (depth > 4 || obj === null || obj === undefined) return 0;

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return scanValue(obj, reasons, prefix || 'value');
  }

  let total = 0;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length && i < 50; i += 1) {
      total += scanObjectDeep(obj[i], reasons, `${prefix}[${i}]`, depth + 1);
    }

    return total;
  }

  if (typeof obj === 'object') {
    for (const key of Object.keys(obj).slice(0, 50)) {
      total += scanObjectDeep(obj[key], reasons, prefix ? `${prefix}.${key}` : key, depth + 1);
    }
  }

  return total;
}

export function isHoneypotTriggered(body) {
  return !!(body && typeof body === 'object' && body[HONEYPOT_FIELD]);
}

export async function scoreRequest(req, body, ctx) {
  const reasons = [];
  let score = 0;

  const userAgent = req.headers['user-agent'] || '';

  if (!userAgent) {
    score += 2;
    reasons.push('missing_user_agent');
  } else if (SCANNER_UA_PATTERNS.some((pattern) => pattern.test(userAgent))) {
    score += 5;
    reasons.push('scanner_user_agent');
  }

  const url = req.url || '';
  const rawPath = url.split('?')[0] || '';
  const rawQuery = url.split('?')[1] || '';

  try {
    score += scanValue(decodeURIComponent(rawPath), reasons, 'path');
  } catch {
    score += scanValue(rawPath, reasons, 'path');
  }

  if (rawQuery) {
    try {
      score += scanValue(decodeURIComponent(rawQuery), reasons, 'query');
    } catch {
      score += scanValue(rawQuery, reasons, 'query');
    }
  }

  if (body && typeof body === 'object') {
    score += scanObjectDeep(body, reasons, 'body');

    if (isHoneypotTriggered(body)) {
      score += 10;
      reasons.push('honeypot_triggered');
    }
  }

  if (ctx && !ctx.userId && req.query?.module === 'admin') {
    score += 3;
    reasons.push('unauthenticated_admin_probe');
  }

  return { score, reasons: [...new Set(reasons)] };
}

const blockCache = new Map();
const BLOCK_CACHE_TTL_MS = 30000;

export async function isIpBlocked(ip) {
  if (!ip || ip === 'unknown') return false;

  const cached = blockCache.get(ip);

  if (cached && Date.now() < cached.expires) return cached.blocked;

  const { data } = await supabase
    .from('blocked_ips')
    .select('is_permanent, expires_at')
    .eq('ip_address', ip)
    .maybeSingle();

  let blocked = false;

  if (data) {
    if (data.is_permanent) {
      blocked = true;
    } else if (data.expires_at && new Date(data.expires_at) > new Date()) {
      blocked = true;
    }
  }

  blockCache.set(ip, { blocked, expires: Date.now() + BLOCK_CACHE_TTL_MS });

  return blocked;
}

export async function blockIp(ip, reason, blockedBy, durationHours = null) {
  const isPermanent = !durationHours;
  const expiresAt = durationHours
    ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
    : null;

  await supabase.from('blocked_ips').upsert({
    ip_address: ip,
    reason: reason || 'Automated threat detection',
    blocked_by: blockedBy || null,
    is_permanent: isPermanent,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  }, { onConflict: 'ip_address' });

  blockCache.delete(ip);
}

export async function unblockIp(ip) {
  await supabase.from('blocked_ips').delete().eq('ip_address', ip);
  blockCache.delete(ip);
}

export async function killAllSessionsForIp(ip, reason) {
  await supabase.from('user_sessions').update({
    is_active: false,
    terminated_reason: reason || 'security_action',
    terminated_at: new Date().toISOString()
  }).eq('ip_address', ip).eq('is_active', true);
}

export async function killAllSessionsForUser(userId, reason) {
  await supabase.from('user_sessions').update({
    is_active: false,
    terminated_reason: reason || 'security_action',
    terminated_at: new Date().toISOString()
  }).eq('user_id', userId).eq('is_active', true);
}

export async function recordSecurityEvent({
  eventType,
  severity,
  ip,
  ipNetwork,
  userId,
  path,
  module: moduleName,
  method,
  score,
  reasons,
  userAgent,
  actionTaken
}) {
  try {
    await supabase.from('security_events').insert({
      event_type: eventType,
      severity,
      ip_address: ip || null,
      ip_network: ipNetwork || getIpNetwork(ip),
      user_id: userId || null,
      path: path || null,
      module: moduleName || null,
      method: method || null,
      score: score || 0,
      reasons: reasons || [],
      user_agent: (userAgent || '').substring(0, 500),
      action_taken: actionTaken || null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ThreatShield] failed to record event:', error.message);
  }
}

export async function createSecurityAlert({
  alertType,
  severity,
  ip,
  userId,
  summary,
  details
}) {
  try {
    await supabase.from('security_alerts').insert({
      alert_type: alertType,
      severity,
      ip_address: ip || null,
      user_id: userId || null,
      summary,
      details: details || {},
      is_resolved: false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ThreatShield] failed to create alert:', error.message);
  }
}

const VAGUE_MESSAGES = [
  'This request could not be completed.',
  'Something went wrong while processing your request.',
  'We were unable to process this request at this time.',
  'Request could not be completed. Please try again later.'
];

export function getVagueErrorMessage() {
  return VAGUE_MESSAGES[Math.floor(Math.random() * VAGUE_MESSAGES.length)];
}

export async function evaluateAndRespond({ req, body, ctx, ip, moduleName, path }) {
  if (await isIpBlocked(ip)) {
    return {
      blocked: true,
      reason: 'ip_blocked',
      message: getVagueErrorMessage()
    };
  }

  const { score, reasons } = await scoreRequest(req, body, ctx);

  if (score <= 0) {
    return { blocked: false, score: 0 };
  }

  const reputationTotal = bumpReputation(ip, score);
  const ipNetwork = getIpNetwork(ip);
  const userAgent = req.headers['user-agent'] || '';

  let severity = 'medium';
  let actionTaken = 'logged';

  if (score >= 10 || reputationTotal >= 15) {
    severity = 'critical';
    actionTaken = 'ip_blocked_and_sessions_killed';

    await blockIp(ip, `Auto-blocked: ${reasons.join(', ')}`, null, 24);
    await killAllSessionsForIp(ip, 'threat_auto_block');

    if (ctx?.userId) {
      await killAllSessionsForUser(ctx.userId, 'threat_auto_block');
    }

    await createSecurityAlert({
      alertType: 'auto_block',
      severity: 'critical',
      ip,
      userId: ctx?.userId || null,
      summary: `IP ${ip} auto-blocked for suspicious activity`,
      details: { reasons, score, reputationTotal, path, module: moduleName }
    });
  } else if (score >= 5 || reputationTotal >= 8) {
    severity = 'high';
    actionTaken = 'flagged_for_review';

    await createSecurityAlert({
      alertType: 'suspicious_activity',
      severity: 'high',
      ip,
      userId: ctx?.userId || null,
      summary: `Suspicious request pattern from ${ip}`,
      details: { reasons, score, reputationTotal, path, module: moduleName }
    });
  }

  await recordSecurityEvent({
    eventType: 'suspicious_request',
    severity,
    ip,
    ipNetwork,
    userId: ctx?.userId || null,
    path,
    module: moduleName,
    method: req.method,
    score,
    reasons,
    userAgent,
    actionTaken
  });

  if (actionTaken === 'ip_blocked_and_sessions_killed') {
    return {
      blocked: true,
      reason: 'auto_blocked',
      message: getVagueErrorMessage()
    };
  }

  return { blocked: false, score, reasons };
} 
