import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  const secret = process.env.READING_APP_WEBHOOK_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { student_number, group_code, xp_delta, event_id } = await request.json();
    const xp = Number(xp_delta);
    if (!Number.isInteger(Number(student_number)) || !group_code || !event_id || !Number.isInteger(xp) || xp <= 0) {
      return NextResponse.json({ error: 'Invalid dividend credit payload' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('credit_team_dividend', {
      p_student_number: Number(student_number),
      p_group_code: group_code,
      p_xp_delta: xp,
      p_source_event_id: event_id,
      p_amount: xp,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ credited: Boolean(data), credit_id: data });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
