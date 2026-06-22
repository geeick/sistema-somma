const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const { Pool } = require('pg');

// Load the project's root .env.local when running from the server folder.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Postgres pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// JWKS client - expects NEON_AUTH_JWKS_URI env var
const jwksUri = process.env.NEON_AUTH_JWKS_URI; // e.g. https://auth.neon.tech/.well-known/jwks.json
let jwksClient = null;
if (jwksUri) {
  jwksClient = jwksRsa({ jwksUri });
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
    if (jwksClient && decodedHeader?.header?.kid) {
      const kid = decodedHeader && decodedHeader.header && decodedHeader.header.kid;
      const key = await new Promise((resolve, reject) => {
        jwksClient.getSigningKey(kid, (err, key) => {
          if (err) return reject(err);
          resolve(key.getPublicKey());
        });
      });

      const payload = jwt.verify(token, key, { algorithms: ['RS256'] });
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
    if (jwksClient) {
      const decodedHeader = jwt.decode(token, { complete: true });
      const kid = decodedHeader && decodedHeader.header && decodedHeader.header.kid;
      const key = await new Promise((resolve, reject) => {
        jwksClient.getSigningKey(kid, (err, key) => {
          if (err) return reject(err);
          resolve(key.getPublicKey());
        });
      });
      const payload = jwt.verify(token, key, { algorithms: ['RS256'] });
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
    const result = await pool.query('SELECT total_earnings, pix_key FROM profiles WHERE id = $1', [userId]);
    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
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
    const result = await pool.query(
      'INSERT INTO withdrawals(user_id, amount, pix_key, status, requested_at) VALUES($1,$2,$3,$4,now()) RETURNING *',
      [userId, amount, pix_key, 'requested']
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
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

// Sheets metrics endpoint (placeholder) — returns empty array unless you implement fetching logic
app.get('/api/sheets/metrics', async (req, res) => {
  res.json({ status: 'success', data: [] });
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
