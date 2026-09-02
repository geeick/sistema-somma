const { Pool } = require('pg');

async function installFinancialGuards() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION somma_guard_campaign_budget()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        committed numeric := 0;
      BEGIN
        IF NEW.budget IS NULL OR NEW.budget < 0 THEN
          RAISE EXCEPTION 'Campaign budget cannot be negative'
            USING ERRCODE = '23514';
        END IF;

        IF TG_OP = 'UPDATE' AND NEW.budget IS DISTINCT FROM OLD.budget THEN
          SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0)
          INTO committed
          FROM submissions
          WHERE campaign_id = NEW.id
            AND LOWER(COALESCE(status, '')) IN ('approved', 'paid');

          IF NEW.budget < committed THEN
            RAISE EXCEPTION 'Campaign budget cannot be lower than committed payouts. Committed: %, requested: %', committed, NEW.budget
              USING ERRCODE = '23514';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS somma_campaign_budget_guard ON campaigns;
      CREATE TRIGGER somma_campaign_budget_guard
      BEFORE INSERT OR UPDATE OF budget ON campaigns
      FOR EACH ROW
      EXECUTE FUNCTION somma_guard_campaign_budget();

      CREATE OR REPLACE FUNCTION somma_guard_submission_payout()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        campaign_budget numeric := 0;
        committed numeric := 0;
        next_payment numeric := 0;
      BEGIN
        next_payment := COALESCE(NEW.payment_amount, 0);

        IF next_payment < 0 THEN
          RAISE EXCEPTION 'Submission payment cannot be negative'
            USING ERRCODE = '23514';
        END IF;

        -- Once money is committed, metric refreshes may continue changing
        -- views/likes, but the promised payout itself is frozen.
        IF TG_OP = 'UPDATE'
          AND LOWER(COALESCE(OLD.status, '')) IN ('approved', 'paid')
          AND NEW.payment_amount IS DISTINCT FROM OLD.payment_amount THEN
          NEW.payment_amount := OLD.payment_amount;
          next_payment := COALESCE(OLD.payment_amount, 0);
        END IF;

        IF NEW.campaign_id IS NOT NULL
          AND LOWER(COALESCE(NEW.status, '')) IN ('approved', 'paid') THEN

          -- Lock the campaign so two simultaneous approvals cannot both use
          -- the same remaining budget.
          SELECT COALESCE(budget, 0)
          INTO campaign_budget
          FROM campaigns
          WHERE id = NEW.campaign_id
          FOR UPDATE;

          SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0)
          INTO committed
          FROM submissions
          WHERE campaign_id = NEW.campaign_id
            AND LOWER(COALESCE(status, '')) IN ('approved', 'paid')
            AND (TG_OP = 'INSERT' OR id <> NEW.id);

          IF committed + next_payment > campaign_budget THEN
            RAISE EXCEPTION 'Campaign budget exceeded. Budget: %, committed: %, requested: %', campaign_budget, committed, next_payment
              USING ERRCODE = '23514';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS somma_submission_payout_guard ON submissions;
      CREATE TRIGGER somma_submission_payout_guard
      BEFORE INSERT OR UPDATE OF status, payment_amount, campaign_id ON submissions
      FOR EACH ROW
      EXECUTE FUNCTION somma_guard_submission_payout();
    `);

    console.log('[financial-guard] campaign budget protections installed');
  } finally {
    await pool.end();
  }
}

module.exports = { installFinancialGuards };
