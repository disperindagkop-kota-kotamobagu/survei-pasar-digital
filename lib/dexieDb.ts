// Dexie.js — IndexedDB Offline Storage
import Dexie, { Table } from 'dexie';

export interface PendingSubmission {
  id?: number; // auto-increment IndexedDB key
  tempId: string; // UUID client-side
  surveyor_id: string;
  market_id: string;
  market_name: string;
  amount: number;
  photo_base64: string; // compressed photo
  notes: string;
  lat: number;
  long: number;
  is_geofence_valid: boolean;
  ocr_amount_detect: number | null;
  created_at: string;
  synced: number; // 0 for no, 1 for yes
  location_type?: 'toko' | 'ruko' | 'lapak' | 'perorangan';
}

// ... existing code ...





class SurveyorDB extends Dexie {
  pendingSubmissions!: Table<PendingSubmission, number>;

  constructor() {
    super('SurveyorPasarDB');
    this.version(1).stores({
      pendingSubmissions: '++id, tempId, market_id, synced, created_at',
    });
  }
}

export const db = new SurveyorDB();

// Add new pending submission
export async function addPendingSubmission(data: Omit<PendingSubmission, 'id'>): Promise<number> {
  return db.pendingSubmissions.add({ ...data, synced: 0 });
}

// Update existing pending submission
export async function updatePendingSubmission(id: number, data: Partial<PendingSubmission>): Promise<void> {
  await db.pendingSubmissions.update(id, data);
}

// Get all unsynced submissions
export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  // Gunakan filter koleksi agar aman dari error tipe data (boolean vs number) di IndexedDB
  return db.pendingSubmissions
    .toCollection()
    .filter(item => !item.synced || item.synced === 0)
    .toArray();
}

// Mark as synced (only after 200 OK from Supabase)
export async function markAsSynced(id: number): Promise<void> {
  await db.pendingSubmissions.update(id, { synced: 1 });
}

// Count pending
export async function countPending(): Promise<number> {
  return db.pendingSubmissions.where('synced').equals(0).count();
}

// Get all for display
export async function getAllLocalSubmissions(): Promise<PendingSubmission[]> {
  return db.pendingSubmissions.orderBy('created_at').reverse().toArray();
}
