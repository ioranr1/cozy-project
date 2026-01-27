-- Add auto_away_enabled column to profiles table
-- Default is TRUE so all new users get Auto-Away automatically
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS auto_away_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.auto_away_enabled IS 'When true, Away Mode is automatically enabled on Electron startup (without display off). Manual Away Mode remains unchanged.';