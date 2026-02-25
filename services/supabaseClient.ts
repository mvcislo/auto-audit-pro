
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = supabaseAnonKey === 'your_supabase_anon_key_here' || !supabaseAnonKey;

if (!supabaseUrl || isPlaceholder) {
  console.warn('Supabase credentials missing or using placeholder. Database functionality will be limited to local storage.');
}

export const supabase = (supabaseUrl && !isPlaceholder)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

