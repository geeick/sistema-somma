const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

// Load the project's root .env.local when running from the server folder.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Postgres pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Instagram OAuth/security helpers
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:8080';

function getStateSecret() {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('Missing OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY in .env.local');
  }
  return secret;
}

function getTokenEncryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('Missing TOKEN_ENCRYPTION_KEY in .env.local');
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  }

  return key;
}

function encryptToken(token) {
  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function decryptToken(payload) {
  if (!payload) return null;

  const [ivRaw, tagRaw, encryptedRaw] = String(payload).split('.');

  if (!ivRaw || !tagRaw || !encryptedRaw) {
    return null;
  }

  const key = getTokenEncryptionKey();
  const iv = Buffer.from(ivRaw, 'base64url');
  const tag = Buffer.from(tagRaw, 'base64url');
  const encrypted = Buffer.from(encryptedRaw, 'base64url');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

function signStateBody(body) {
  return crypto
    .createHmac('sha256', getStateSecret())
    .update(body)
    .digest('base64url');
}

function createOAuthState(userId, extra = {}) {
  const safeExtra = extra && typeof extra === 'object' && !Array.isArray(extra)
    ? extra
    : {};

  const body = Buffer.from(JSON.stringify({
    ...safeExtra,
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString('base64url');

  return `${body}.${signStateBody(body)}`;
}

function parseAndVerifyOAuthState(state) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) {
    throw new Error('Invalid OAuth state');
  }

  const expected = signStateBody(body);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error('Invalid OAuth state signature');
  }

  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

  if (!parsed.userId || !parsed.expiresAt || Date.now() > parsed.expiresAt) {
    throw new Error('Expired OAuth state');
  }

  return parsed;
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_err) {
    return { message: text };
  }
}


// JWKS client - expects NEON_AUTH_JWKS_URI env var
const jwksUri = process.env.NEON_AUTH_JWKS_URI;
let neonJwks = null;

async function getNeonJwks() {
  if (!jwksUri) return null;
  if (!neonJwks) {
    const { createRemoteJWKSet } = await import('jose');
    neonJwks = createRemoteJWKSet(new URL(jwksUri));
  }
  return neonJwks;
}

const DEV_JWT_SECRET = process.env.DEV_JWT_SECRET;

async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });
  const token = parts[1];

  try {
    const decodedHeader = jwt.decode(token, { complete: true });
      // If JWKS client is configured and the token has a key id, use RS256.
      const jwks = await getNeonJwks();

      if (jwks) {
        const { jwtVerify } = await import('jose');
        const { payload } = await jwtVerify(token, jwks);
        req.user = payload;

      try {
        // ensure a profiles row exists for this auth user id
        const userId = req.user.sub;
        await pool.query(
          'INSERT INTO profiles(id, total_earnings, created_at) VALUES($1, $2, now()) ON CONFLICT (id) DO NOTHING',
          [userId, 0]
        );
      } catch (e) {
        console.error('Error ensuring profile exists', e);
      }
      next();
      return;
    }

    // Fallback: if DEV_JWT_SECRET is provided, allow HS256 tokens signed with that secret
    if (DEV_JWT_SECRET) {
      const payload = jwt.verify(token, DEV_JWT_SECRET, { algorithms: ['HS256'] });
      req.user = payload;
      try {
        const userId = req.user.sub;
        await pool.query(
          'INSERT INTO profiles(id, total_earnings, created_at) VALUES($1, $2, now()) ON CONFLICT (id) DO NOTHING',
          [userId, 0]
        );
      } catch (e) {
        console.error('Error ensuring profile exists', e);
      }
      next();
      return;
    }

    throw new Error('No JWKS client configured and no DEV_JWT_SECRET set');
  } catch (err) {
    console.error('Token verify error', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}


async function requireAdmin(req, res, next) {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ error: "Missing authenticated user" });
    }

    const result = await pool.query(
      `
      SELECT role
      FROM neon_auth."user"
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    next();
  } catch (err) {
    console.error("Admin check failed", err);
    return res.status(500).json({ error: "Admin check failed" });
  }
}

function cleanArrayItem(value) {
  return String(value ?? '')
    .trim()
    .replace(/^[\s"'{\[]+/, '')
    .replace(/[\s"'}\]]+$/, '')
    .trim();
}

function normalizeArray(value) {
  let items = [];

  if (Array.isArray(value)) {
    items = value;
  } else if (value !== null && value !== undefined && value !== '' && typeof value === 'string') {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) items = parsed;
    } catch (_err) {
      const withoutOuterBraces = trimmed.replace(/^\{(.*)\}$/, '$1');
      items = withoutOuterBraces.split(',');
    }
  }

  return items.map(cleanArrayItem).filter(Boolean);
}

function normalizePlatform(value) {
  const normalized = cleanArrayItem(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'tik_tok') return 'tiktok';
  if (['youtube', 'youtube_short', 'youtube_shorts'].includes(normalized)) {
    return 'youtube_shorts';
  }

  return normalized;
}

function normalizePlatformList(value) {
  return [...new Set(normalizeArray(value).map(normalizePlatform).filter(Boolean))];
}

function normalizeOAuthTags(value) {
  return normalizeArray(value)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 25);
}

function normalizeJsonObject(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (_err) {
      return null;
    }
  }
  return null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}



function computePayoutFromPlays(plays) {
  const count = Number(plays || 0);

  if (count <= 0) return 0;
  if (count < 1000) return 5;
  if (count < 5000) return 10;
  if (count < 25000) return 20;
  if (count < 50000) return 50;
  if (count < 100000) return 70;
  if (count < 250000) return 100;
  if (count < 500000) return 150;
  if (count < 1000000) return 200;

  return 250;
}

function parseMetricNumber(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  let raw = String(value).trim();

  if (!raw) return 0;

  raw = raw.replace(/\s+/g, '').toUpperCase();

  const compact = raw.match(/^(\d+(?:[.,]\d+)?)([KMB])$/);
  if (compact) {
    const base = Number(compact[1].replace(',', '.'));
    if (!Number.isFinite(base)) return 0;
    if (compact[2] === 'K') return Math.round(base * 1000);
    if (compact[2] === 'M') return Math.round(base * 1000000);
    if (compact[2] === 'B') return Math.round(base * 1000000000);
  }

  // Treat 384.444 or 384,444 as thousands separators when exactly three digits follow.
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
    return Number(raw.replace(/[.,]/g, ''));
  }

  const normalized = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function normalizeUrlForMatch(url) {
  return String(url || '')
    .trim()
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function instagramShortcode(url) {
  const text = String(url || '').trim();

  const match = text.match(/instagram\.com\/(?:reel|p|tv)\/([^/?#]+)/i);

  if (match && match[1]) {
    return match[1].toLowerCase();
  }

  return '';
}

function urlsMatch(a, b) {
  const left = normalizeUrlForMatch(a);
  const right = normalizeUrlForMatch(b);

  if (!left || !right) return false;

  const leftCode = instagramShortcode(left);
  const rightCode = instagramShortcode(right);

  if (leftCode && rightCode) {
    return leftCode === rightCode;
  }

  return left === right || left.includes(right) || right.includes(left);
}


function normalizePageHandle(value) {
  const raw = String(value || '').trim().toLowerCase();
  const withoutAt = raw.replace(/^@+/, '').replace(/\s+/g, '');
  return withoutAt ? `@${withoutAt}` : '';
}

function normalizePageUrl(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '')
    .replace(/\/+$/, '');
}

function getPageDedupeKey(platform, pageLike = {}) {
  const cleanPlatform = String(platform || '').trim().toLowerCase();
  const externalId = String(pageLike.external_account_id || pageLike.externalAccountId || '').trim();

  if (cleanPlatform && externalId) {
    return `${cleanPlatform}:external:${externalId}`;
  }

  const cleanHandle = normalizePageHandle(pageLike.handle);
  if (cleanPlatform && cleanHandle) {
    return `${cleanPlatform}:handle:${cleanHandle}`;
  }

  const cleanUrl = normalizePageUrl(pageLike.url);
  if (cleanPlatform && cleanUrl) {
    return `${cleanPlatform}:url:${cleanUrl}`;
  }

  return '';
}

async function sendSubmissionToGoogleSheet(postUrl, musicTitle) {
  const sheetUrl = process.env.GOOGLE_SHEETS_SCRAPER_URL;

  if (!sheetUrl) {
    console.warn('GOOGLE_SHEETS_SCRAPER_URL is not set. Skipping Google Sheet enqueue.');
    return null;
  }

  const response = await fetch(sheetUrl, {
    method: 'POST',
    headers: {
      // Apps Script web apps are more reliable with text/plain than application/json.
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      postLink: postUrl,
      link: postUrl,
      musica: musicTitle || '',
    }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.status === 'error') {
    throw new Error(json?.message || 'Google Sheet scraper doPost failed');
  }

  return json;
}

async function fetchGoogleSheetMetrics() {
  const sheetUrl = process.env.GOOGLE_SHEETS_SCRAPER_URL;

  if (!sheetUrl) {
    throw new Error('GOOGLE_SHEETS_SCRAPER_URL is not set in .env.local');
  }

  const response = await fetch(sheetUrl);
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Google Sheet scraper doGet failed with status ${response.status}`);
  }

  if (!Array.isArray(json)) {
    throw new Error(`Google Sheet scraper returned non-array JSON: ${JSON.stringify(json)}`);
  }

  return json.map((row) => ({
    url: String(row.url || row.postLink || row.link || '').trim(),
    username: String(row.username || row.userName || '').trim(),
    full_name: String(row.full_name || row.fullName || ''),
    caption: String(row.caption || ''),
    likes: parseMetricNumber(row.likes || row.like_count || row.likeCount),
    plays: parseMetricNumber(row.plays || row.views || row.view_count || row.viewCount || row.video_view_count),
    comments: parseMetricNumber(row.comments || row.comment_count || row.commentCount),
    music_title: String(row.music_title || row.musicTitle || ''),
    music_artist: String(row.music_artist || row.musicArtist || ''),
    photo_url: String(row.photo_url || row.photoUrl || ''),
    video_url: String(row.video_url || row.videoUrl || ''),
    taken_at: String(row.taken_at || row.takenAt || ''),
  }));
}

async function requestGoogleSheetScrapeAndGetMetrics(postUrl, musicTitle) {
  const sheetUrl = process.env.GOOGLE_SHEETS_SCRAPER_URL;

  if (!sheetUrl) {
    throw new Error('GOOGLE_SHEETS_SCRAPER_URL is not set in .env.local');
  }

  const response = await fetch(sheetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      postLink: postUrl,
      link: postUrl,
      musica: musicTitle || '',
      wait: true,
    }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json) {
    throw new Error('Google Sheet scraper request failed');
  }

  if (json.status === 'error') {
    throw new Error(json.message || 'Google Sheet scraper returned an error');
  }

  if (json.status === 'ready' && json.data) {
    return {
      url: String(json.data.url || '').trim(),
      username: String(json.data.username || '').trim(),
      likes: parseMetricNumber(json.data.likes),
      plays: parseMetricNumber(json.data.plays || json.data.views),
      comments: parseMetricNumber(json.data.comments),
      music_title: String(json.data.music_title || ''),
      music_artist: String(json.data.music_artist || ''),
      photo_url: String(json.data.photo_url || ''),
      video_url: String(json.data.video_url || ''),
      taken_at: String(json.data.taken_at || ''),
    };
  }

  const rows = await fetchGoogleSheetMetrics();
  const found = rows.find((row) => urlsMatch(postUrl, row.url));

  if (found) {
    return found;
  }

  throw new Error('Link was added to input, but output is not ready yet. Try Sync Metrics again later.');
}


async function getCreatorWalletSummary(userId) {
  const userIdText = String(userId);

  const earningsResult = await pool.query(
    `
    SELECT
      COALESCE(
        SUM(COALESCE(payment_amount, 0)) FILTER (
          WHERE LOWER(COALESCE(status, '')) IN ('approved', 'paid')
        ),
        0
      )::numeric AS total_earnings,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) <> 'deleted'
      )::int AS total_videos
    FROM submissions
    WHERE user_id::text = $1
    `,
    [userIdText]
  );

  const withdrawalsResult = await pool.query(
    `
    SELECT
      COALESCE(
        SUM(amount) FILTER (
          WHERE LOWER(COALESCE(status, '')) IN ('requested', 'pending', 'approved')
        ),
        0
      )::numeric AS pending_withdrawals,
      COALESCE(
        SUM(amount) FILTER (
          WHERE LOWER(COALESCE(status, '')) = 'paid'
        ),
        0
      )::numeric AS paid_out,
      COALESCE(
        SUM(amount) FILTER (
          WHERE LOWER(COALESCE(status, '')) IN ('requested', 'pending', 'approved', 'paid')
        ),
        0
      )::numeric AS reserved_or_paid
    FROM withdrawals
    WHERE user_id::text = $1
    `,
    [userIdText]
  );

  const profileResult = await pool.query(
    `
    SELECT pix_key_last4
    FROM profiles
    WHERE id::text = $1
    LIMIT 1
    `,
    [userIdText]
  );

  const earnings = earningsResult.rows[0] || {};
  const withdrawals = withdrawalsResult.rows[0] || {};
  const profile = profileResult.rows[0] || {};

  const totalEarnings = Number(earnings.total_earnings || 0);
  const pendingWithdrawals = Number(withdrawals.pending_withdrawals || 0);
  const paidOut = Number(withdrawals.paid_out || 0);
  const reservedOrPaid = Number(withdrawals.reserved_or_paid || 0);
  const available = Math.max(totalEarnings - reservedOrPaid, 0);

  return {
    total_earnings: totalEarnings,
    balance_total: totalEarnings,
    balance_available: available,
    pending_withdrawals: pendingWithdrawals,
    paid_out: paidOut,
    total_videos: Number(earnings.total_videos || 0),
    pix_key: profile.pix_key_last4 ? `**** ${profile.pix_key_last4}` : null,
  };
}


function getTikTokConfig() {
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    redirectUri: process.env.TIKTOK_REDIRECT_URI,
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:8080',
  };
}

function requireTikTokConfig() {
  const config = getTikTokConfig();

  if (!config.clientKey || !config.clientSecret || !config.redirectUri) {
    throw new Error(
      'TikTok OAuth is not configured. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI in .env.local'
    );
  }

  return config;
}

function getYouTubeConfig() {
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI,
    scopes: process.env.YOUTUBE_SCOPES || 'https://www.googleapis.com/auth/youtube.readonly',
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:8080',
  };
}

function requireYouTubeConfig() {
  const config = getYouTubeConfig();

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error(
      'YouTube OAuth is not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI.'
    );
  }

  return config;
}

async function exchangeInstagramLongLivedToken(shortLivedAccessToken) {
  const clientSecret = String(process.env.INSTAGRAM_CLIENT_SECRET || '').trim();
  if (!clientSecret) return null;

  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: String(shortLivedAccessToken),
  });
  const response = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);
  const json = await readJsonResponse(response);

  if (!response.ok || !json.access_token) {
    console.warn('Instagram long-lived token exchange failed; using the original token', json);
    return null;
  }

  return json;
}

async function refreshInstagramAccessToken(accessToken) {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: String(accessToken),
  });
  const response = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);
  const json = await readJsonResponse(response);

  if (!response.ok || !json.access_token) {
    throw new Error(json.error?.message || json.message || 'Instagram token refresh failed');
  }

  return json;
}

async function getValidInstagramAccessTokenForPage(userId, pageId) {
  const result = await pool.query(
    `
    SELECT *
    FROM instagram_connections
    WHERE user_id::text = $1
      AND page_id::text = $2
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [String(userId), String(pageId)]
  );
  const connection = result.rows[0];

  if (!connection) {
    throw new Error('Reconecte esta conta do Instagram para carregar suas publicações.');
  }

  const accessToken = decryptToken(connection.encrypted_access_token);
  if (!accessToken) throw new Error('A conexão do Instagram está inválida. Reconecte a conta.');

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  if (!expiresAt || expiresAt - Date.now() > 60_000) {
    return { accessToken, connection };
  }

  const refreshed = await refreshInstagramAccessToken(accessToken);
  const refreshedExpiresAt = new Date(
    Date.now() + Number(refreshed.expires_in || 60 * 24 * 60 * 60) * 1000
  );

  await pool.query(
    `
    UPDATE instagram_connections
    SET encrypted_access_token = $2,
        token_expires_at = $3,
        updated_at = now()
    WHERE id = $1
    `,
    [connection.id, encryptToken(refreshed.access_token), refreshedExpiresAt]
  );

  return { accessToken: refreshed.access_token, connection };
}

function normalizeInstagramMedia(media) {
  return {
    id: String(media.id),
    title: String(media.caption || '').trim() || 'Publicação do Instagram',
    url: media.permalink || '',
    thumbnail_url: media.thumbnail_url || media.media_url || null,
    media_type: media.media_type || null,
    published_at: media.timestamp || null,
    view_count: numberOrNull(media.views),
    like_count: numberOrNull(media.like_count),
    comment_count: numberOrNull(media.comments_count),
  };
}

async function listInstagramMedia(accessToken) {
  const params = new URLSearchParams({
    fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
    limit: '50',
    access_token: String(accessToken),
  });
  const response = await fetch(`https://graph.instagram.com/me/media?${params.toString()}`);
  const json = await readJsonResponse(response);

  if (!response.ok || !Array.isArray(json.data)) {
    throw new Error(json.error?.message || json.message || 'Instagram media list failed');
  }

  return json.data
    .filter((media) => media?.id && media?.permalink)
    .map(normalizeInstagramMedia);
}

async function getInstagramMedia(accessToken, mediaId) {
  const params = new URLSearchParams({
    fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
    access_token: String(accessToken),
  });
  const response = await fetch(
    `https://graph.instagram.com/${encodeURIComponent(String(mediaId))}?${params.toString()}`
  );
  const json = await readJsonResponse(response);

  if (!response.ok || !json.id || !json.permalink) {
    throw new Error(json.error?.message || json.message || 'Instagram media lookup failed');
  }

  return normalizeInstagramMedia(json);
}

async function refreshYouTubeAccessToken(refreshToken) {
  const config = requireYouTubeConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: String(config.clientId),
      client_secret: String(config.clientSecret),
      grant_type: 'refresh_token',
      refresh_token: String(refreshToken),
    }),
  });
  const json = await readJsonResponse(response);

  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || json.message || 'YouTube token refresh failed');
  }

  return json;
}

async function getValidYouTubeAccessTokenForPage(userId, pageId) {
  const result = await pool.query(
    `
    SELECT *
    FROM youtube_connections
    WHERE user_id::text = $1
      AND page_id::text = $2
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [String(userId), String(pageId)]
  );
  const connection = result.rows[0];

  if (!connection) {
    throw new Error('Reconecte este canal do YouTube para carregar seus vídeos.');
  }

  const accessToken = decryptToken(connection.encrypted_access_token);
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;

  if (accessToken && (!expiresAt || expiresAt - Date.now() > 60_000)) {
    return { accessToken, connection };
  }

  const refreshToken = decryptToken(connection.encrypted_refresh_token);
  if (!refreshToken) {
    throw new Error('Reconecte o YouTube para autorizar o carregamento de vídeos.');
  }

  const refreshed = await refreshYouTubeAccessToken(refreshToken);
  const refreshedExpiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000);

  await pool.query(
    `
    UPDATE youtube_connections
    SET encrypted_access_token = $2,
        access_token_expires_at = $3,
        scopes = COALESCE($4, scopes),
        updated_at = now()
    WHERE id = $1
    `,
    [connection.id, encryptToken(refreshed.access_token), refreshedExpiresAt, refreshed.scope || null]
  );

  return { accessToken: refreshed.access_token, connection };
}

async function getYouTubeUploadsPlaylist(accessToken, connection) {
  if (connection.uploads_playlist_id) return connection.uploads_playlist_id;

  const params = new URLSearchParams({
    part: 'contentDetails',
    id: String(connection.channel_id),
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await readJsonResponse(response);
  const playlistId = json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!response.ok || !playlistId) {
    throw new Error(json.error?.message || 'Não foi possível encontrar os vídeos deste canal.');
  }

  await pool.query(
    'UPDATE youtube_connections SET uploads_playlist_id = $2, updated_at = now() WHERE id = $1',
    [connection.id, playlistId]
  );

  return playlistId;
}

function normalizeYouTubeVideo(video) {
  const videoId = String(video.id);
  const thumbnails = video.snippet?.thumbnails || {};
  return {
    id: videoId,
    title: video.snippet?.title || `Vídeo do YouTube ${videoId}`,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    thumbnail_url: thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null,
    media_type: 'VIDEO',
    published_at: video.snippet?.publishedAt || null,
    view_count: numberOrNull(video.statistics?.viewCount),
    like_count: numberOrNull(video.statistics?.likeCount),
    comment_count: numberOrNull(video.statistics?.commentCount),
  };
}

async function fetchYouTubeVideosByIds(accessToken, ids) {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: ids.join(','),
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await readJsonResponse(response);

  if (!response.ok || !Array.isArray(json.items)) {
    throw new Error(json.error?.message || 'Não foi possível carregar os vídeos do YouTube.');
  }

  return json.items.map(normalizeYouTubeVideo);
}

async function listYouTubeVideos(accessToken, connection) {
  const playlistId = await getYouTubeUploadsPlaylist(accessToken, connection);
  const params = new URLSearchParams({
    part: 'contentDetails',
    playlistId: String(playlistId),
    maxResults: '50',
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await readJsonResponse(response);

  if (!response.ok || !Array.isArray(json.items)) {
    throw new Error(json.error?.message || 'Não foi possível carregar os vídeos do YouTube.');
  }

  const ids = json.items
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean);
  return fetchYouTubeVideosByIds(accessToken, ids);
}

async function getYouTubeVideo(accessToken, connection, videoId) {
  const videos = await fetchYouTubeVideosByIds(accessToken, [String(videoId)]);
  const video = videos[0];

  if (!video) throw new Error('O vídeo selecionado não foi encontrado no YouTube.');

  const params = new URLSearchParams({ part: 'snippet', id: String(videoId) });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await readJsonResponse(response);

  if (!response.ok || json.items?.[0]?.snippet?.channelId !== connection.channel_id) {
    throw new Error('O vídeo selecionado não pertence ao canal conectado.');
  }

  return video;
}

async function exchangeTikTokCodeForToken(code) {
  const config = requireTikTokConfig();

  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code: String(code),
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = await readJsonResponse(response);

  if (!response.ok || json.error) {
    throw new Error(json.error_description || json.error || json.message || 'TikTok token exchange failed');
  }

  return json;
}

async function refreshTikTokAccessToken(refreshToken) {
  const config = requireTikTokConfig();

  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: String(refreshToken),
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = await readJsonResponse(response);

  if (!response.ok || json.error) {
    throw new Error(json.error_description || json.error || json.message || 'TikTok token refresh failed');
  }

  return json;
}

async function getTikTokUserInfo(accessToken) {
  // Keep the initial field list conservative so user.info.basic is enough.
  // Add profile_deep_link or bio_description later only if your TikTok app is approved for that scope.
  const fields = ['open_id', 'union_id', 'avatar_url', 'display_name'].join(',');

  const response = await fetch(
    `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const json = await readJsonResponse(response);

  if (!response.ok || json.error?.code !== 'ok') {
    throw new Error(json.error?.message || json.error?.code || json.message || 'TikTok user info failed');
  }

  return json.data?.user || {};
}

function extractTikTokVideoId(url) {
  const text = String(url || '').trim();

  const directMatch = text.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (directMatch?.[1]) return directMatch[1];

  const idMatch = text.match(/\/video\/(\d+)/i);
  if (idMatch?.[1]) return idMatch[1];

  return '';
}

async function resolveTikTokUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    return response.url || url;
  } catch (_err) {
    return url;
  }
}

async function getTikTokVideoIdFromUrl(url) {
  let videoId = extractTikTokVideoId(url);

  if (videoId) return videoId;

  const resolvedUrl = await resolveTikTokUrl(url);
  videoId = extractTikTokVideoId(resolvedUrl);

  return videoId;
}

async function getValidTikTokAccessTokenForUser(userId, pageId = null) {
  const values = [String(userId)];
  let pageFilter = '';

  if (pageId) {
    values.push(String(pageId));
    pageFilter = 'AND page_id::text = $2';
  }

  const result = await pool.query(
    `
    SELECT *
    FROM tiktok_connections
    WHERE user_id::text = $1
      ${pageFilter}
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    values
  );

  const connection = result.rows[0];

  if (!connection) {
    throw new Error('Creator has not connected TikTok');
  }

  const now = Date.now();
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;

  if (expiresAt && expiresAt - now > 60_000) {
    return {
      accessToken: decryptToken(connection.encrypted_access_token),
      connection,
    };
  }

  const refreshToken = decryptToken(connection.encrypted_refresh_token);
  const refreshed = await refreshTikTokAccessToken(refreshToken);

  const newAccessExpiresAt = new Date(Date.now() + Number(refreshed.expires_in || 0) * 1000);
  const newRefreshExpiresAt = refreshed.refresh_expires_in
    ? new Date(Date.now() + Number(refreshed.refresh_expires_in || 0) * 1000)
    : connection.refresh_token_expires_at;

  await pool.query(
    `
    UPDATE tiktok_connections
    SET
      encrypted_access_token = $2,
      encrypted_refresh_token = COALESCE($3, encrypted_refresh_token),
      access_token_expires_at = $4,
      refresh_token_expires_at = COALESCE($5, refresh_token_expires_at),
      updated_at = now()
    WHERE id = $1
    `,
    [
      connection.id,
      encryptToken(refreshed.access_token),
      refreshed.refresh_token ? encryptToken(refreshed.refresh_token) : null,
      newAccessExpiresAt,
      newRefreshExpiresAt,
    ]
  );

  return {
    accessToken: refreshed.access_token,
    connection,
  };
}

function normalizeTikTokVideo(video) {
  return {
    id: String(video.id),
    title: video.title || video.video_description || `Vídeo do TikTok ${video.id}`,
    url: video.share_url || '',
    thumbnail_url: video.cover_image_url || null,
    media_type: 'VIDEO',
    published_at: video.create_time || null,
    view_count: numberOrNull(video.view_count),
    like_count: numberOrNull(video.like_count),
    comment_count: numberOrNull(video.comment_count),
  };
}

async function listTikTokVideos(accessToken, cursor = null) {
  const fields = [
    'id',
    'create_time',
    'cover_image_url',
    'share_url',
    'video_description',
    'duration',
    'title',
    'embed_link',
    'like_count',
    'comment_count',
    'share_count',
    'view_count',
  ].join(',');

  const body = {
    max_count: 20,
  };

  if (cursor) {
    body.cursor = cursor;
  }

  const response = await fetch(
    `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const json = await readJsonResponse(response);

  if (!response.ok || json.error?.code !== 'ok') {
    throw new Error(json.error?.message || json.error?.code || json.message || 'TikTok video list failed');
  }

  return {
    videos: json.data?.videos || [],
    cursor: json.data?.cursor || null,
    hasMore: Boolean(json.data?.has_more),
  };
}

async function queryTikTokVideo(accessToken, videoId) {
  const fields = [
    'id',
    'create_time',
    'cover_image_url',
    'share_url',
    'video_description',
    'duration',
    'title',
    'embed_link',
    'like_count',
    'comment_count',
    'share_count',
    'view_count',
  ].join(',');

  const response = await fetch(
    `https://open.tiktokapis.com/v2/video/query/?fields=${encodeURIComponent(fields)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: {
          video_ids: [String(videoId)],
        },
      }),
    }
  );

  const json = await readJsonResponse(response);

  if (!response.ok || json.error?.code !== 'ok') {
    throw new Error(json.error?.message || json.error?.code || json.message || 'TikTok video query failed');
  }

  return json.data?.videos?.[0] || null;
}

async function getOwnedVerifiedPage(userId, pageId) {
  const result = await pool.query(
    `
    SELECT id, user_id, platform, handle, verified
    FROM pages
    WHERE id::text = $1
      AND user_id::text = $2
      AND verified IS TRUE
    LIMIT 1
    `,
    [String(pageId), String(userId)]
  );

  if (!result.rows[0]) {
    throw new Error('A página selecionada não está conectada ou não pertence a este usuário.');
  }

  return result.rows[0];
}

async function listConnectedContent(userId, page) {
  if (page.platform === 'instagram') {
    const { accessToken } = await getValidInstagramAccessTokenForPage(userId, page.id);
    return listInstagramMedia(accessToken);
  }

  if (page.platform === 'youtube_shorts') {
    const { accessToken, connection } = await getValidYouTubeAccessTokenForPage(userId, page.id);
    return listYouTubeVideos(accessToken, connection);
  }

  if (page.platform === 'tiktok') {
    const { accessToken } = await getValidTikTokAccessTokenForUser(userId, page.id);
    const result = await listTikTokVideos(accessToken);
    return result.videos.map(normalizeTikTokVideo);
  }

  throw new Error('Esta plataforma ainda não oferece seleção de conteúdo conectado.');
}

async function resolveConnectedContent(userId, page, contentId) {
  if (page.platform === 'instagram') {
    const { accessToken } = await getValidInstagramAccessTokenForPage(userId, page.id);
    return getInstagramMedia(accessToken, contentId);
  }

  if (page.platform === 'youtube_shorts') {
    const { accessToken, connection } = await getValidYouTubeAccessTokenForPage(userId, page.id);
    return getYouTubeVideo(accessToken, connection, contentId);
  }

  if (page.platform === 'tiktok') {
    const { accessToken } = await getValidTikTokAccessTokenForUser(userId, page.id);
    const video = await queryTikTokVideo(accessToken, contentId);
    if (!video?.id || !video?.share_url) {
      throw new Error('O vídeo selecionado não foi encontrado na conta conectada do TikTok.');
    }
    return normalizeTikTokVideo(video);
  }

  throw new Error('Esta plataforma ainda não oferece seleção de conteúdo conectado.');
}


app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head><title>Somma</title></head>
      <body>
        <h1>Somma</h1>
        <p>Somma is a creator campaign platform that lets creators connect social accounts, submit campaign content, and track approved payouts.</p>
        <p><a href="/terms">Terms of Service</a></p>
        <p><a href="/privacy">Privacy Policy</a></p>
      </body>
    </html>
  `);
});

app.get('/terms', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head><title>Somma Terms of Service</title></head>
      <body>
        <h1>Somma Terms of Service</h1>
        <p>Somma allows creators to connect social media accounts, participate in campaigns, submit content, and request payouts for approved submissions.</p>
        <p>Creators are responsible for submitting only content they own or are authorized to submit.</p>
        <p>Somma may review, approve, reject, or remove submissions that do not meet campaign requirements.</p>
        <p>Payouts are based on campaign rules and verified metrics. Somma may delay or reject payouts if fraud, invalid content, or inaccurate metrics are detected.</p>
        <p>Contact: georgiaeick@g.ucla.edu</p>
      </body>
    </html>
  `);
});

app.get('/privacy', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head><title>Somma Privacy Policy</title></head>
      <body>
        <h1>Somma Privacy Policy</h1>
        <p>Somma collects account information, connected social profile information, submitted content URLs, campaign participation data, and payout request information.</p>
        <p>When creators connect TikTok, Somma uses authorized TikTok API access to read basic profile information and public video metadata needed for campaign submissions and payout calculations.</p>
        <p>Somma does not sell creator data. Data is used to operate campaigns, verify submissions, calculate earnings, and process payout requests.</p>
        <p>Creators may contact Somma to request account or data deletion.</p>
        <p>Contact: georgiaeick@g.ucla.edu</p>
      </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/campaigns/active', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM campaigns
       WHERE status = $1
         AND end_date >= CURRENT_DATE
       ORDER BY created_at DESC`,
      ['active']
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Return session info (requires Authorization header if session exists)
app.get('/api/session', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.json({ data: { session: null } });
  try {
    await new Promise((resolve) => setImmediate(resolve));
    const token = auth.split(' ')[1];
    // If JWKS client is configured, verify RS256 as usual
    const jwks = await getNeonJwks();

    if (jwks) {
      const { jwtVerify } = await import('jose');
      const { payload } = await jwtVerify(token, jwks);
      return res.json({ data: { session: { access_token: token, user: payload } } });
    }

    // Fallback: support HS256 dev tokens when DEV_JWT_SECRET is set
    if (DEV_JWT_SECRET) {
      try {
        const payload = jwt.verify(token, DEV_JWT_SECRET, { algorithms: ['HS256'] });
        return res.json({ data: { session: { access_token: token, user: payload } } });
      } catch (err) {
        return res.json({ data: { session: null } });
      }
    }

    // No JWKS and no dev secret — cannot resolve session
    return res.json({ data: { session: null } });
  } catch (err) {
    return res.json({ data: { session: null } });
  }
});

// Pages endpoints
app.get('/api/pages', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.sub;
    const result = await pool.query('SELECT * FROM pages WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/pages', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { platform, handle, url, follower_count, tags } = req.body;
    const cleanPlatform = String(platform || '').trim().toLowerCase();
    const cleanHandle = normalizePageHandle(handle);
    const cleanUrl = String(url || '').trim();
    const pageKey = getPageDedupeKey(cleanPlatform, {
      handle: cleanHandle,
      url: cleanUrl,
    });

    if (!cleanPlatform || !pageKey) {
      return res.status(400).json({
        error: 'Platform and page handle or URL are required',
      });
    }

    const duplicateResult = await pool.query(
      `
      SELECT id, platform, handle, url
      FROM pages
      WHERE user_id::text = $1
        AND platform = $2
        AND page_key = $3
      LIMIT 1
      `,
      [String(userId), cleanPlatform, pageKey]
    );

    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({
        error: 'This social media page has already been added',
        data: duplicateResult.rows[0],
      });
    }

    const result = await pool.query(
      `
      INSERT INTO pages(
        user_id,
        platform,
        handle,
        url,
        follower_count,
        tags,
        page_key,
        dedupe_guard,
        created_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,true,now())
      RETURNING *
      `,
      [userId, cleanPlatform, cleanHandle || handle, cleanUrl, follower_count, tags, pageKey]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Page create error', err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This social media page has already been added',
      });
    }

    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.patch('/api/pages/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const pageId = req.params.id;
    const { handle, url, follower_count, tags } = req.body;

    const pageResult = await pool.query(
      `
      SELECT *
      FROM pages
      WHERE id::text = $1
        AND user_id::text = $2
      LIMIT 1
      `,
      [String(pageId), String(userId)]
    );

    const existingPage = pageResult.rows[0];

    if (!existingPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const nextTags = normalizeArray(tags);

    if (nextTags.length === 0) {
      return res.status(400).json({
        error: 'Select at least one tag for this page',
      });
    }

    // OAuth-verified pages prove account ownership through the platform.
    // Users can only edit their own classification tags, not the verified identity fields.
    if (existingPage.verified === true) {
      const result = await pool.query(
        `
        UPDATE pages
        SET tags = $3
        WHERE id::text = $1
          AND user_id::text = $2
        RETURNING *
        `,
        [String(pageId), String(userId), nextTags]
      );

      return res.json({ data: result.rows[0] });
    }

    // Manual/unverified pages can edit the fields the creator typed manually.
    const cleanPlatform = String(existingPage.platform || '').trim().toLowerCase();
    const cleanHandle = normalizePageHandle(handle || existingPage.handle);
    const cleanUrl = String(url || existingPage.url || '').trim();
    const nextFollowerCount =
      follower_count === undefined || follower_count === null || follower_count === ''
        ? existingPage.follower_count
        : Number(follower_count);

    if (!cleanHandle || !cleanUrl || !Number.isFinite(Number(nextFollowerCount))) {
      return res.status(400).json({
        error: 'Handle, profile URL, follower count, and tags are required for manual pages',
      });
    }

    const nextPageKey = getPageDedupeKey(cleanPlatform, {
      handle: cleanHandle,
      url: cleanUrl,
    });

    const duplicateResult = await pool.query(
      `
      SELECT id, handle
      FROM pages
      WHERE user_id::text = $1
        AND platform = $2
        AND page_key = $3
        AND id::text <> $4
      LIMIT 1
      `,
      [String(userId), cleanPlatform, nextPageKey, String(pageId)]
    );

    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({
        error: 'This social media page has already been added',
        data: duplicateResult.rows[0],
      });
    }

    const result = await pool.query(
      `
      UPDATE pages
      SET
        handle = $3,
        url = $4,
        follower_count = $5,
        tags = $6,
        page_key = $7
      WHERE id::text = $1
        AND user_id::text = $2
      RETURNING *
      `,
      [
        String(pageId),
        String(userId),
        cleanHandle,
        cleanUrl,
        Number(nextFollowerCount),
        nextTags,
        nextPageKey,
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Page update error', err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This social media page has already been added',
      });
    }

    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.delete('/api/pages/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const id = req.params.id;
    await pool.query('DELETE FROM pages WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Profiles and withdrawals used by Wallet page
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;

    await pool.query(
      `
      INSERT INTO profiles(id, total_earnings, created_at)
      VALUES($1, 0, now())
      ON CONFLICT (id) DO NOTHING
      `,
      [userId]
    );

    const summary = await getCreatorWalletSummary(userId);
    res.json({ data: summary });
  } catch (err) {
    console.error('Profile load error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.get('/api/withdrawals', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;

    // Creator-facing route: never return the full PIX key to the creator browser
    // after it has been saved. Show only the masked hint.
    const result = await pool.query(
      `
      SELECT
        w.id,
        w.user_id,
        w.amount,
        w.status,
        w.pix_key_last4,
        CASE
          WHEN COALESCE(w.pix_key_last4, pr.pix_key_last4) IS NOT NULL
            THEN '**** ' || COALESCE(w.pix_key_last4, pr.pix_key_last4)
          ELSE NULL
        END AS pix_key,
        w.requested_at,
        w.processed_at,
        w.processed_by
      FROM withdrawals w
      LEFT JOIN profiles pr
        ON pr.id::text = w.user_id::text
      WHERE w.user_id::text = $1
      ORDER BY w.requested_at DESC
      `,
      [String(userId)]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Withdrawal list error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.post('/api/withdrawals', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { amount, pix_key } = req.body;
    const amountNumber = Number(amount);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({
        error: 'Withdrawal amount must be greater than 0',
      });
    }

    if (amountNumber < 25) {
      return res.status(400).json({
        error: 'Minimum withdrawal is R$ 25,00',
      });
    }

    const pixKey = String(pix_key || '').trim();

    if (!pixKey || pixKey.startsWith('****')) {
      return res.status(400).json({
        error: 'Please enter the full PIX key',
      });
    }

    await pool.query(
      `
      INSERT INTO profiles(id, total_earnings, created_at)
      VALUES($1, 0, now())
      ON CONFLICT (id) DO NOTHING
      `,
      [userId]
    );

    const wallet = await getCreatorWalletSummary(userId);

    if (amountNumber > Number(wallet.balance_available || 0)) {
      return res.status(400).json({
        error: 'Insufficient available balance',
        available: wallet.balance_available,
      });
    }

    const pixKeyLast4 = pixKey.slice(-4);

    // Store the full PIX key in Postgres for admin payout processing.
    // The creator-facing API still returns only a masked key.
    await pool.query(
      `
      UPDATE profiles
      SET
        pix_key = $2,
        pix_key_last4 = $3
      WHERE id::text = $1
      `,
      [String(userId), pixKey, pixKeyLast4]
    );

    const result = await pool.query(
      `
      INSERT INTO withdrawals(
        user_id,
        amount,
        status,
        pix_key,
        pix_key_last4,
        requested_at
      )
      VALUES($1, $2, 'requested', $3, $4, now())
      RETURNING
        id,
        user_id,
        amount,
        status,
        pix_key_last4,
        requested_at
      `,
      [userId, amountNumber, pixKey, pixKeyLast4]
    );

    res.json({
      data: {
        ...result.rows[0],
        pix_key: `**** ${pixKeyLast4}`,
      },
    });
  } catch (err) {
    console.error('Withdrawal create error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});


app.post('/api/submissions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { campaign_id, page_id, platform_content_id, tiktok_video_id } = req.body;
    const contentId = platform_content_id || tiktok_video_id;

    if (!campaign_id || !page_id || !contentId) {
      return res.status(400).json({
        error: 'Campaign, connected page, and selected content are required',
      });
    }

    const pageResult = await pool.query(
      `
      SELECT id, user_id, platform, handle, verified
      FROM pages
      WHERE id::text = $1
        AND user_id::text = $2
        AND verified IS TRUE
      LIMIT 1
      `,
      [String(page_id), String(userId)]
    );

    const page = pageResult.rows[0];

    if (!page) {
      return res.status(400).json({
        error: 'You can only submit content from one of your approved pages',
      });
    }

    const campaignResult = await pool.query(
      `
      SELECT id, title, status, end_date, platforms, audio_url
      FROM campaigns
      WHERE id::text = $1
      LIMIT 1
      `,
      [String(campaign_id)]
    );

    const campaign = campaignResult.rows[0];

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({
        error: 'This campaign is not currently active',
      });
    }

    if (campaign.end_date && new Date(campaign.end_date) < new Date()) {
      return res.status(400).json({
        error: 'This campaign has ended',
      });
    }

    const allowedPlatforms = normalizePlatformList(campaign.platforms);
    const pagePlatform = normalizePlatform(page.platform);

    if (
      allowedPlatforms.length > 0 &&
      !allowedPlatforms.includes(pagePlatform)
    ) {
      return res.status(400).json({
        error: `Esta campanha não aceita envios de ${pagePlatform}`,
      });
    }

    const connectedContent = await resolveConnectedContent(userId, page, contentId);
    const canonicalPostUrl = String(connectedContent?.url || '').trim();

    if (!canonicalPostUrl) {
      return res.status(400).json({
        error: 'A plataforma não retornou um link válido para o conteúdo selecionado',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO submissions(
        user_id,
        campaign_id,
        page_id,
        title,
        platform,
        post_url,
        tiktok_video_id,
        status,
        audio_verified,
        uploaded_at,
        created_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,'pending',false,now(),now())
      RETURNING *
      `,
      [
        userId,
        campaign.id,
        page.id,
        `${campaign.title || 'Campaign'} - Submission`,
        page.platform,
        canonicalPostUrl,
        page.platform === 'tiktok' ? String(contentId) : null,
      ]
    );

    const inserted = result.rows[0];

    sendSubmissionToGoogleSheet(canonicalPostUrl, campaign.title).catch((err) => {
      console.error('Google Sheet scraper enqueue failed', err);
    });

    res.json({ data: inserted });
  } catch (err) {
    console.error('Submission create error', err);
    res.status(500).json({
      error: 'Failed to create submission',
      details: err.message,
      code: err.code,
    });
  }
});

// Error logging endpoint (from frontend)
app.post('/api/error-logs', async (req, res) => {
  try {
    const { user_id, error_code, error_message, error_stack, page_url, user_agent, severity, metadata } = req.body;
    await pool.query(
      'INSERT INTO error_logs(user_id, error_code, error_message, error_stack, page_url, user_agent, severity, metadata, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8, now())',
      [user_id, error_code, error_message, error_stack, page_url, user_agent, severity, metadata || {}]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Dev auth endpoints: create simple JWTs for local testing when DEV_JWT_SECRET is set
app.post('/auth/dev-signup', async (req, res) => {
  if (!DEV_JWT_SECRET) return res.status(403).json({ error: 'Dev auth not enabled' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  try {
    // ensure profile exists
    await pool.query('INSERT INTO profiles(id, total_earnings, created_at) VALUES($1, $2, now()) ON CONFLICT (id) DO NOTHING', [email, 0]);
    const token = jwt.sign({ sub: email, email }, DEV_JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    return res.json({ access_token: token, user: { id: email, email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Dev signup failed' });
  }
});

app.post('/auth/dev-signin', async (req, res) => {
  if (!DEV_JWT_SECRET) return res.status(403).json({ error: 'Dev auth not enabled' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  try {
    // ensure profile exists
    await pool.query('INSERT INTO profiles(id, total_earnings, created_at) VALUES($1, $2, now()) ON CONFLICT (id) DO NOTHING', [email, 0]);
    const token = jwt.sign({ sub: email, email }, DEV_JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    return res.json({ access_token: token, user: { id: email, email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Dev signin failed' });
  }
});

// Server-side signup using Neon Auth Admin API. Requires:
// - NEON_AUTH_BASE_URL (e.g. https://.../neondb/auth)
// - NEON_AUTH_ADMIN_KEY (service role / admin key)
// Optional to programmatically issue tokens:
// - NEON_AUTH_CLIENT_ID and NEON_AUTH_CLIENT_SECRET
app.post('/auth/signup', async (req, res) => {
  const baseUrl = process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL;
  const adminKey = process.env.NEON_AUTH_ADMIN_KEY;
  if (!baseUrl || !adminKey) {
    return res.status(500).json({
      error: 'Neon Auth not configured on server. Set NEON_AUTH_BASE_URL (or VITE_NEON_AUTH_URL) and NEON_AUTH_ADMIN_KEY in .env.local, then restart the server.'
    });
  }

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const readResponseBody = async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (_err) {
      return { message: text };
    }
  };

  try {
    // Create the user via Admin API
    const createUrl = `${baseUrl.replace(/\/$/, '')}/admin/users`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminKey}`
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const createJson = await readResponseBody(createRes);
    if (!createRes.ok) {
      console.error('Neon Auth create user failed', createJson);
      return res.status(createRes.status || 500).json({
        error: 'Neon Auth create user failed',
        details: createJson,
        endpoint: createUrl
      });
    }

    const userId = createJson.id || (createJson.user && createJson.user.id) || null;

    // Ensure an app profile exists for this auth user id
    if (userId) {
      try {
        await pool.query(
          'INSERT INTO profiles(id, total_earnings, created_at) VALUES($1, $2, now()) ON CONFLICT (id) DO NOTHING',
          [userId, 0]
        );
      } catch (e) {
        console.error('Error creating profile row', e);
      }
    }

    // Optionally obtain a token via password grant if client credentials are configured
    const clientId = process.env.NEON_AUTH_CLIENT_ID;
    const clientSecret = process.env.NEON_AUTH_CLIENT_SECRET;
    if (clientId && clientSecret) {
      const tokenUrl = `${baseUrl.replace(/\/$/, '')}/token`;
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          username: email,
          password,
          client_id: clientId,
          client_secret: clientSecret
        })
      });
      const tokenJson = await readResponseBody(tokenRes);
      if (tokenRes.ok && tokenJson.access_token) {
        return res.json({ access_token: tokenJson.access_token, user: { id: userId || email, email } });
      }
      // If token request failed, still return created info
      return res.status(200).json({ created: true, user: { id: userId || email, email }, token_error: tokenJson, token_endpoint: tokenUrl });
    }

    return res.json({ created: true, user: { id: userId || email, email } });
  } catch (err) {
    console.error('Signup error', err);
    return res.status(500).json({ error: 'Signup failed', details: String(err && err.message ? err.message : err) });
  }
});


// Instagram OAuth routes.
// These routes verify page ownership by making the user authorize Instagram,
// then saving only server-side encrypted tokens. The browser never receives
// the Instagram access token.
app.get('/api/integrations/instagram/start', verifyToken, async (req, res) => {
  try {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        error: 'Instagram OAuth is not configured. Set INSTAGRAM_CLIENT_ID and INSTAGRAM_REDIRECT_URI in .env.local.',
      });
    }

    const authUrl = process.env.INSTAGRAM_AUTH_URL || 'https://www.instagram.com/oauth/authorize';
    const scope = process.env.INSTAGRAM_SCOPES || 'instagram_business_basic';
    const state = createOAuthState(req.user.sub, {
      provider: 'instagram',
      tags: normalizeOAuthTags(req.query.tags),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
    });

    res.json({ url: `${authUrl}?${params.toString()}` });
  } catch (err) {
    console.error('Instagram OAuth start error', err);
    res.status(500).json({ error: 'Failed to start Instagram connection' });
  }
});

app.get('/api/integrations/instagram/callback', async (req, res) => {
  const { code, state, error, error_reason, error_description } = req.query;

  if (error) {
    console.error('Instagram OAuth denied', { error, error_reason, error_description });
    return res.redirect(`${FRONTEND_BASE_URL}/pages?instagram=denied`);
  }

  if (!code || !state) {
    return res.status(400).send('Missing Instagram OAuth code or state');
  }

  try {
    const parsedState = parseAndVerifyOAuthState(state);
    const userId = parsedState.userId;
    const oauthTags = normalizeOAuthTags(parsedState.tags);

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).send('Instagram OAuth is not configured on the server');
    }

    const tokenUrl = process.env.INSTAGRAM_TOKEN_URL || 'https://api.instagram.com/oauth/access_token';

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: String(code),
      }),
    });

    const tokenJson = await readJsonResponse(tokenResponse);

    if (!tokenResponse.ok || !tokenJson.access_token) {
      console.error('Instagram token exchange failed', tokenJson);
      return res.status(400).send('Instagram token exchange failed');
    }

    const longLivedToken = await exchangeInstagramLongLivedToken(tokenJson.access_token);
    const accessToken = longLivedToken?.access_token || tokenJson.access_token;
    const tokenExpiresIn = Number(longLivedToken?.expires_in || tokenJson.expires_in || 0);
    const tokenExpiresAt = tokenExpiresIn > 0
      ? new Date(Date.now() + tokenExpiresIn * 1000)
      : null;
    const profileUrl = process.env.INSTAGRAM_PROFILE_URL || 'https://graph.instagram.com/me';

    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,followers_count&access_token=${encodeURIComponent(accessToken)}`
    );

    const profileJson = await readJsonResponse(profileResponse);

    if (!profileResponse.ok || !profileJson.id || !profileJson.username) {
      console.error('Instagram profile fetch failed', profileJson);
      return res.status(400).send('Instagram profile fetch failed');
    }

    const handle = `@${profileJson.username}`;
    const url = `https://www.instagram.com/${profileJson.username}`;
    const instagramExternalId = String(profileJson.id);
    const pageKey = getPageDedupeKey('instagram', {
      external_account_id: instagramExternalId,
      handle,
      url,
    });

    const existingPageResult = await pool.query(
      `
      SELECT *
      FROM pages
      WHERE user_id::text = $1
        AND platform = 'instagram'
        AND (
          external_account_id = $2
          OR page_key = $3
        )
      ORDER BY verified DESC, created_at DESC
      LIMIT 1
      `,
      [String(userId), instagramExternalId, pageKey]
    );

    let page = existingPageResult.rows[0] || null;

    if (page) {
      const updateResult = await pool.query(
        `
        UPDATE pages
        SET
          handle = $2,
          url = $3,
          follower_count = COALESCE($4, follower_count),
          external_account_id = $5,
          page_key = $6,
          dedupe_guard = true,
          verified = true,
          verified_at = now(),
          tags = CASE
            WHEN COALESCE(array_length($7::text[], 1), 0) > 0 THEN $7::text[]
            ELSE tags
          END
        WHERE id = $1
        RETURNING *
        `,
        [page.id, handle, url, profileJson.followers_count || null, instagramExternalId, pageKey, oauthTags]
      );

      page = updateResult.rows[0] || page;
    } else {
      const pageResult = await pool.query(
        `
        INSERT INTO pages(
          user_id,
          platform,
          handle,
          url,
          follower_count,
          tags,
          external_account_id,
          page_key,
          dedupe_guard,
          verified,
          verified_at,
          created_at
        )
        VALUES($1, 'instagram', $2, $3, $4, $5, $6, $7, true, true, now(), now())
        RETURNING *
        `,
        [userId, handle, url, profileJson.followers_count || null, oauthTags, instagramExternalId, pageKey]
      );

      page = pageResult.rows[0];
    }

    if (!page) {
      throw new Error('Could not create or find verified Instagram page');
    }

    await pool.query(
      `
      INSERT INTO instagram_connections(
        user_id,
        page_id,
        instagram_user_id,
        instagram_username,
        encrypted_access_token,
        token_expires_at,
        created_at,
        updated_at
      )
      VALUES($1, $2, $3, $4, $5, $6, now(), now())
      ON CONFLICT(user_id, instagram_user_id)
      DO UPDATE SET
        page_id = EXCLUDED.page_id,
        instagram_username = EXCLUDED.instagram_username,
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = now()
      `,
      [
        userId,
        page.id,
        String(profileJson.id),
        String(profileJson.username),
        encryptToken(accessToken),
        tokenExpiresAt,
      ]
    );

    res.redirect(`${FRONTEND_BASE_URL}/pages?instagram=connected`);
  } catch (err) {
    console.error('Instagram OAuth callback error', err);
    res.redirect(`${FRONTEND_BASE_URL}/pages?instagram=error`);
  }
});


// YouTube OAuth routes.
// Google verifies ownership of the selected YouTube channel. Tokens are kept
// encrypted on the server so Somma can later show content from that channel.
app.get('/api/integrations/youtube/start', verifyToken, async (req, res) => {
  try {
    const config = requireYouTubeConfig();
    const state = createOAuthState(req.user.sub, {
      provider: 'youtube',
      tags: normalizeOAuthTags(req.query.tags),
    });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes,
      state,
      include_granted_scopes: 'true',
      access_type: 'offline',
      prompt: 'consent select_account',
    });

    res.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    });
  } catch (err) {
    console.error('YouTube OAuth start error', err);
    res.status(500).json({
      error: 'Não foi possível iniciar a conexão com o YouTube.',
      details: err.message,
    });
  }
});

app.get('/api/integrations/youtube/callback', async (req, res) => {
  const config = getYouTubeConfig();
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('YouTube OAuth denied', { error, error_description });
    return res.redirect(
      `${config.frontendBaseUrl}/pages?youtube=denied&message=${encodeURIComponent(
        String(error_description || error)
      )}`
    );
  }

  if (!code || !state) {
    return res.redirect(`${config.frontendBaseUrl}/pages?youtube=missing_code`);
  }

  try {
    const completeConfig = requireYouTubeConfig();
    const parsedState = parseAndVerifyOAuthState(String(state));

    if (parsedState.provider && parsedState.provider !== 'youtube') {
      throw new Error('Invalid OAuth provider state');
    }

    const userId = parsedState.userId;
    const oauthTags = normalizeOAuthTags(parsedState.tags);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: completeConfig.clientId,
        client_secret: completeConfig.clientSecret,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: completeConfig.redirectUri,
      }),
    });

    const tokenJson = await readJsonResponse(tokenResponse);

    if (!tokenResponse.ok || !tokenJson.access_token) {
      console.error('YouTube token exchange failed', tokenJson);
      throw new Error(tokenJson.error_description || tokenJson.error || 'YouTube token exchange failed');
    }

    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics,contentDetails&mine=true',
      {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
        },
      }
    );

    const channelJson = await readJsonResponse(channelResponse);
    const channel = Array.isArray(channelJson.items) ? channelJson.items[0] : null;

    if (!channelResponse.ok || !channel?.id) {
      console.error('YouTube channel fetch failed', channelJson);
      throw new Error(
        channelJson.error?.message || 'Nenhum canal do YouTube foi encontrado nesta conta.'
      );
    }

    const channelId = String(channel.id);
    const channelTitle = String(channel.snippet?.title || 'Canal do YouTube').trim();
    const customUrl = String(channel.snippet?.customUrl || '').trim();
    const handle = customUrl
      ? `@${customUrl.replace(/^@+/, '')}`
      : channelTitle;
    const url = `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
    const followerCount = channel.statistics?.hiddenSubscriberCount
      ? null
      : numberOrNull(channel.statistics?.subscriberCount);
    const pageKey = getPageDedupeKey('youtube_shorts', {
      external_account_id: channelId,
      handle,
      url,
    });

    const existingPageResult = await pool.query(
      `
      SELECT *
      FROM pages
      WHERE user_id::text = $1
        AND platform = 'youtube_shorts'
        AND (
          external_account_id = $2
          OR page_key = $3
          OR LOWER(handle) = LOWER($4)
        )
      ORDER BY verified DESC, created_at DESC
      LIMIT 1
      `,
      [String(userId), channelId, pageKey, handle]
    );

    let page = existingPageResult.rows[0] || null;

    if (page) {
      const updateResult = await pool.query(
        `
        UPDATE pages
        SET
          handle = $2,
          url = $3,
          follower_count = $4,
          external_account_id = $5,
          page_key = $6,
          dedupe_guard = true,
          verified = true,
          verified_at = now(),
          tags = CASE
            WHEN COALESCE(array_length($7::text[], 1), 0) > 0 THEN $7::text[]
            ELSE tags
          END
        WHERE id = $1
        RETURNING *
        `,
        [page.id, handle, url, followerCount, channelId, pageKey, oauthTags]
      );

      page = updateResult.rows[0] || page;
    } else {
      const pageResult = await pool.query(
        `
        INSERT INTO pages(
          user_id,
          platform,
          handle,
          url,
          follower_count,
          tags,
          external_account_id,
          page_key,
          dedupe_guard,
          verified,
          verified_at,
          created_at
        )
        VALUES($1, 'youtube_shorts', $2, $3, $4, $5, $6, $7, true, true, now(), now())
        RETURNING *
        `,
        [userId, handle, url, followerCount, oauthTags, channelId, pageKey]
      );

      page = pageResult.rows[0];
    }

    if (!page) {
      throw new Error('Não foi possível salvar o canal verificado do YouTube.');
    }

    const accessTokenExpiresAt = new Date(
      Date.now() + Number(tokenJson.expires_in || 3600) * 1000
    );
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || null;

    await pool.query(
      `
      INSERT INTO youtube_connections(
        user_id,
        page_id,
        channel_id,
        channel_title,
        uploads_playlist_id,
        encrypted_access_token,
        encrypted_refresh_token,
        access_token_expires_at,
        scopes,
        created_at,
        updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
      ON CONFLICT(user_id, channel_id)
      DO UPDATE SET
        page_id = EXCLUDED.page_id,
        channel_title = EXCLUDED.channel_title,
        uploads_playlist_id = EXCLUDED.uploads_playlist_id,
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        encrypted_refresh_token = COALESCE(EXCLUDED.encrypted_refresh_token, youtube_connections.encrypted_refresh_token),
        access_token_expires_at = EXCLUDED.access_token_expires_at,
        scopes = EXCLUDED.scopes,
        updated_at = now()
      `,
      [
        userId,
        page.id,
        channelId,
        channelTitle,
        uploadsPlaylistId,
        encryptToken(tokenJson.access_token),
        tokenJson.refresh_token ? encryptToken(tokenJson.refresh_token) : null,
        accessTokenExpiresAt,
        tokenJson.scope || completeConfig.scopes,
      ]
    );

    return res.redirect(`${completeConfig.frontendBaseUrl}/pages?youtube=connected`);
  } catch (err) {
    console.error('YouTube OAuth callback error', err);
    return res.redirect(
      `${config.frontendBaseUrl}/pages?youtube=error&message=${encodeURIComponent(err.message)}`
    );
  }
});



// TikTok OAuth routes.
// The frontend calls /auth-url with a normal Bearer token. The backend
// returns the TikTok authorization URL because browser redirects cannot
// attach an Authorization header.
app.get('/api/integrations/tiktok/auth-url', verifyToken, async (req, res) => {
  try {
    const config = requireTikTokConfig();
    const state = createOAuthState(req.user.sub, {
      provider: 'tiktok',
      tags: normalizeOAuthTags(req.query.tags),
    });

    const params = new URLSearchParams({
      client_key: config.clientKey,
      response_type: 'code',
      scope: 'user.info.basic,video.list',
      redirect_uri: config.redirectUri,
      state,
    });

    res.json({
      data: {
        url: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
      },
    });
  } catch (err) {
    console.error('TikTok auth-url error', err);
    res.status(500).json({
      error: 'Failed to create TikTok auth URL',
      details: err.message,
    });
  }
});

app.get('/api/integrations/tiktok/callback', async (req, res) => {
  try {
    const config = requireTikTokConfig();
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.redirect(
        `${config.frontendBaseUrl}/pages?tiktok=error&message=${encodeURIComponent(
          String(error_description || error)
        )}`
      );
    }

    if (!code || !state) {
      return res.redirect(`${config.frontendBaseUrl}/pages?tiktok=missing_code`);
    }

    const parsedState = parseAndVerifyOAuthState(String(state));
    const userId = parsedState.userId;
    const oauthTags = normalizeOAuthTags(parsedState.tags);

    const tokenData = await exchangeTikTokCodeForToken(String(code));
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken || !refreshToken) {
      throw new Error('TikTok did not return both access and refresh tokens');
    }

    const userInfo = await getTikTokUserInfo(accessToken);

    if (!userInfo.open_id) {
      throw new Error('TikTok did not return an open_id for this user');
    }

    const displayName = userInfo.display_name || 'TikTok Creator';
    const handle = displayName.startsWith('@') ? displayName : `@${displayName}`;
    const tiktokExternalId = String(userInfo.open_id);
    const pageKey = getPageDedupeKey('tiktok', {
      external_account_id: tiktokExternalId,
      handle,
      url: '',
    });

    const existingPageResult = await pool.query(
      `
      SELECT *
      FROM pages
      WHERE user_id::text = $1
        AND platform = 'tiktok'
        AND (
          external_account_id = $2
          OR page_key = $3
        )
      ORDER BY verified DESC, created_at DESC
      LIMIT 1
      `,
      [String(userId), tiktokExternalId, pageKey]
    );

    let page = existingPageResult.rows[0] || null;

    if (page) {
      const updateResult = await pool.query(
        `
        UPDATE pages
        SET
          handle = $2,
          verified = true,
          verified_at = now(),
          external_account_id = $3,
          page_key = $4,
          dedupe_guard = true,
          tags = CASE
            WHEN COALESCE(array_length($5::text[], 1), 0) > 0 THEN $5::text[]
            ELSE tags
          END
        WHERE id = $1
        RETURNING *
        `,
        [page.id, handle, tiktokExternalId, pageKey, oauthTags]
      );

      page = updateResult.rows[0] || page;
    } else {
      const pageResult = await pool.query(
        `
        INSERT INTO pages(
          user_id,
          platform,
          handle,
          url,
          follower_count,
          tags,
          external_account_id,
          page_key,
          dedupe_guard,
          verified,
          verified_at,
          created_at
        )
        VALUES($1, 'tiktok', $2, $3, 0, $4, $5, $6, true, true, now(), now())
        RETURNING *
        `,
        [userId, handle, '', oauthTags, tiktokExternalId, pageKey]
      );

      page = pageResult.rows[0];
    }

    if (!page) {
      throw new Error('Could not create or find verified TikTok page');
    }

    const accessExpiresAt = new Date(
      Date.now() + Number(tokenData.expires_in || 0) * 1000
    );

    const refreshExpiresAt = new Date(
      Date.now() + Number(tokenData.refresh_expires_in || 0) * 1000
    );

    await pool.query(
      `
      INSERT INTO tiktok_connections(
        user_id,
        page_id,
        tiktok_open_id,
        display_name,
        avatar_url,
        profile_deep_link,
        encrypted_access_token,
        encrypted_refresh_token,
        access_token_expires_at,
        refresh_token_expires_at,
        scopes,
        created_at,
        updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
      ON CONFLICT(user_id, tiktok_open_id)
      DO UPDATE SET
        page_id = EXCLUDED.page_id,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        profile_deep_link = EXCLUDED.profile_deep_link,
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        access_token_expires_at = EXCLUDED.access_token_expires_at,
        refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
        scopes = EXCLUDED.scopes,
        updated_at = now()
      `,
      [
        userId,
        page.id,
        String(userInfo.open_id),
        displayName,
        userInfo.avatar_url || null,
        userInfo.profile_deep_link || null,
        encryptToken(accessToken),
        encryptToken(refreshToken),
        accessExpiresAt,
        refreshExpiresAt,
        tokenData.scope || '',
      ]
    );

    res.redirect(`${config.frontendBaseUrl}/pages?tiktok=connected`);
  } catch (err) {
    console.error('TikTok callback error', err);

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:8080';

    res.redirect(
      `${frontendBaseUrl}/pages?tiktok=error&message=${encodeURIComponent(err.message)}`
    );
  }
});

// Admin API routes.
// All admin routes require a verified Neon Auth token and a matching
// neon_auth."user".role = 'admin' value. Do not rely only on frontend
// route hiding for admin protection.
app.get('/api/admin/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Missing authenticated user' });
    }

    const result = await pool.query(
      `
      SELECT id, email, name, role
      FROM neon_auth."user"
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const authUser = result.rows[0];

    if (!authUser) {
      return res.status(404).json({ error: 'Auth user not found' });
    }

    res.json({
      data: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role || 'user',
        isAdmin: authUser.role === 'admin',
      },
    });
  } catch (err) {
    console.error('Admin role lookup failed', err);
    res.status(500).json({ error: 'Admin role lookup failed' });
  }
});

app.get('/api/admin/summary', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const [
      campaignCounts,
      submissionCounts,
      creatorCounts,
      pageCounts,
      withdrawalCounts,
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_campaigns,
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(status, '')) = 'active'
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          )::int AS active_campaigns
        FROM campaigns
      `),

      pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(status, '')) <> 'deleted'
          )::int AS total_submissions,
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(status, '')) = 'approved'
          )::int AS approved_submissions,
          COALESCE(SUM(COALESCE(views_count, 0)), 0)::bigint AS total_views,
          COALESCE(SUM(COALESCE(payment_amount, 0)), 0)::numeric AS total_payout
        FROM submissions
      `),

      // A creator is someone who connected at least one page.
      // This avoids counting Neon Auth test users who never used the app.
      pool.query(`
        SELECT COUNT(DISTINCT user_id)::int AS total_creators
        FROM pages
        WHERE user_id IS NOT NULL
      `),

      pool.query(`
        SELECT
          COUNT(*)::int AS total_pages,
          COUNT(*) FILTER (WHERE verified IS TRUE)::int AS verified_pages
        FROM pages
      `),

      pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(status, '')) IN ('requested', 'pending')
          )::int AS pending_withdrawals,
          COALESCE(
            SUM(amount) FILTER (
              WHERE LOWER(COALESCE(status, '')) IN ('requested', 'pending')
            ),
            0
          )::numeric AS pending_withdrawal_amount
        FROM withdrawals
      `),
    ]);

    const campaigns = campaignCounts.rows[0] || {};
    const submissions = submissionCounts.rows[0] || {};
    const creators = creatorCounts.rows[0] || {};
    const pages = pageCounts.rows[0] || {};
    const withdrawals = withdrawalCounts.rows[0] || {};

    res.json({
      data: {
        // These names intentionally match src/pages/admin/AdminDashboard.tsx.
        totalCampaigns: Number(campaigns.total_campaigns || 0),
        activeCampaigns: Number(campaigns.active_campaigns || 0),

        totalSubmissions: Number(submissions.total_submissions || 0),
        approvedSubmissions: Number(submissions.approved_submissions || 0),
        totalViews: Number(submissions.total_views || 0),
        totalPayout: Number(submissions.total_payout || 0),

        totalCreators: Number(creators.total_creators || 0),

        totalPages: Number(pages.total_pages || 0),
        verifiedPages: Number(pages.verified_pages || 0),

        pendingWithdrawals: Number(withdrawals.pending_withdrawals || 0),
        pendingWithdrawalAmount: Number(withdrawals.pending_withdrawal_amount || 0),
      },
    });
  } catch (err) {
    console.error('Admin summary error', err);
    res.status(500).json({ error: 'Failed to load admin summary' });
  }
});

app.get('/api/admin/campaigns', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.*,
        COUNT(DISTINCT s.id)::int AS submission_count,
        COUNT(DISTINCT cp.id)::int AS participant_count,
        COALESCE(SUM(s.views_count), 0)::bigint AS total_views,
        COALESCE(SUM(s.payment_amount), 0)::numeric AS total_payout
      FROM campaigns c
      LEFT JOIN submissions s ON s.campaign_id = c.id
      LEFT JOIN campaign_participants cp ON cp.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      `
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin campaigns list error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/campaigns/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Admin campaign detail error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/admin/campaigns', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      code,
      client,
      brief,
      budget,
      start_date,
      end_date,
      required_tags,
      platforms,
      audio_url,
      audio_urls,
      example_urls,
      rules,
      max_posts_per_creator,
      status,
    } = req.body;

    if (!title || !end_date) {
      return res.status(400).json({ error: 'Campaign title and end date are required' });
    }

    const result = await pool.query(
      `
      INSERT INTO campaigns(
        title, code, client, brief, budget, start_date, end_date,
        required_tags, platforms, audio_url, audio_urls, example_urls,
        rules, max_posts_per_creator, status, created_at
      )
      VALUES($1,$2,$3,$4,$5,COALESCE($6::timestamp, now()),$7,$8,$9,$10,$11,$12,$13,COALESCE($14, 1),COALESCE($15, 'active'),now())
      RETURNING *
      `,
      [
        title,
        code || null,
        client || null,
        brief || null,
        numberOrNull(budget),
        dateOrNull(start_date),
        end_date,
        normalizeArray(required_tags),
        normalizePlatformList(platforms),
        audio_url || null,
        normalizeJsonObject(audio_urls),
        normalizeJsonObject(example_urls),
        normalizeJsonObject(rules),
        numberOrNull(max_posts_per_creator),
        status || 'active',
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Admin campaign create error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/api/admin/campaigns/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      code,
      client,
      brief,
      budget,
      start_date,
      end_date,
      required_tags,
      platforms,
      audio_url,
      audio_urls,
      example_urls,
      rules,
      max_posts_per_creator,
      status,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE campaigns
      SET
        title = COALESCE($2, title),
        code = $3,
        client = $4,
        brief = $5,
        budget = $6,
        start_date = COALESCE($7::timestamp, start_date),
        end_date = COALESCE($8::timestamp, end_date),
        required_tags = $9,
        platforms = $10,
        audio_url = $11,
        audio_urls = $12,
        example_urls = $13,
        rules = $14,
        max_posts_per_creator = COALESCE($15, max_posts_per_creator),
        status = COALESCE($16, status)
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.id,
        title || null,
        code || null,
        client || null,
        brief || null,
        numberOrNull(budget),
        dateOrNull(start_date),
        dateOrNull(end_date),
        normalizeArray(required_tags),
        normalizePlatformList(platforms),
        audio_url || null,
        normalizeJsonObject(audio_urls),
        normalizeJsonObject(example_urls),
        normalizeJsonObject(rules),
        numberOrNull(max_posts_per_creator),
        status || null,
      ]
    );

    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Admin campaign update error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/admin/campaigns/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin campaign delete error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/submissions', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { campaign_id, status } = req.query;
    const values = [];
    const where = [];

    if (campaign_id) {
      values.push(String(campaign_id));
      where.push(`s.campaign_id::text = $${values.length}`);
    }

    if (status && status !== 'all') {
      values.push(String(status));
      where.push(`s.status = $${values.length}`);
    }

    const sql = `
      SELECT
        s.*,
        c.title AS campaign_title,
        p.handle AS page_handle,
        p.platform AS page_platform,
        p.follower_count AS page_follower_count,
        p.verified AS page_verified,
        au.email AS creator_email,
        COALESCE(au.name, au.email, s.user_id::text) AS creator_name,
        COALESCE(au.role, pr.role, 'creator') AS creator_role
      FROM submissions s
      LEFT JOIN campaigns c
        ON c.id::text = s.campaign_id::text
      LEFT JOIN LATERAL (
        SELECT handle, platform, follower_count, verified
        FROM pages p
        WHERE p.user_id::text = s.user_id::text
          AND (
            p.id::text = COALESCE(s.page_id::text, '')
            OR p.platform = s.platform
          )
        ORDER BY p.created_at DESC
        LIMIT 1
      ) p ON true
      LEFT JOIN profiles pr
        ON pr.id::text = s.user_id::text
      LEFT JOIN neon_auth."user" au
        ON au.id::text = s.user_id::text
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(s.uploaded_at, s.created_at) DESC
    `;

    const result = await pool.query(sql, values);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin submissions list error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.patch('/api/admin/submissions/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, views_count, likes_count, payment_amount, audio_verified } = req.body;

    const result = await pool.query(
      `
      UPDATE submissions
      SET
        status = COALESCE($2, status),
        views_count = COALESCE($3, views_count),
        likes_count = COALESCE($4, likes_count),
        payment_amount = COALESCE($5, payment_amount),
        audio_verified = COALESCE($6, audio_verified)
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.id,
        status || null,
        views_count === undefined ? null : Number(views_count),
        likes_count === undefined ? null : Number(likes_count),
        payment_amount === undefined ? null : Number(payment_amount),
        audio_verified === undefined ? null : Boolean(audio_verified),
      ]
    );

    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Admin submission update error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.patch('/api/admin/submissions/:id/metrics', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { username, likes, plays } = req.body;

    const likesCount = parseMetricNumber(likes);
    const playsCount = parseMetricNumber(plays);
    const payout = computePayoutFromPlays(playsCount);

    const result = await pool.query(
      `
      UPDATE submissions
      SET
        username = $2,
        likes_count = $3,
        views_count = $4,
        payment_amount = $5,
        metrics_synced_at = now(),
        metrics_source = 'manual'
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.id,
        username || null,
        likesCount,
        playsCount,
        payout,
      ]
    );

    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Manual metrics update error', err);
    res.status(500).json({
      error: 'Failed to update metrics',
      details: err.message,
      code: err.code,
    });
  }
});

app.post('/api/admin/submissions/:id/sync-metrics', verifyToken, requireAdmin, async (req, res) => {
  try {
    const submissionResult = await pool.query(
      `
      SELECT
        s.id,
        s.user_id,
        s.page_id,
        s.post_url,
        s.platform,
        s.tiktok_video_id
      FROM submissions s
      WHERE s.id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    const submission = submissionResult.rows[0];
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const platform = normalizePlatform(submission.platform);

    if (platform === 'tiktok') {
      let videoId = submission.tiktok_video_id || '';
      if (!videoId && submission.post_url) videoId = await getTikTokVideoIdFromUrl(submission.post_url);
      if (!videoId) return res.status(400).json({ error: 'Could not find TikTok video ID from URL' });

      const { accessToken, connection } = await getValidTikTokAccessTokenForUser(
        submission.user_id,
        submission.page_id || null
      );
      const video = await queryTikTokVideo(accessToken, videoId);
      if (!video) return res.status(404).json({ error: 'TikTok video not found for connected creator' });

      const views = Number(video.view_count || 0);
      const likes = Number(video.like_count || 0);
      const comments = Number(video.comment_count || 0);
      const shares = Number(video.share_count || 0);
      const payout = computePayoutFromPlays(views);

      const updateResult = await pool.query(
        `
        UPDATE submissions
        SET
          tiktok_video_id = $2,
          username = $3,
          likes_count = $4,
          views_count = $5,
          comments_count = $6,
          shares_count = $7,
          payment_amount = $8,
          metrics_synced_at = now(),
          metrics_source = 'tiktok_display_api'
        WHERE id = $1
        RETURNING *
        `,
        [submission.id, String(video.id || videoId), connection.display_name || null, likes, views, comments, shares, payout]
      );
      return res.json({ data: updateResult.rows[0] });
    }

    if (platform === 'instagram') {
      if (!submission.page_id || !submission.post_url) {
        return res.status(400).json({ error: 'Instagram submission is missing its connected page or post URL' });
      }

      const { accessToken, connection } = await getValidInstagramAccessTokenForPage(
        submission.user_id,
        submission.page_id
      );
      const mediaList = await listInstagramMedia(accessToken);
      const media = mediaList.find((item) => urlsMatch(item.url, submission.post_url));
      if (!media) {
        return res.status(404).json({
          error: 'Instagram post not found in the connected creator account',
          details: 'Reconecte a conta se a publicação não aparecer mais na lista da API.',
        });
      }

      const readInsight = async (metric) => {
        const params = new URLSearchParams({ metric, access_token: String(accessToken) });
        const response = await fetch(
          `https://graph.instagram.com/${encodeURIComponent(String(media.id))}/insights?${params.toString()}`
        );
        const json = await readJsonResponse(response);
        if (!response.ok || !Array.isArray(json.data) || !json.data[0]) return null;
        const entry = json.data[0];
        const value = entry.total_value?.value ?? (Array.isArray(entry.values) ? entry.values[0]?.value : null);
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      let views = await readInsight('views');
      if (views === null) views = await readInsight('plays');
      const shares = await readInsight('shares');
      const likes = Number(media.like_count || 0);
      const comments = Number(media.comment_count || 0);
      const payout = views === null ? null : computePayoutFromPlays(views);
      const source = views === null ? 'instagram_graph_api_basic' : 'instagram_graph_api';

      const updateResult = await pool.query(
        `
        UPDATE submissions
        SET
          username = COALESCE($2, username),
          likes_count = $3,
          views_count = COALESCE($4::bigint, views_count),
          comments_count = $5,
          shares_count = COALESCE($6::bigint, shares_count),
          payment_amount = CASE WHEN $7::numeric IS NULL THEN payment_amount ELSE $7::numeric END,
          metrics_synced_at = now(),
          metrics_source = $8
        WHERE id = $1
        RETURNING *
        `,
        [submission.id, connection.instagram_username || null, likes, views, comments, shares, payout, source]
      );
      return res.json({ data: updateResult.rows[0] });
    }

    if (platform === 'youtube_shorts') {
      if (!submission.page_id || !submission.post_url) {
        return res.status(400).json({ error: 'YouTube submission is missing its connected channel or video URL' });
      }

      let videoId = '';
      try {
        const url = new URL(submission.post_url);
        videoId = url.searchParams.get('v') || '';
        if (!videoId) {
          const shortMatch = url.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/i);
          if (shortMatch?.[1]) videoId = shortMatch[1];
        }
        if (!videoId && url.hostname.includes('youtu.be')) {
          videoId = url.pathname.split('/').filter(Boolean)[0] || '';
        }
      } catch (_err) {
        const match = String(submission.post_url).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([^&#?/]+)/i);
        videoId = match?.[1] || '';
      }
      if (!videoId) return res.status(400).json({ error: 'Could not determine YouTube video ID' });

      const { accessToken, connection } = await getValidYouTubeAccessTokenForPage(
        submission.user_id,
        submission.page_id
      );
      const video = await getYouTubeVideo(accessToken, connection, videoId);
      const views = Number(video.view_count || 0);
      const likes = Number(video.like_count || 0);
      const comments = Number(video.comment_count || 0);
      const payout = computePayoutFromPlays(views);

      const updateResult = await pool.query(
        `
        UPDATE submissions
        SET
          username = COALESCE($2, username),
          likes_count = $3,
          views_count = $4,
          comments_count = $5,
          payment_amount = $6,
          metrics_synced_at = now(),
          metrics_source = 'youtube_data_api'
        WHERE id = $1
        RETURNING *
        `,
        [submission.id, connection.channel_title || null, likes, views, comments, payout]
      );
      return res.json({ data: updateResult.rows[0] });
    }

    return res.status(400).json({
      error: `Automatic API metrics are not supported for ${platform || 'this platform'}`,
    });
  } catch (err) {
    console.error('Sync metrics error', err);
    res.status(500).json({
      error: 'Failed to sync metrics from platform API',
      details: err.message,
      code: err.code,
    });
  }
});

app.get('/api/admin/google-sheets-metrics', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const rows = await fetchGoogleSheetMetrics();

    res.json({
      data: {
        count: rows.length,
        rows,
      },
    });
  } catch (err) {
    console.error('Google Sheets metrics debug error', err);
    res.status(500).json({
      error: 'Failed to fetch Google Sheet metrics',
      details: err.message,
      code: err.code,
    });
  }
});

app.get('/api/tiktok/videos', verifyToken, async (req, res) => {
  try {
    const { cursor, page_id } = req.query;
    const { accessToken } = await getValidTikTokAccessTokenForUser(req.user.sub, page_id || null);
    const result = await listTikTokVideos(accessToken, cursor || null);

    res.json({
      data: result.videos,
      cursor: result.cursor,
      has_more: result.hasMore,
    });
  } catch (err) {
    console.error('TikTok videos error', err);
    res.status(500).json({
      error: 'Failed to load TikTok videos',
      details: err.message,
    });
  }
});

app.get('/api/connected-content', verifyToken, async (req, res) => {
  try {
    const pageId = String(req.query.page_id || '').trim();

    if (!pageId) {
      return res.status(400).json({ error: 'Selecione uma página conectada.' });
    }

    const page = await getOwnedVerifiedPage(req.user.sub, pageId);
    const content = await listConnectedContent(req.user.sub, page);

    return res.json({ data: content });
  } catch (err) {
    console.error('Connected content error', err);
    return res.status(500).json({
      error: 'Não foi possível carregar o conteúdo da conta conectada.',
      details: err.message,
    });
  }
});

app.get('/api/admin/creators', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      WITH page_stats AS (
        SELECT
          user_id::text AS user_id,
          COUNT(*)::int AS page_count
        FROM pages
        GROUP BY user_id::text
      ),
      submission_stats AS (
        SELECT
          user_id::text AS user_id,
          COUNT(*)::int AS submission_count,
          COALESCE(SUM(COALESCE(views_count, 0)), 0)::bigint AS total_views,
          COALESCE(SUM(COALESCE(payment_amount, 0)), 0)::numeric AS total_payout
        FROM submissions
        GROUP BY user_id::text
      ),
      profile_stats AS (
        SELECT
          id::text AS user_id,
          COALESCE(total_earnings, 0)::numeric AS total_earnings,
          pix_key_last4,
          created_at
        FROM profiles
      )
      SELECT
        au.id::text AS id,
        au.email AS email,
        COALESCE(au.name, au.email) AS name,
        COALESCE(au.role, 'user') AS role,
        COALESCE(pr.total_earnings, ss.total_payout, 0)::numeric AS total_earnings,
        CASE
          WHEN pr.pix_key_last4 IS NOT NULL THEN '**** ' || pr.pix_key_last4
          ELSE NULL
        END AS pix_key,
        pr.created_at AS created_at,
        COALESCE(ps.page_count, 0)::int AS page_count,
        COALESCE(ss.submission_count, 0)::int AS submission_count,
        COALESCE(ss.total_views, 0)::bigint AS total_views,
        COALESCE(ss.total_payout, 0)::numeric AS total_payout
      FROM neon_auth."user" au
      LEFT JOIN profile_stats pr
        ON pr.user_id = au.id::text
      LEFT JOIN page_stats ps
        ON ps.user_id = au.id::text
      LEFT JOIN submission_stats ss
        ON ss.user_id = au.id::text
      ORDER BY pr.created_at DESC NULLS LAST
      `
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin creators list error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.get('/api/admin/pages', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT p.*, pr.role AS owner_role
      FROM pages p
      LEFT JOIN profiles pr ON pr.id = p.user_id
      ORDER BY p.created_at DESC
      `
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin pages list error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.patch('/api/admin/pages/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { verified, tags, follower_count } = req.body;

    const result = await pool.query(
      `
      UPDATE pages
      SET
        verified = COALESCE($2, verified),
        verified_at = CASE WHEN $2 = true THEN COALESCE(verified_at, now()) ELSE verified_at END,
        tags = COALESCE($3, tags),
        follower_count = COALESCE($4, follower_count)
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.id,
        verified === undefined ? null : Boolean(verified),
        tags === undefined ? null : normalizeArray(tags),
        follower_count === undefined ? null : Number(follower_count),
      ]
    );

    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Admin page update error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/withdrawals', verifyToken, requireAdmin, async (_req, res) => {
  try {
    // Admin-facing route: return the full PIX key so the admin can actually pay.
    const result = await pool.query(
      `
      SELECT
        w.id,
        w.user_id,
        w.amount,
        w.status,
        COALESCE(w.pix_key, pr.pix_key) AS pix_key,
        COALESCE(w.pix_key_last4, pr.pix_key_last4) AS pix_key_last4,
        w.requested_at,
        w.processed_at,
        w.processed_by,
        au.email AS creator_email,
        COALESCE(au.name, au.email, w.user_id::text) AS creator_name
      FROM withdrawals w
      LEFT JOIN neon_auth."user" au
        ON au.id::text = w.user_id::text
      LEFT JOIN profiles pr
        ON pr.id::text = w.user_id::text
      ORDER BY w.requested_at DESC
      `
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin withdrawals list error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.patch('/api/admin/withdrawals/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['requested', 'pending', 'approved', 'paid', 'rejected'];

    if (!status || !allowedStatuses.includes(String(status))) {
      return res.status(400).json({ error: 'Invalid withdrawal status' });
    }

    const result = await pool.query(
      `
      UPDATE withdrawals
      SET
        status = $2,
        processed_at = CASE
          WHEN $2 IN ('paid', 'rejected') THEN now()
          ELSE processed_at
        END,
        processed_by = CASE
          WHEN $2 IN ('paid', 'rejected') THEN $3
          ELSE processed_by
        END
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id, status, req.user.sub]
    );

    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Admin withdrawal update error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
  }
});

app.get('/api/admin/errors', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM error_logs
      ORDER BY created_at DESC
      LIMIT 200
      `
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin error logs list error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/tags', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name ASC');
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin tags list error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/admin/tags', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const result = await pool.query(
      `
      INSERT INTO tags(name, created_at)
      VALUES($1, now())
      ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name
      RETURNING *
      `,
      [String(name).trim()]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Admin tag create error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/admin/tags/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin tag delete error', err);
    res.status(500).json({ error: 'DB error' });
  }
});


// Sheets metrics endpoint (placeholder) — returns empty array unless you implement fetching logic
app.get('/api/sheets/metrics', async (_req, res) => {
  try {
    const rows = await fetchGoogleSheetMetrics();
    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Sheets metrics endpoint error', err);
    res.status(500).json({
      status: 'error',
      error: 'Failed to fetch Google Sheet metrics',
      details: err.message,
      code: err.code,
    });
  }
});

// Generic table endpoints (basic CRUD) to support frontend compatibility shim
app.get('/api/tables/:table', verifyToken, async (req, res) => {
  try {
    const table = req.params.table;
    // support simple filters via query params: eq_field=value
    const params = req.query;
    let sql = `SELECT * FROM ${table}`;
    const values = [];
    const whereClauses = [];
    Object.keys(params).forEach((k, i) => {
      // skip special params
      if (['order','limit','single','select'].includes(k)) return;
      whereClauses.push(`${k} = $${values.length+1}`);
      values.push(params[k]);
    });
    if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;
    if (params.order) sql += ` ORDER BY ${params.order}`;
    if (params.limit) sql += ` LIMIT ${parseInt(params.limit,10)}`;
    const result = await pool.query(sql, values);
    if (params.single) return res.json({ data: result.rows[0] || null });
    return res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/tables/:table', verifyToken, async (req, res) => {
  try {
    const table = req.params.table;
    const payload = req.body;
    if (Array.isArray(payload)) {
      // bulk insert: build columns from first object
      const cols = Object.keys(payload[0]);
      const valuesClause = payload.map((row, i) => `(${cols.map((_, j) => `$${i*cols.length + j + 1}`).join(',')})`).join(',');
      const values = payload.flatMap(r => cols.map(c => r[c]));
      const sql = `INSERT INTO ${table}(${cols.join(',')}) VALUES ${valuesClause} RETURNING *`;
      const result = await pool.query(sql, values);
      return res.json({ data: result.rows });
    } else {
      const cols = Object.keys(payload);
      const vals = Object.values(payload);
      const placeholders = vals.map((_, i) => `$${i+1}`).join(',');
      const sql = `INSERT INTO ${table}(${cols.join(',')}) VALUES(${placeholders}) RETURNING *`;
      const result = await pool.query(sql, vals);
      return res.json({ data: result.rows[0] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/tables/:table', verifyToken, async (req, res) => {
  try {
    const table = req.params.table;
    // allow DELETE by id query param or by filters
    const params = req.query;
    if (params.id) {
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [params.id]);
      return res.json({ ok: true });
    }
    const keys = Object.keys(params);
    if (!keys.length) return res.status(400).json({ error: 'No filter provided' });
    const where = keys.map((k, i) => `${k} = $${i+1}`).join(' AND ');
    const vals = keys.map(k => params[k]);
    await pool.query(`DELETE FROM ${table} WHERE ${where}`, vals);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
