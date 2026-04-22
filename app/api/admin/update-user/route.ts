import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, password, full_name, role } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID user wajib diisi.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Konfigurasi server tidak lengkap: SUPABASE_SERVICE_ROLE_KEY belum terpasang.' 
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Update Auth User
    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    if (Object.keys(updateData).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updateData);
      if (authError) throw authError;
    }

    // 2. Update Profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role
      })
      .eq('id', id);

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, message: 'User berhasil diperbarui.' });
  } catch (error: any) {
    console.error('Admin Update User Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
