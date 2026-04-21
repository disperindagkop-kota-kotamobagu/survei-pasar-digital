-- ==========================================================
-- SQL SETUP (IDEMPOTENT): SISTEM SURVEI KONTRIBUSI PASAR KTG
-- Jalankan script ini di SQL Editor di Dashboard Supabase
-- ==========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'surveyor' CHECK (role IN ('surveyor', 'checker', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL: markets
CREATE TABLE IF NOT EXISTS markets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  lat FLOAT NOT NULL,
  long FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan kolom name pada markets unik (jika tabel sudah ada dari versi sebelumnya)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'markets_name_key' 
        AND conrelid = 'public.markets'::regclass
    ) THEN
        ALTER TABLE public.markets ADD CONSTRAINT markets_name_key UNIQUE (name);
    END IF;
EXCEPTION WHEN others THEN 
    -- Jika tabel belum ada, lewati saja
END $$;

-- 4. TABEL: submissions
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  surveyor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  market_id UUID REFERENCES markets(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  photo_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  location_lat FLOAT,
  location_long FLOAT,
  is_geofence_valid BOOLEAN DEFAULT FALSE,
  ocr_amount_detect DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FUNCTION & TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'surveyor')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 7. POLICIES
-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Markets
DROP POLICY IF EXISTS "Markets are viewable by authenticated users" ON markets;
CREATE POLICY "Markets are viewable by authenticated users" ON markets FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Only admins can modify markets" ON markets;
CREATE POLICY "Only admins can modify markets" ON markets FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Submissions
DROP POLICY IF EXISTS "Surveyors can view own submissions" ON submissions;
CREATE POLICY "Surveyors can view own submissions" ON submissions FOR SELECT USING (auth.uid() = surveyor_id);
DROP POLICY IF EXISTS "Surveyors can insert submissions" ON submissions;
CREATE POLICY "Surveyors can insert submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() = surveyor_id);
DROP POLICY IF EXISTS "Checkers and Admins can view all submissions" ON submissions;
CREATE POLICY "Checkers and Admins can view all submissions" ON submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('checker', 'admin'))
);
DROP POLICY IF EXISTS "Checkers can update submission status" ON submissions;
CREATE POLICY "Checkers can update submission status" ON submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'checker')
) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'checker')
);
DROP POLICY IF EXISTS "Admins have full access to submissions" ON submissions;
CREATE POLICY "Admins have full access to submissions" ON submissions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 8. SEED DATA
INSERT INTO markets (name, lat, long) VALUES
('Pasar Sentral KTG', -2.5355, 118.9741),
('Pasar Malam Kotabaru', -2.5412, 118.9823),
('Pasar Induk Tanjung', -2.5298, 118.9685),
('Pasar Tradisional Kelua', -2.5501, 118.9612),
('Pasar Agribisnis Murung', -2.5187, 118.9798)
ON CONFLICT (name) DO NOTHING;
