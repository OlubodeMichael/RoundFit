import { useRouter } from 'expo-router';
import { HelpCircle, Lock, LogOut, Receipt, Star, Trash2, UploadCloud } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { usePostHog } from 'posthog-react-native';

import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ExportDataModal } from '@/components/profile/ExportDataModal';
import {
  Divider,
  NavRow,
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { useAuth } from '@/hooks/use-auth';
import { isStoredTokenOAuth } from '@/utils/api';

export default function AccountScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  const posthog = usePostHog();
  const { signOut, deleteAccount } = useAuth();

  // OAuth users have no password, so "Change password" can't work for them.
  const [isOAuthAccount, setIsOAuthAccount] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isStoredTokenOAuth().then((v) => { if (!cancelled) setIsOAuthAccount(v); });
    return () => { cancelled = true; };
  }, []);

  return (
    <SettingsScreen title="Account" subtitle="Billing, security and your data.">
      <Section label="Subscription" P={P}>
        <NavRow
          icon={Receipt}
          color="#FBBF24"
          label="Manage Subscription"
          P={P}
          onPress={() => router.push('/(tabs)/profile/subscription')}
        />
        <Divider P={P} inset={64} />
        <NavRow
          icon={Star}
          color="#F59E0B"
          label="Upgrade to Premium"
          P={P}
          onPress={() => router.push('/(tabs)/profile/paywall')}
        />
      </Section>

      <Section label="Security & Data" P={P}>
        {!isOAuthAccount && (
          <>
            <NavRow
              icon={Lock}
              color="#818CF8"
              label="Change Password"
              P={P}
              onPress={() => router.push('/auth/change-password')}
            />
            <Divider P={P} inset={64} />
          </>
        )}
        <NavRow
          icon={UploadCloud}
          color="#38BDF8"
          label="Export Data"
          P={P}
          onPress={() => setExportModalOpen(true)}
        />
        <Divider P={P} inset={64} />
        <NavRow
          icon={HelpCircle}
          color="#2DD4BF"
          label="Help & Support"
          P={P}
          onPress={() => router.push('/(tabs)/profile/help')}
        />
      </Section>

      <Section label="Session" P={P}>
        <NavRow
          icon={LogOut}
          label="Sign Out"
          color="#FF453A"
          labelColor="#FF453A"
          P={P}
          hideChevron
          onPress={() => { posthog.capture('user_signed_out'); posthog.reset(); signOut(); }}
        />
      </Section>

      <Section label="Danger Zone" P={P}>
        <NavRow
          icon={Trash2}
          label="Delete Account"
          color="#FF453A"
          labelColor="#FF453A"
          P={P}
          hideChevron
          onPress={() => setDeleteModalOpen(true)}
        />
      </Section>

      <ExportDataModal
        visible={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExportStarted={() => posthog.capture('data_export_started')}
        onExportCompleted={() => posthog.capture('data_export_completed')}
        onExportFailed={(message) => posthog.capture('data_export_failed', { message })}
      />

      <DeleteAccountModal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDelete={deleteAccount}
      />
    </SettingsScreen>
  );
}
