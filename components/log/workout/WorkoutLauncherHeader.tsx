import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';

export interface WorkoutLauncherHeaderProps {
  title: string;
  backIcon: 'chevron-back' | 'close';
  onBack: () => void;
  onClose: () => void;
}

export function WorkoutLauncherHeader({
  title,
  backIcon,
  onBack,
  onClose,
}: WorkoutLauncherHeaderProps) {
  const P = usePalette();
  const showTrailingClose = backIcon === 'chevron-back';

  return (
    <View style={[styles.header, { borderBottomColor: P.hair }]}>
      <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.hdrBtn}>
        <Ionicons name={backIcon} size={22} color={P.text} />
      </TouchableOpacity>
      <Text style={[styles.hdrTitle, { color: P.text }]}>{title}</Text>
      {showTrailingClose ? (
        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.hdrBtn}>
          <Ionicons name="close" size={22} color={P.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.hdrBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hdrBtn: { width: 40, alignItems: 'center' },
  hdrTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
});
