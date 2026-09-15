import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing Supabase Service Role Key or URL. Please check your .env.local file.");
}

// Create a Supabase client with the Service Role Key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Verifies the caller's Supabase session token and confirms they are a TEACHER
// before any admin (service-role) mutation is allowed to run. Every route that
// uses supabaseAdmin to touch the users table must call this first, since the
// service-role key bypasses Row Level Security entirely.
export async function requireTeacher(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { error: '로그인이 필요합니다.', status: 401 };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: '로그인이 만료되었습니다.', status: 401 };

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', data.user.id)
    .single();
  if (!profile || profile.role !== 'TEACHER') {
    return { error: '교사 계정만 접근할 수 있습니다.', status: 403 };
  }

  return { user: profile };
}
