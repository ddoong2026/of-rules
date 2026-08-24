import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase Service Role Key or URL. Please check your .env.local file.");
}

// Create a Supabase client with the Service Role Key for admin operations
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceRoleKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
