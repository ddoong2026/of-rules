const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLawsJoin() {
  const { data, error } = await supabase
      .from('laws')
      .select(`
        id, title, reason, content, target_department, status, votes_for, votes_against, created_at, rejection_reason,
        users:proposer_id (name)
      `)
      .order('created_at', { ascending: false });
      
  if (error) {
    console.error('Error fetching laws:', error);
  } else {
    console.log('Success!', data.length, 'laws fetched.');
  }
}

checkLawsJoin();
