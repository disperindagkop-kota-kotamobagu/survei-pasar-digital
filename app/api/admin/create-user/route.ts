import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, full_name, role } = body;

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

    // 1. Create User in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) throw authError;

    // 2. Update/Insert Profile
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name,
          role
        });

      if (profileError) throw profileError;
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error('Admin Create User Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
