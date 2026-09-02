from pathlib import Path

path = Path('server/src/index.js')
text = path.read_text()

old = '''    const result = await pool.query(
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
'''

new = '''    const dbClient = await pool.connect();
    let inserted;

    try {
      await dbClient.query('BEGIN');

      // Serialize attempts for the same creator + campaign + publication so
      // two nearly simultaneous clicks cannot create duplicate rows.
      const submissionDedupeKey = [
        String(userId),
        String(campaign.id),
        normalizePlatform(page.platform),
        normalizeUrlForMatch(canonicalPostUrl),
      ].join(':');

      await dbClient.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [submissionDedupeKey]
      );

      const priorSubmissions = await dbClient.query(
        `
        SELECT id, post_url, tiktok_video_id, status
        FROM submissions
        WHERE user_id::text = $1
          AND campaign_id::text = $2
        `,
        [String(userId), String(campaign.id)]
      );

      const duplicateSubmission = priorSubmissions.rows.find((existing) => {
        const sameTikTokVideo =
          normalizePlatform(page.platform) === 'tiktok' &&
          String(existing.tiktok_video_id || '') &&
          String(existing.tiktok_video_id || '') === String(contentId);

        return sameTikTokVideo || urlsMatch(existing.post_url, canonicalPostUrl);
      });

      if (duplicateSubmission) {
        await dbClient.query('ROLLBACK');
        return res.status(409).json({
          error: 'Esta publicação já foi enviada para esta campanha.',
          code: 'DUPLICATE_CAMPAIGN_POST',
          existing_submission_id: duplicateSubmission.id,
        });
      }

      const result = await dbClient.query(
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

      inserted = result.rows[0];
      await dbClient.query('COMMIT');
    } catch (transactionError) {
      await dbClient.query('ROLLBACK').catch(() => {});
      throw transactionError;
    } finally {
      dbClient.release();
    }
'''

if old not in text:
    if "DUPLICATE_CAMPAIGN_POST" in text:
        raise SystemExit(0)
    raise SystemExit('Could not locate submission insert block')

path.write_text(text.replace(old, new, 1))
