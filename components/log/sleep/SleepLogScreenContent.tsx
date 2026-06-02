import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '@/lib/log-theme';
import { SleepTimePicker } from '@/components/log/SleepTimePicker';
import { AnnouncementModal } from '@/components/ui/AnnouncementModal';
import type { SleepLogActions } from '@/hooks/use-sleep-log';
import type { SleepLogScreenViewModel } from '@/types/sleep-log';
import { SleepStarFieldBackground } from '@/components/log/sleep/SleepStarFieldBackground';
import { SleepLogHeader } from '@/components/log/sleep/SleepLogHeader';
import { SleepHero } from '@/components/log/sleep/SleepHero';
import { SleepHealthKitBanner, SleepStagesSection } from '@/components/log/sleep/SleepStagesSection';
import { SleepWindowCard } from '@/components/log/sleep/SleepWindowCard';
import { SleepQualityCard } from '@/components/log/sleep/SleepQualityCard';
import { SleepNotesCard } from '@/components/log/sleep/SleepNotesCard';
import { SleepDeepSleepCard } from '@/components/log/sleep/SleepDeepSleepCard';
import { SleepLogCta } from '@/components/log/sleep/SleepLogCta';

export interface SleepLogScreenContentProps {
  view: SleepLogScreenViewModel;
  actions: SleepLogActions;
}

export function SleepLogScreenContent({ view, actions }: SleepLogScreenContentProps) {
  const P      = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <StatusBar style="light" />
      <SleepStarFieldBackground />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <SleepLogHeader
          paddingTop={insets.top + 4}
          dateLabel={view.dateLabel}
          isToday={view.isToday}
          onBack={() => router.back()}
          onPrevDay={() => actions.navigateDate(-1)}
          onNextDay={() => actions.navigateDate(1)}
        />

        <SleepHero
          bedtime={view.hero.bedtime}
          wakeup={view.hero.wakeup}
          hours={view.hero.hours}
          loading={view.hero.loading}
        />

        <SleepHealthKitBanner visible={view.isHealthKitView} />

        <SleepStagesSection
          visible={view.stages.visible}
          segmentsLoading={view.stages.segmentsLoading}
          hasSegments={view.stages.hasSegments}
          fullCycles={view.stages.fullCycles}
          segments={view.stages.segments}
          stageSummary={view.stages.stageSummary}
          windowStart={view.stages.windowStart}
          windowEnd={view.stages.windowEnd}
        />

        <SleepWindowCard
          visible={view.showEditableFields}
          bedtime={view.hero.bedtime}
          wakeup={view.hero.wakeup}
          onPress={() => actions.setPickerVisible(true)}
        />

        <SleepTimePicker
          visible={view.pickerVisible}
          bedtime={view.hero.bedtime}
          wakeup={view.hero.wakeup}
          onConfirm={actions.confirmTimePicker}
          onCancel={() => actions.setPickerVisible(false)}
        />

        <SleepQualityCard
          quality={view.qualityDisplay.quality}
          qualityScore={view.qualityDisplay.qualityScore}
          sleepEfficiency={view.qualityDisplay.sleepEfficiency}
          readOnly={view.qualityDisplay.readOnly}
          expanded={view.qualityExpanded}
          onToggleExpand={() => actions.setQualityExpanded((v) => !v)}
          onSelectQuality={actions.selectQuality}
        />

        <SleepNotesCard
          notes={view.notes}
          expanded={view.notesExpanded}
          onToggleExpand={() => actions.setNotesExpanded((v) => !v)}
          onChangeNotes={actions.setNotes}
        />

        <SleepDeepSleepCard
          visible={view.showEditableFields}
          deepH={view.deepH}
          deepM={view.deepM}
          onChangeDeepH={actions.setDeepH}
          onChangeDeepM={actions.setDeepM}
        />

        <SleepLogCta
          showHealthKitAutoSaved={view.isHealthKitView}
          persistedManualLog={view.persistedManualLog}
          saveLabel={view.saveLabel}
          saving={view.saving}
          onSave={actions.handleSave}
        />
      </ScrollView>

      <AnnouncementModal
        visible={view.noSleepModalVisible}
        onClose={() => actions.setNoSleepModalVisible(false)}
        onPrimary={actions.enterManualMode}
        icon="moon"
        iconColor={P.sleep}
        iconBg={P.sleepSoft}
        title="No Sleep Detected"
        description={view.noSleepModalDescription}
        primaryLabel="Log Manually"
        dismissLabel="Maybe Later"
      />
    </View>
  );
}
