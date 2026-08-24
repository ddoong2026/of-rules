import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { users } = await request.json();

    if (!users || !Array.isArray(users)) {
      return NextResponse.json({ error: '유효하지 않은 데이터입니다.' }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process sequentially to handle errors per user easily
    for (const userData of users) {
      const { email, name, student_number, role, department } = userData;

      // 1. Create Auth User
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: '123456', // User requested static initial password
        email_confirm: true,
      });

      if (authError) {
        results.failed++;
        results.errors.push(`[${email}] Auth 에러: ${authError.message}`);
        continue;
      }

      // 2. Insert into public.users table
      const { error: dbError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            id: authData.user.id,
            student_number: parseInt(student_number, 10),
            name,
            role,
            department: department || null,
          }
        ]);

      if (dbError) {
        // If DB insert fails, ideally we should rollback (delete auth user)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        
        results.failed++;
        results.errors.push(`[${email}] DB 에러: ${dbError.message}`);
      } else {
        results.success++;
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch creation error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
