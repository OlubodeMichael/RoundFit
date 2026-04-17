import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

/** Resolves `/` — used when a session already exists or when sending users to sign-in. */
export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') return null;
  if (status === 'authenticated') return <Redirect href="/(tabs)" />;
  return <Redirect href="/auth" />;
}
