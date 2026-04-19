
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, status, hold_start_time, total_hold_seconds')
    .in('status', ['on_hold', 'issue']);

  if (error) {
    console.error(error);
  } else {
    console.log('Tasks with delay/issue:');
    console.table(data);
  }
}

checkTasks();
