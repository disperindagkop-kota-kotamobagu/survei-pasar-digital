import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Konfigurasi server tidak lengkap: SUPABASE_SERVICE_ROLE_KEY belum terpasang di Vercel.' 
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Delete from Auth (this usually triggers profile deletion if CASCADE is on, 
    // but we can manually handle profiles if needed)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) throw authError;

    // Optional: Manually delete profile if not cascaded
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin Delete User Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
