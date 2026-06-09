import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

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
