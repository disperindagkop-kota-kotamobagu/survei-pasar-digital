-- ==========================================================
-- SQL SETUP: SISTEM SURVEI KONTRIBUSI PASAR KTG
-- Jalankan script ini di SQL Editor di Dashboard Supabase
-- ==========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL: profiles (Berhubungan dengan auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'surveyor' CHECK (role IN ('surveyor', 'checker', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL: markets (Daftar Pasar & Koordinat)
CREATE TABLE markets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  long FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL: submissions (Data Survei)
CREATE TABLE submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  surveyor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  market_id UUID REFERENCES markets(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  photo_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  location_lat FLOAT,
  location_long FLOAT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRIGGER: Otomatis buat profil saat user signup
-- Fungsi trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'surveyor');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger ke table auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 7. POLICIES (KEAMANAN)

-- A. Policy untuk Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- B. Policy untuk Markets
CREATE POLICY "Markets are viewable by authenticated users" ON markets
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only admins can modify markets" ON markets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- C. Policy untuk Submissions
-- Surveyor bisa melihat data miliknya sendiri
CREATE POLICY "Surveyors can view own submissions" ON submissions
  FOR SELECT USING (auth.uid() = surveyor_id);
-- Surveyor bisa input data baru
CREATE POLICY "Surveyors can insert submissions" ON submissions
  FOR INSERT WITH CHECK (auth.uid() = surveyor_id);
-- Checker & Admin bisa melihat semua data
CREATE POLICY "Checkers and Admins can view all submissions" ON submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('checker', 'admin'))
  );
-- Checker bisa update status (Approve/Reject)
CREATE POLICY "Checkers can update submission status" ON submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'checker')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'checker')
  );
-- Admin akses penuh
CREATE POLICY "Admins have full access to submissions" ON submissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 8. SEED DATA: Daftar Pasar Awal
INSERT INTO markets (name, lat, long) VALUES
('Pasar Sentral KTG', -2.5355, 118.9741),
('Pasar Malam Kotabaru', -2.5412, 118.9823),
('Pasar Induk Tanjung', -2.5298, 118.9685),
('Pasar Tradisional Kelua', -2.5501, 118.9612),
('Pasar Agribisnis Murung', -2.5187, 118.9798);

-- 9. TIPS RESET MINGGUAN (Cron)
-- Jika ingin reset otomatis via Supabase Edge Functions / PG_Cron:
-- TRUNCATE submissions; -- Berbahaya jika belum di-archived
-- Lebih baik memindahkan data ke tabel submissions_archive tiap minggu.
