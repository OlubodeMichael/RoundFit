import { View, Text, StyleSheet } from 'react-native';

interface Props {
  step:   number;
  total:  number;
  isDark: boolean;
}

export function ProgressBar({ step, total, isDark }: Props) {
  const currentStep = Math.max(1, step - 1);
  const stepCount = Math.max(1, total - 1);
  const mid = isDark ? 'rgba(247,243,238,0.48)' : '#8A8783';
  const track = isDark ? 'rgba(247,243,238,0.13)' : '#E3DED8';
  const progressWidth = `${Math.min(100, (currentStep / stepCount) * 100)}%` as `${number}%`;

  return (
    <View style={s.root}>
      <View
        style={s.progress}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Onboarding progress"
        accessibilityValue={{ min: 1, max: stepCount, now: currentStep, text: `Step ${currentStep} of ${stepCount}` }}
      >
        <Text style={[s.count, { color: mid }]}>
          <Text style={s.current}>{String(currentStep).padStart(2, '0')}</Text>
          {'  /  '}{String(stepCount).padStart(2, '0')}
        </Text>
        <View style={[s.track, { backgroundColor: track }]}>
          <View style={[s.fill, { width: progressWidth }]} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { height: 38, justifyContent: 'center' },
  progress: { flex: 1, justifyContent: 'center', gap: 7 },
  count: { alignSelf: 'flex-end', fontFamily: 'Archivo_500Medium', fontSize: 10, letterSpacing: 0.7, fontVariant: ['tabular-nums'] },
  current: { color: '#F97316', fontFamily: 'Archivo_600SemiBold' },
  track: { width: '100%', height: 3, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 999, backgroundColor: '#F97316' },
});
