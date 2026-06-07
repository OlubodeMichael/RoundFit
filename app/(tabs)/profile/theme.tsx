import {
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { ThemeSegmentPicker } from '@/components/profile/ThemeSegmentPicker';
import { useTheme } from '@/hooks/use-theme';

export default function ThemeScreen() {
  const P = useSettingsPalette();
  const { preference, setTheme } = useTheme();

  return (
    <SettingsScreen title="Theme" subtitle="Choose how RoundFit looks.">
      <Section label="Appearance" P={P}>
        <ThemeSegmentPicker value={preference} onChange={setTheme} P={P} />
      </Section>
    </SettingsScreen>
  );
}
