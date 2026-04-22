import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Filter only allowed fields to update
    const updateData: any = {};
    if (body.market_id) updateData.market_id = body.market_id;
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.location_type) updateData.location_type = body.location_type;
    if (body.notes !== undefined) updateData.notes = body.notes;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Submission updated successfully',
      data 
    });
  } catch (error: any) {
    console.error('Update API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
