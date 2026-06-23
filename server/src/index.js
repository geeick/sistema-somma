const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

// Load the project's root .env.local when running from the server folder.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

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

function signStateBody(body) {
  return crypto
    .createHmac('sha256', getStateSecret())
    .update(body)
    .digest('base64url');
}

function createOAuthState(userId) {
  const body = Buffer.from(JSON.stringify({
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

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_err) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
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
    const result = await pool.query(
      'INSERT INTO pages(user_id, platform, handle, url, follower_count, tags, created_at) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING *',
      [userId, platform, handle, url, follower_count, tags]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
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

    const result = await pool.query(
      `
      SELECT
        total_earnings,
        pix_key_last4
      FROM profiles
      WHERE id = $1
      `,
      [userId]
    );

    const profile = result.rows[0];

    res.json({
      data: profile
        ? {
            total_earnings: profile.total_earnings,
            pix_key: profile.pix_key_last4
              ? `•••• ${profile.pix_key_last4}`
              : null,
          }
        : {
            total_earnings: 0,
            pix_key: null,
          },
    });
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
    const result = await pool.query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY requested_at DESC', [userId]);
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/withdrawals', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { amount, pix_key } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        error: 'Withdrawal amount must be greater than 0',
      });
    }

    const pixKeyLast4 =
      typeof pix_key === 'string' && pix_key.trim()
        ? pix_key.trim().slice(-4)
        : null;

    if (pixKeyLast4) {
      await pool.query(
        `
        INSERT INTO profiles(id, total_earnings, pix_key_last4, created_at)
        VALUES($1, 0, $2, now())
        ON CONFLICT (id)
        DO UPDATE SET pix_key_last4 = EXCLUDED.pix_key_last4
        `,
        [userId, pixKeyLast4]
      );
    }

    const result = await pool.query(
      `
      INSERT INTO withdrawals(user_id, amount, status, requested_at)
      VALUES($1, $2, 'requested', now())
      RETURNING *
      `,
      [userId, amount]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Withdrawal create error', err);
    res.status(500).json({
      error: 'DB error',
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
    const state = createOAuthState(req.user.sub);

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

    const accessToken = tokenJson.access_token;
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
        verified,
        verified_at,
        created_at
      )
      VALUES($1, 'instagram', $2, $3, NULL, $4, $5, true, now(), now())
      ON CONFLICT DO NOTHING
      RETURNING *
      `,
      [userId, handle, url, [], String(profileJson.id)]
    );

    let page = pageResult.rows[0];

    if (!page) {
      const existingPageResult = await pool.query(
        `
        SELECT *
        FROM pages
        WHERE user_id = $1
          AND platform = 'instagram'
          AND external_account_id = $2
        LIMIT 1
        `,
        [userId, String(profileJson.id)]
      );

      page = existingPageResult.rows[0] || null;
    }

    if (!page) {
      const updateResult = await pool.query(
        `
        UPDATE pages
        SET
          handle = $3,
          url = $4,
          verified = true,
          verified_at = now()
        WHERE user_id = $1
          AND platform = 'instagram'
          AND handle = $2
        RETURNING *
        `,
        [userId, handle, handle, url]
      );

      page = updateResult.rows[0] || null;
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
      VALUES($1, $2, $3, $4, $5, NULL, now(), now())
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
      ]
    );

    res.redirect(`${FRONTEND_BASE_URL}/pages?instagram=connected`);
  } catch (err) {
    console.error('Instagram OAuth callback error', err);
    res.redirect(`${FRONTEND_BASE_URL}/pages?instagram=error`);
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
        normalizeArray(platforms),
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
        normalizeArray(platforms),
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
      values.push(campaign_id);
      where.push(`s.campaign_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
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
        pr.role AS creator_role
      FROM submissions s
      LEFT JOIN campaigns c ON c.id = s.campaign_id
      LEFT JOIN pages p ON p.id = s.page_id OR (p.user_id = s.user_id AND p.platform = s.platform)
      LEFT JOIN profiles pr ON pr.id = s.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(s.uploaded_at, s.created_at) DESC
    `;

    const result = await pool.query(sql, values);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin submissions list error', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.patch('/api/admin/submissions/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, views_count, payment_amount, audio_verified } = req.body;

    const result = await pool.query(
      `
      UPDATE submissions
      SET
        status = COALESCE($2, status),
        views_count = COALESCE($3, views_count),
        payment_amount = COALESCE($4, payment_amount),
        audio_verified = COALESCE($5, audio_verified)
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.id,
        status || null,
        views_count === undefined ? null : Number(views_count),
        payment_amount === undefined ? null : Number(payment_amount),
        audio_verified === undefined ? null : Boolean(audio_verified),
      ]
    );

    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Admin submission update error', err);
    res.status(500).json({ error: 'DB error' });
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
        COALESCE(pr.created_at, au."createdAt") AS created_at,
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
      ORDER BY COALESCE(pr.created_at, au."createdAt") DESC NULLS LAST
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
      SELECT
        p.*,
        COALESCE(au.role, pr.role, 'creator') AS owner_role,
        au.email AS owner_email,
        COALESCE(au.name, au.email, p.user_id::text) AS owner_name
      FROM pages p
      LEFT JOIN profiles pr
        ON pr.id::text = p.user_id::text
      LEFT JOIN neon_auth."user" au
        ON au.id::text = p.user_id::text
      ORDER BY p.created_at DESC
      `
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Admin pages list error', err);
    res.status(500).json({
      error: 'DB error',
      details: err.message,
      code: err.code,
    });
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
    const result = await pool.query(
      `
      SELECT
        w.*,
        au.email AS creator_email,
        COALESCE(au.name, au.email, w.user_id::text) AS creator_name,
        CASE
          WHEN pr.pix_key_last4 IS NOT NULL THEN '•••• ' || pr.pix_key_last4
          ELSE NULL
        END AS pix_key
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

    if (!status) {
      return res.status(400).json({ error: 'Missing withdrawal status' });
    }

    const result = await pool.query(
      `
      UPDATE withdrawals
      SET status = $2
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id, status]
    );

    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Admin withdrawal update error', err);
    res.status(500).json({ error: 'DB error' });
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
app.get('/api/sheets/metrics', async (req, res) => {
  res.json({ status: 'success', data: [] });
});

app.post('/api/submissions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { campaign_id, page_id, post_url, audio_url } = req.body;

    if (!campaign_id || !page_id || !post_url) {
      return res.status(400).json({
        error: 'Campaign, approved page, and post URL are required',
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
      WHERE id = $1
      LIMIT 1
      `,
      [campaign_id]
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

    const allowedPlatforms = Array.isArray(campaign.platforms)
      ? campaign.platforms
      : [];

    if (
      allowedPlatforms.length > 0 &&
      !allowedPlatforms.includes(page.platform)
    ) {
      return res.status(400).json({
        error: `This campaign does not accept ${page.platform} submissions`,
      });
    }

    const audioVerified = !campaign.audio_url;

    const result = await pool.query(
      `
      INSERT INTO submissions(
        user_id,
        campaign_id,
        page_id,
        title,
        platform,
        post_url,
        status,
        audio_verified,
        uploaded_at,
        created_at
      )
      VALUES($1,$2,$3,$4,$5,$6,'pending',$7,now(),now())
      RETURNING *
      `,
      [
        userId,
        campaign.id,
        page.id,
        `${campaign.title || 'Campaign'} - Submission`,
        page.platform,
        post_url,
        audioVerified,
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Submission create error', err);
    res.status(500).json({
      error: 'Failed to create submission',
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
