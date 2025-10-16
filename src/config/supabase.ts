import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabase: SupabaseClient = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey
);

export default supabase;