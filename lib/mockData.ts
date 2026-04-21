// Mock data untuk demo (tanpa koneksi Supabase)
import { Market, Submission, Profile } from './supabaseClient';

export const DEMO_USER: Profile = {
  id: 'demo-user-1',
  full_name: 'Ahmad Fauzi',
  role: 'surveyor',
};

export const DEMO_MARKETS: Market[] = [
  { id: 'mkt-1', name: 'Pasar Sentral KTG', lat: -2.5355, long: 118.9741 },
  { id: 'mkt-2', name: 'Pasar Malam Kotabaru', lat: -2.5412, long: 118.9823 },
  { id: 'mkt-3', name: 'Pasar Induk Tanjung', lat: -2.5298, long: 118.9685 },
  { id: 'mkt-4', name: 'Pasar Tradisional Kelua', lat: -2.5501, long: 118.9612 },
  { id: 'mkt-5', name: 'Pasar Agribisnis Murung', lat: -2.5187, long: 118.9798 },
];

export const DEMO_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-1',
    surveyor_id: 'demo-user-2',
    market_id: 'mkt-1',
    amount: 250000,
    photo_url: '',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    notes: 'Pembayaran retribusi harian lapak sayur',
    surveyor_name: 'Budi Santoso',
    market_name: 'Pasar Sentral KTG',
  },
  {
    id: 'sub-2',
    surveyor_id: 'demo-user-3',
    market_id: 'mkt-2',
    amount: 175000,
    photo_url: '',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    notes: 'Retribusi pedagang ikan',
    surveyor_name: 'Siti Rahma',
    market_name: 'Pasar Malam Kotabaru',
  },
  {
    id: 'sub-3',
    surveyor_id: 'demo-user-2',
    market_id: 'mkt-3',
    amount: 320000,
    photo_url: '',
    status: 'approved',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    notes: 'Retribusi lapak pakaian',
    surveyor_name: 'Budi Santoso',
    market_name: 'Pasar Induk Tanjung',
  },
  {
    id: 'sub-4',
    surveyor_id: 'demo-user-4',
    market_id: 'mkt-4',
    amount: 150000,
    photo_url: '',
    status: 'rejected',
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    notes: 'Nominal tidak sesuai bukti foto',
    surveyor_name: 'Dewi Kurnia',
    market_name: 'Pasar Tradisional Kelua',
  },
  {
    id: 'sub-5',
    surveyor_id: 'demo-user-3',
    market_id: 'mkt-1',
    amount: 400000,
    photo_url: '',
    status: 'approved',
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
    notes: 'Retribusi pedagang elektronik',
    surveyor_name: 'Siti Rahma',
    market_name: 'Pasar Sentral KTG',
  },
  {
    id: 'sub-6',
    surveyor_id: 'demo-user-2',
    market_id: 'mkt-5',
    amount: 280000,
    photo_url: '',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    notes: 'Retribusi hasil tani',
    surveyor_name: 'Budi Santoso',
    market_name: 'Pasar Agribisnis Murung',
  },
];

export const DEMO_USERS: Profile[] = [
  { id: 'demo-admin', full_name: 'Administrator', role: 'admin' },
  { id: 'demo-surveyor', full_name: 'Ahmad Fauzi', role: 'surveyor' },
  { id: 'demo-checker', full_name: 'Rina Wati', role: 'checker' },
];

// Demo login credentials
export const DEMO_ACCOUNTS = [
  { email: 'admin@demo.com', password: 'demo123', user: DEMO_USERS[0] },
  { email: 'surveyor@demo.com', password: 'demo123', user: DEMO_USERS[1] },
  { email: 'checker@demo.com', password: 'demo123', user: DEMO_USERS[2] },
];
