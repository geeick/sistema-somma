const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { Pool } = require('pg');

// This file is preloaded by the API start command. It runs a small background
// worker in the same Render process and keeps submission metrics fresh using
// the OAuth credentials already stored for the creator's connected account.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!global.__sommaMetricsAutoSyncStarted) {
  global.__sommaMetricsAutoSyncStarted = true;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const failureCooldown = new Map();

  const intervalMs = Math.max(
    15_000,
    Number(process.env.METRICS_AUTO_SYNC_INTERVAL_MS || 60_000)
  );
  const staleMinutes = Math.max(
    1,
    Number(process.env.METRICS_STALE_MINUTES || 5)
  );
  const batchSize = Math.min(
    100,
    Math.max(1, Number(process.env.METRICS_BATCH_SIZE || 25))
  );
  const failureCooldownMs = Math.max(
    60_000,
    Number(process.env.METRICS_FAILURE_COOLDOWN_MS || 15 * 60_000)
  );

  let batchRunning = false;

  function readJsonResponse(response) {
    return response.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch (_err) {
        return { message: text };
      }
    });
  }

  function getTokenEncryptionKey() {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('TOKEN_ENCRYPTION_KEY is required for API metric sync');
    }

    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }

    return key;
  }

  function encryptToken(token) {
    const key = getTokenEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(String(token), 'utf8'),
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
    if (!ivRaw || !tagRaw || !encryptedRaw) return null;

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

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
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

  function normalizePlatform(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

    if (normalized === 'youtube') return 'youtube_shorts';
    if (normalized === 'youtube_short') return 'youtube_shorts';
    if (normalized === 'tik_tok') return 'tiktok';
    return normalized;
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
    const match = String(url || '').match(
      /instagram\.com\/(?:reel|p|tv)\/([^/?#]+)/i
    );
    return match?.[1] ? String(match[1]).toLowerCase() : '';
  }

  function urlsMatch(leftUrl, rightUrl) {
    const left = normalizeUrlForMatch(leftUrl);
    const right = normalizeUrlForMatch(rightUrl);
    if (!left || !right) return false;

    const leftCode = instagramShortcode(left);
    const rightCode = instagramShortcode(right);
    if (leftCode && rightCode) return leftCode === rightCode;

    return left === right;
  }

  async function getInstagramConnection(userId, pageId) {
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
      throw new Error('Instagram account is not connected for this submission');
    }

    return connection;
  }

  async function refreshInstagramAccessToken(accessToken) {
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: String(accessToken),
    });

    const response = await fetch(
      `https://graph.instagram.com/refresh_access_token?${params.toString()}`
    );
    const json = await readJsonResponse(response);

    if (!response.ok || !json.access_token) {
      throw new Error(
        json.error?.message || json.message || 'Instagram token refresh failed'
      );
    }

    return json;
  }

  async function getValidInstagramAccessToken(userId, pageId) {
    const connection = await getInstagramConnection(userId, pageId);
    const accessToken = decryptToken(connection.encrypted_access_token);

    if (!accessToken) {
      throw new Error('Instagram access token could not be decrypted');
    }

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
      [
        connection.id,
        encryptToken(refreshed.access_token),
        refreshedExpiresAt,
      ]
    );

    return {
      accessToken: refreshed.access_token,
      connection: {
        ...connection,
        encrypted_access_token: encryptToken(refreshed.access_token),
        token_expires_at: refreshedExpiresAt,
      },
    };
  }

  async function findInstagramMediaByUrl(accessToken, postUrl) {
    let nextUrl = `https://graph.instagram.com/me/media?${new URLSearchParams({
      fields:
        'id,caption,media_type,permalink,timestamp,like_count,comments_count',
      limit: '100',
      access_token: String(accessToken),
    }).toString()}`;

    for (let page = 0; page < 6 && nextUrl; page += 1) {
      const response = await fetch(nextUrl);
      const json = await readJsonResponse(response);

      if (!response.ok || !Array.isArray(json.data)) {
        throw new Error(
          json.error?.message || json.message || 'Instagram media list failed'
        );
      }

      const match = json.data.find((media) => urlsMatch(media?.permalink, postUrl));
      if (match) return match;

      nextUrl = json.paging?.next || '';
    }

    return null;
  }

  async function getInstagramMedia(accessToken, mediaId) {
    const params = new URLSearchParams({
      fields:
        'id,caption,media_type,permalink,timestamp,like_count,comments_count',
      access_token: String(accessToken),
    });

    const response = await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        String(mediaId)
      )}?${params.toString()}`
    );
    const json = await readJsonResponse(response);

    if (!response.ok || !json.id) {
      throw new Error(
        json.error?.message || json.message || 'Instagram media lookup failed'
      );
    }

    return json;
  }

  function extractInsightValue(json) {
    const metric = Array.isArray(json?.data) ? json.data[0] : null;
    if (!metric) return null;

    const totalValue = numberOrNull(metric.total_value?.value);
    if (totalValue !== null) return totalValue;

    const firstValue = Array.isArray(metric.values)
      ? numberOrNull(metric.values[0]?.value)
      : null;

    return firstValue;
  }

  async function getInstagramInsight(accessToken, mediaId, metricName) {
    const params = new URLSearchParams({
      metric: metricName,
      access_token: String(accessToken),
    });

    const response = await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        String(mediaId)
      )}/insights?${params.toString()}`
    );
    const json = await readJsonResponse(response);

    if (!response.ok) {
      // Some metrics only exist for certain media types. Treat unsupported
      // metrics as unavailable so another applicable metric can still work.
      return null;
    }

    return extractInsightValue(json);
  }

  async function syncInstagramSubmission(submission) {
    const { accessToken, connection } = await getValidInstagramAccessToken(
      submission.user_id,
      submission.page_id
    );

    const matched = await findInstagramMediaByUrl(
      accessToken,
      submission.post_url
    );

    if (!matched?.id) {
      throw new Error(
        'Instagram publication was not found in the connected creator account'
      );
    }

    const media = await getInstagramMedia(accessToken, matched.id);

    // Media insights require instagram_business_manage_insights. We request
    // metrics separately because availability varies by media type and API
    // versions; an unsupported metric should not prevent likes/comments from
    // being refreshed from the basic media endpoint.
    const [viewsInsight, playsInsight, sharesInsight] = await Promise.all([
      getInstagramInsight(accessToken, media.id, 'views'),
      getInstagramInsight(accessToken, media.id, 'plays'),
      getInstagramInsight(accessToken, media.id, 'shares'),
    ]);

    const likes = numberOrNull(media.like_count);
    const comments = numberOrNull(media.comments_count);
    const shares = sharesInsight;
    const views = viewsInsight !== null ? viewsInsight : playsInsight;
    const payout = views === null ? null : computePayoutFromPlays(views);
    const source =
      views === null ? 'instagram_graph_api_basic' : 'instagram_graph_api';

    const result = await pool.query(
      `
      UPDATE submissions
      SET
        username = COALESCE($2, username),
        likes_count = COALESCE($3::bigint, likes_count),
        views_count = COALESCE($4::bigint, views_count),
        comments_count = COALESCE($5::bigint, comments_count),
        shares_count = COALESCE($6::bigint, shares_count),
        payment_amount = CASE
          WHEN $7::numeric IS NULL THEN payment_amount
          ELSE $7::numeric
        END,
        metrics_synced_at = now(),
        metrics_source = $8
      WHERE id = $1
      RETURNING id, metrics_synced_at, metrics_source
      `,
      [
        submission.id,
        connection.instagram_username || null,
        likes,
        views,
        comments,
        shares,
        payout,
        source,
      ]
    );

    return result.rows[0];
  }

  function extractYouTubeVideoId(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';

    try {
      const parsed = new URL(raw);
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.split('/').filter(Boolean)[0] || '';
      }

      const queryId = parsed.searchParams.get('v');
      if (queryId) return queryId;

      const pathMatch = parsed.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/i);
      if (pathMatch?.[1]) return pathMatch[1];
    } catch (_err) {
      // Fall through to regex parsing.
    }

    const match = raw.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([^&#?/]+)/i);
    return match?.[1] || '';
  }

  async function getYouTubeConnection(userId, pageId) {
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
      throw new Error('YouTube channel is not connected for this submission');
    }

    return connection;
  }

  async function refreshYouTubeAccessToken(refreshToken) {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('YouTube OAuth credentials are not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: String(clientId),
        client_secret: String(clientSecret),
        grant_type: 'refresh_token',
        refresh_token: String(refreshToken),
      }),
    });
    const json = await readJsonResponse(response);

    if (!response.ok || !json.access_token) {
      throw new Error(
        json.error_description ||
          json.error ||
          json.message ||
          'YouTube token refresh failed'
      );
    }

    return json;
  }

  async function getValidYouTubeAccessToken(userId, pageId) {
    const connection = await getYouTubeConnection(userId, pageId);
    const accessToken = decryptToken(connection.encrypted_access_token);
    const expiresAt = connection.access_token_expires_at
      ? new Date(connection.access_token_expires_at).getTime()
      : 0;

    if (accessToken && (!expiresAt || expiresAt - Date.now() > 60_000)) {
      return { accessToken, connection };
    }

    const refreshToken = decryptToken(connection.encrypted_refresh_token);
    if (!refreshToken) {
      throw new Error('Reconnect YouTube so Somma can refresh API metrics');
    }

    const refreshed = await refreshYouTubeAccessToken(refreshToken);
    const refreshedExpiresAt = new Date(
      Date.now() + Number(refreshed.expires_in || 3600) * 1000
    );

    await pool.query(
      `
      UPDATE youtube_connections
      SET encrypted_access_token = $2,
          access_token_expires_at = $3,
          scopes = COALESCE($4, scopes),
          updated_at = now()
      WHERE id = $1
      `,
      [
        connection.id,
        encryptToken(refreshed.access_token),
        refreshedExpiresAt,
        refreshed.scope || null,
      ]
    );

    return { accessToken: refreshed.access_token, connection };
  }

  async function syncYouTubeSubmission(submission) {
    const videoId = extractYouTubeVideoId(submission.post_url);
    if (!videoId) {
      throw new Error('Could not determine YouTube video ID from submission URL');
    }

    const { accessToken, connection } = await getValidYouTubeAccessToken(
      submission.user_id,
      submission.page_id
    );

    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: String(videoId),
    });
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json = await readJsonResponse(response);
    const video = Array.isArray(json.items) ? json.items[0] : null;

    if (!response.ok || !video?.id) {
      throw new Error(
        json.error?.message || 'YouTube video was not found through the API'
      );
    }

    if (
      connection.channel_id &&
      video.snippet?.channelId &&
      String(video.snippet.channelId) !== String(connection.channel_id)
    ) {
      throw new Error('YouTube video does not belong to the connected channel');
    }

    const views = numberOrNull(video.statistics?.viewCount) ?? 0;
    const likes = numberOrNull(video.statistics?.likeCount);
    const comments = numberOrNull(video.statistics?.commentCount);
    const payout = computePayoutFromPlays(views);

    const result = await pool.query(
      `
      UPDATE submissions
      SET
        username = COALESCE($2, username),
        likes_count = COALESCE($3::bigint, likes_count),
        views_count = $4::bigint,
        comments_count = COALESCE($5::bigint, comments_count),
        payment_amount = $6,
        metrics_synced_at = now(),
        metrics_source = 'youtube_data_api'
      WHERE id = $1
      RETURNING id, metrics_synced_at, metrics_source
      `,
      [
        submission.id,
        connection.channel_title || null,
        likes,
        views,
        comments,
        payout,
      ]
    );

    return result.rows[0];
  }

  function extractTikTokVideoId(url) {
    const match = String(url || '').match(/\/video\/(\d+)/i);
    return match?.[1] || '';
  }

  async function getTikTokConnection(userId, pageId) {
    const result = await pool.query(
      `
      SELECT *
      FROM tiktok_connections
      WHERE user_id::text = $1
        AND page_id::text = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [String(userId), String(pageId)]
    );

    const connection = result.rows[0];
    if (!connection) {
      throw new Error('TikTok account is not connected for this submission');
    }

    return connection;
  }

  async function refreshTikTokAccessToken(refreshToken) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      throw new Error('TikTok OAuth credentials are not configured');
    }

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: String(clientKey),
        client_secret: String(clientSecret),
        grant_type: 'refresh_token',
        refresh_token: String(refreshToken),
      }),
    });
    const json = await readJsonResponse(response);

    if (!response.ok || json.error) {
      throw new Error(
        json.error_description ||
          json.error ||
          json.message ||
          'TikTok token refresh failed'
      );
    }

    return json;
  }

  async function getValidTikTokAccessToken(userId, pageId) {
    const connection = await getTikTokConnection(userId, pageId);
    const accessToken = decryptToken(connection.encrypted_access_token);
    const expiresAt = connection.access_token_expires_at
      ? new Date(connection.access_token_expires_at).getTime()
      : 0;

    if (accessToken && expiresAt && expiresAt - Date.now() > 60_000) {
      return { accessToken, connection };
    }

    // Older rows may not have an expiry. In that case, try the stored token
    // first rather than needlessly rotating it every minute.
    if (accessToken && !expiresAt) {
      return { accessToken, connection };
    }

    const refreshToken = decryptToken(connection.encrypted_refresh_token);
    if (!refreshToken) {
      throw new Error('Reconnect TikTok so Somma can refresh API metrics');
    }

    const refreshed = await refreshTikTokAccessToken(refreshToken);
    const accessExpiresAt = new Date(
      Date.now() + Number(refreshed.expires_in || 0) * 1000
    );
    const refreshExpiresAt = refreshed.refresh_expires_in
      ? new Date(Date.now() + Number(refreshed.refresh_expires_in) * 1000)
      : connection.refresh_token_expires_at;

    await pool.query(
      `
      UPDATE tiktok_connections
      SET encrypted_access_token = $2,
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
        accessExpiresAt,
        refreshExpiresAt,
      ]
    );

    return { accessToken: refreshed.access_token, connection };
  }

  async function queryTikTokVideo(accessToken, videoId) {
    const fields = [
      'id',
      'like_count',
      'comment_count',
      'share_count',
      'view_count',
    ].join(',');

    const response = await fetch(
      `https://open.tiktokapis.com/v2/video/query/?fields=${encodeURIComponent(
        fields
      )}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: { video_ids: [String(videoId)] },
        }),
      }
    );
    const json = await readJsonResponse(response);

    if (!response.ok || json.error?.code !== 'ok') {
      throw new Error(
        json.error?.message ||
          json.error?.code ||
          json.message ||
          'TikTok video query failed'
      );
    }

    return json.data?.videos?.[0] || null;
  }

  async function syncTikTokSubmission(submission) {
    const videoId =
      String(submission.tiktok_video_id || '').trim() ||
      extractTikTokVideoId(submission.post_url);

    if (!videoId) {
      throw new Error('Could not determine TikTok video ID from submission');
    }

    const { accessToken, connection } = await getValidTikTokAccessToken(
      submission.user_id,
      submission.page_id
    );
    const video = await queryTikTokVideo(accessToken, videoId);

    if (!video?.id) {
      throw new Error('TikTok video was not found through the connected account');
    }

    const views = numberOrNull(video.view_count) ?? 0;
    const likes = numberOrNull(video.like_count);
    const comments = numberOrNull(video.comment_count);
    const shares = numberOrNull(video.share_count);
    const payout = computePayoutFromPlays(views);

    const result = await pool.query(
      `
      UPDATE submissions
      SET
        tiktok_video_id = $2,
        username = COALESCE($3, username),
        likes_count = COALESCE($4::bigint, likes_count),
        views_count = $5::bigint,
        comments_count = COALESCE($6::bigint, comments_count),
        shares_count = COALESCE($7::bigint, shares_count),
        payment_amount = $8,
        metrics_synced_at = now(),
        metrics_source = 'tiktok_display_api'
      WHERE id = $1
      RETURNING id, metrics_synced_at, metrics_source
      `,
      [
        submission.id,
        String(video.id || videoId),
        connection.display_name || null,
        likes,
        views,
        comments,
        shares,
        payout,
      ]
    );

    return result.rows[0];
  }

  async function syncSubmission(submission) {
    const platform = normalizePlatform(submission.platform);

    if (platform === 'instagram') {
      return syncInstagramSubmission(submission);
    }
    if (platform === 'youtube_shorts') {
      return syncYouTubeSubmission(submission);
    }
    if (platform === 'tiktok') {
      return syncTikTokSubmission(submission);
    }

    return null;
  }

  async function getStaleSubmissions() {
    const cutoff = new Date(Date.now() - staleMinutes * 60_000);
    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        page_id,
        platform,
        post_url,
        tiktok_video_id,
        metrics_synced_at,
        metrics_source,
        status
      FROM submissions
      WHERE LOWER(COALESCE(status, 'pending')) IN ('pending', 'approved')
        AND LOWER(COALESCE(platform, '')) IN (
          'instagram', 'tiktok', 'youtube', 'youtube_shorts'
        )
        AND COALESCE(metrics_source, '') <> 'manual'
        AND (
          metrics_synced_at IS NULL
          OR metrics_synced_at < $1
        )
      ORDER BY metrics_synced_at ASC NULLS FIRST,
               COALESCE(uploaded_at, created_at) DESC
      LIMIT $2
      `,
      [cutoff, batchSize]
    );

    return result.rows;
  }

  async function runBatch() {
    if (batchRunning) return;
    batchRunning = true;

    try {
      const submissions = await getStaleSubmissions();
      let synced = 0;

      for (const submission of submissions) {
        const retryAfter = failureCooldown.get(String(submission.id)) || 0;
        if (retryAfter > Date.now()) continue;

        try {
          const result = await syncSubmission(submission);
          if (result) synced += 1;
          failureCooldown.delete(String(submission.id));
        } catch (error) {
          failureCooldown.set(
            String(submission.id),
            Date.now() + failureCooldownMs
          );
          console.warn(
            `[metrics-auto-sync] ${submission.platform} submission ${submission.id} failed:`,
            error?.message || error
          );
        }
      }

      if (synced > 0) {
        console.log(
          `[metrics-auto-sync] refreshed ${synced} submission${
            synced === 1 ? '' : 's'
          } from platform APIs`
        );
      }
    } catch (error) {
      console.error(
        '[metrics-auto-sync] batch failed:',
        error?.message || error
      );
    } finally {
      batchRunning = false;
    }
  }

  // Give the API server a few seconds to finish startup, then keep metrics
  // fresh in the background. Render may suspend an idle free service; once it
  // wakes, the worker immediately catches up on stale submissions.
  const initialTimer = setTimeout(runBatch, 5_000);
  initialTimer.unref?.();

  const timer = setInterval(runBatch, intervalMs);
  timer.unref?.();

  console.log(
    `[metrics-auto-sync] enabled (every ${Math.round(
      intervalMs / 1000
    )}s, stale after ${staleMinutes}m, batch ${batchSize})`
  );
}
