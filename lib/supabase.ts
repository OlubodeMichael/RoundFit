import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // We manage tokens ourselves via SecureStore + custom backend refresh.
    // Implicit flow keeps OAuth callback tokens in the URL hash fragment so
    // our manual parser works. PKCE (the default) would need a code-exchange
    // step and a storage adapter for the verifier — unnecessary complexity here.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});
