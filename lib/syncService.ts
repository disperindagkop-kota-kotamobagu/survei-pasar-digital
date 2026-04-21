import { supabase } from './supabaseClient';
import { db, getPendingSubmissions, markAsSynced } from './dexieDb';
import { base64ToBlob } from './imageCompressor';

export async function syncSubmissions() {
  if (!navigator.onLine) return;

  const pending = await getPendingSubmissions();
  if (pending.length === 0) return;

  console.log(`Menyinkronkan ${pending.length} data ke server...`);

  for (const item of pending) {
    try {
      let photoUrl = '';

      // 1. Upload foto ke Supabase Storage jika ada
      if (item.photo_base64 && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')) {
        const blob = base64ToBlob(item.photo_base64);
        const fileName = `${item.surveyor_id}/${item.tempId}.jpg`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(fileName, blob, { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;
        
        const { data: publicUrl } = supabase.storage
          .from('submissions')
          .getPublicUrl(fileName);
        
        photoUrl = publicUrl.publicUrl;
      }

      // 2. Upsert ke tabel submissions (menggunakan id/tempId sebagai primary key)
      const { error: upsertError } = await supabase
        .from('submissions')
        .upsert({
          id: item.tempId,
          surveyor_id: item.surveyor_id,
          market_id: item.market_id,
          amount: item.amount,
          location_type: item.location_type || 'lapak',
          photo_url: photoUrl || undefined, // jangan timpa jika sudah ada dan edit tidak kirim foto
          notes: item.notes,
          location_lat: item.lat,
          location_long: item.long,
          is_geofence_valid: item.is_geofence_valid,
          ocr_amount_detect: item.ocr_amount_detect,
          created_at: item.created_at,
          status: 'pending',
          updated_at: new Date().toISOString()
        });

      if (upsertError) throw upsertError;

      // 3. Update status di local DB
      if (item.id) await markAsSynced(item.id);
      console.log(`Sync sukses: ${item.market_name} - ${item.amount}`);

    } catch (err) {
      console.error('Gagal sinkronisasi item:', err);
      // Biarkan tetap pending untuk dicoba lagi nanti
    }
  }
}

// Helper to start periodic sync
export function initBackgroundSync() {
  if (typeof window === 'undefined') return;

  // Sync saat koneksi kembali
  window.addEventListener('online', () => {
    syncSubmissions();
  });

  // Sync berkala setiap 1 menit jika online
  setInterval(() => {
    if (navigator.onLine) syncSubmissions();
  }, 60000);

  // Initial sync
  if (navigator.onLine) syncSubmissions();
}
