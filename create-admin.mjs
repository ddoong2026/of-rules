import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oeerjecqqygduflzcixz.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZXJqZWNxcXlnZHVmbHpjaXh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg5MDE1MSwiZXhwIjoyMDk4NDY2MTUxfQ.WJmPpy7d5g-EeL7uyR6DHHW8WZlM6HDPezbytMfmkiU';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('체크 제약 조건 우회를 위해 SQL 쿼리를 실행합니다...');
  
  // RLS bypass를 위해 role_check 업데이트
  const { error: sqlError } = await supabaseAdmin.rpc('exec_sql', {
    sql_query: "ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check; ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('CITIZEN', 'ASSEMBLY', 'PRESIDENT', 'MINISTER', 'TEACHER'));"
  });

  // RPC가 없어서 에러가 날 수 있으니 무시하고, REST API로 우회 시도
  const uid = '44575739-40ca-40a1-a37c-0683f0ea0a7e'; // 방금 생성된 UID
  
  console.log('users 테이블에 데이터를 다시 추가합니다...');
  const { error: dbError } = await supabaseAdmin
    .from('users')
    .insert([
      {
        id: uid,
        student_number: 9999, // 선생님용 가상 학번
        name: '선생님',
        role: 'TEACHER',
      }
    ]);

  if (dbError) {
    console.error('DB users 테이블 추가 오류:', dbError.message);
  } else {
    console.log('✅ users 테이블 데이터 추가 완료!');
  }
}

main();
