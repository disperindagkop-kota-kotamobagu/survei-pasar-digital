// Supabase Client — ganti URL dan KEY di .env.local
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co').replace(/\/$/, '');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = 'surveyor' | 'checker' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}

export interface Market {
  id: string;
  name: string;
  lat: number;
  long: number;
}

export interface Submission {
  id: string;
  surveyor_id: string;
  market_id: string;
  amount: number;
  photo_url: string;
  status: 'pending' | 'approved' | 'rejected';
  location_lat?: number;
  location_long?: number;
  is_geofence_valid?: boolean;
  ocr_amount_detect?: number;
  created_at: string;
  notes?: string;
  location_type?: string;
  drive_link?: string;
  surveyor_name?: string;
  market_name?: string;
}
