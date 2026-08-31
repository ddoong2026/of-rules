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

async function checkLaws() {
  const { data, error } = await supabase.from('laws').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error('Error fetching laws:', error);
  } else {
    console.log('Recent 5 laws:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkLaws();
