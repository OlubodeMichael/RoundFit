import { useRouter } from 'expo-router';
import { HelpCircle, UploadCloud } from 'lucide-react-native';
import { useState } from 'react';
import { usePostHog } from 'posthog-react-native';

import { ExportDataModal } from '@/components/profile/ExportDataModal';
import {
  Divider,
  NavRow,
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';

export default function AccountScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  const posthog = usePostHog();

  const [exportModalOpen, setExportModalOpen] = useState(false);

  return (
    <SettingsScreen title="Account" subtitle="Billing, security and your data.">
      <Section label="Security & Data" P={P}>
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

      <ExportDataModal
        visible={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExportStarted={() => posthog.capture('data_export_started')}
        onExportCompleted={() => posthog.capture('data_export_completed')}
        onExportFailed={(message) => posthog.capture('data_export_failed', { message })}
      />
    </SettingsScreen>
  );
}
