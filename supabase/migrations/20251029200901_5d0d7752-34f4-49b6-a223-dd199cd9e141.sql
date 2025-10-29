-- Add administrative fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS regional TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS divisao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS funcao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grau TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_regional ON profiles(regional);
CREATE INDEX IF NOT EXISTS idx_profiles_divisao ON profiles(divisao);
CREATE INDEX IF NOT EXISTS idx_profiles_cargo ON profiles(cargo);

-- Update profile_history to track all field changes
COMMENT ON TABLE profile_history IS 'Tracks all changes to user profiles including administrative fields';