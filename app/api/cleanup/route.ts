import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  // Hanya jalankan jika ada secret key atau dipanggil oleh Vercel Cron
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response('Unauthorized', { status: 401 });
  // }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Cari data yang sudah 'approved' dan sudah punya 'drive_link'
    // Kita juga bisa membatasi hanya data yang lebih tua dari 1 hari jika ingin lebih aman
    const { data: approvedSubs, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('id, photo_url')
      .eq('status', 'approved')
      .not('drive_link', 'is', null);

    if (fetchError) throw fetchError;
    if (!approvedSubs || approvedSubs.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada data foto yang perlu dibersihkan.' });
    }

    console.log(`Menemukan ${approvedSubs.length} foto untuk dibersihkan dari Supabase...`);

    const deletedIds: string[] = [];
    const errors: string[] = [];

    // 2. Loop dan hapus file dari Storage
    for (const sub of approvedSubs) {
      try {
        // Ambil path lengkap SETELAH /public/submissions/
        // Contoh URL: https://.../storage/v1/object/public/submissions/USER_ID/TEMP_ID.jpg
        // Kita butuh: "USER_ID/TEMP_ID.jpg"
        const parts = sub.photo_url.split('/public/submissions/');
        const fullPath = parts.length > 1 ? parts[1] : null;

        if (fullPath) {
          console.log(`[CLEANUP] Deleting from Supabase: ${fullPath}`);
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from('submissions')
            .remove([fullPath]);

          if (deleteError) {
            console.error(`Gagal hapus file ${fileName}:`, deleteError.message);
            errors.push(`${sub.id}: ${deleteError.message}`);
          } else {
            // Update database agar photo_url dikosongkan (atau ditandai sudah dihapus)
            // Namun kita tetap simpan link drive-nya
            await supabaseAdmin
              .from('submissions')
              .update({ photo_url: null })
              .eq('id', sub.id);
            
            deletedIds.push(sub.id);
          }
        }
      } catch (err: any) {
        errors.push(`${sub.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pembersihan selesai. ${deletedIds.length} foto dihapus dari Supabase.`,
      deletedCount: deletedIds.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Cleanup API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
