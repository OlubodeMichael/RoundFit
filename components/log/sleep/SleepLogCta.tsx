import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { PrimaryButton, usePalette } from '@/lib/log-theme';
import { sleepStyles } from '@/components/log/sleep/sleep-styles';

export interface SleepLogCtaProps {
  showHealthKitAutoSaved: boolean;
  persistedManualLog: boolean;
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
}

export function SleepLogCta({
  showHealthKitAutoSaved,
  persistedManualLog,
  saveLabel,
  saving,
  onSave,
}: SleepLogCtaProps) {
  const P = usePalette();

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
      {showHealthKitAutoSaved ? (
        <View style={[sleepStyles.autoSavedPill, { backgroundColor: P.sleepSoft, borderColor: P.sleep + '40' }]}>
          <Ionicons name="checkmark-circle" size={16} color={P.sleep} />
          <Text style={[sleepStyles.autoSavedText, { color: P.sleep }]}>
            Saved automatically from Apple Health
          </Text>
        </View>
      ) : persistedManualLog ? (
        <View style={[sleepStyles.autoSavedPill, { backgroundColor: P.sleepSoft, borderColor: P.sleep + '40' }]}>
          <Ionicons name="checkmark-circle" size={16} color={P.sleep} />
          <Text style={[sleepStyles.autoSavedText, { color: P.sleep }]}>
            Sleep logged manually
          </Text>
        </View>
      ) : (
        <>
          <PrimaryButton
            label={saveLabel}
            icon="checkmark"
            onPress={onSave}
            loading={saving}
            accent={P.sleep}
          />
          <Text style={[sleepStyles.hint, { color: P.textFaint }]}>
            Connect Apple Health to sync sleep automatically.
          </Text>
        </>
      )}
    </View>
  );
}
