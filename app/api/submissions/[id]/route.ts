import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get submission to find photo_url
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('photo_url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Delete photo from storage if exists
    if (submission?.photo_url) {
      try {
        const parts = submission.photo_url.split('/public/submissions/');
        const fullPath = parts.length > 1 ? parts[1] : null;
        if (fullPath) {
          await supabaseAdmin.storage.from('submissions').remove([fullPath]);
        }
      } catch (err) {
        console.error('Failed to delete photo:', err);
      }
    }

    // 3. Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('submissions')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: 'Submission deleted successfully' });
  } catch (error: any) {
    console.error('Delete API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
