import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { updates } = await request.json();

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: '유효하지 않은 데이터입니다.' }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Update users in public.users table using admin privileges
    for (const user of updates) {
      const { id, role, department } = user;
      
      const { error } = await supabaseAdmin
        .from('users')
        .update({ role, department: department || null })
        .eq('id', id);

      if (error) {
        results.failed++;
        results.errors.push(`[${user.name || id}] DB 업데이트 에러: ${error.message}`);
      } else {
        results.success++;
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
