-- Add blocked status to pages if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'page_status' AND e.enumlabel = 'blocked'
  ) THEN
    -- Add status column if it doesn't exist as text
    ALTER TABLE pages ALTER COLUMN status TYPE text;
    
    -- Update any existing deleted pages
    UPDATE pages SET status = 'blocked' WHERE status = 'deleted';
  END IF;
END $$;

-- Create index on page status for better performance
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);

-- Update RLS policy to prevent blocked pages from being used in campaigns
CREATE OR REPLACE FUNCTION check_page_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the page is blocked
  IF EXISTS (
    SELECT 1 FROM pages 
    WHERE id = NEW.page_id 
    AND status = 'blocked'
  ) THEN
    RAISE EXCEPTION 'Esta página foi bloqueada e não pode participar de campanhas';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to submissions to check page status
DROP TRIGGER IF EXISTS check_page_blocked_before_submission ON submissions;
CREATE TRIGGER check_page_blocked_before_submission
  BEFORE INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_page_not_blocked();

-- Add comment
COMMENT ON FUNCTION check_page_not_blocked IS 'Prevents submissions from blocked pages (users with 3+ strikes)';