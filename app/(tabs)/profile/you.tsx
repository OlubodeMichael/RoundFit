import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Flag, User } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyTargetsGrid } from '@/components/profile/DailyTargetsGrid';
import { DailyTargetsModal } from '@/components/profile/DailyTargetsModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { GoalsActivityModal } from '@/components/profile/GoalsActivityModal';
import {
  HeaderButton,
  ProfileGroup,
  ProfileHeader,
  ProfileRow,
} from '@/components/profile/profile-ui';
import { useSettingsPalette } from '@/components/profile/settings-ui';
import { useProfile } from '@/hooks/use-profile';
import { getLocalTargets } from '@/utils/local-targets';
import { registerTodayTargetsListener } from '@/utils/today-sync';

const GOAL_LABELS: Record<string, string> = {
  lose_weight:  'Lose weight',
  build_muscle: 'Build muscle',
  boost_energy: 'Boost energy',
  maintain:     'Maintain',
};

export default function BasicInformationScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, stats } = useProfile();

  const [sleepTarget, setSleepTarget] = useState(8);
  const [stepsTarget, setStepsTarget] = useState(10000);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const reloadLocalTargets = useCallback(async () => {
    const local = await getLocalTargets();
    setSleepTarget(profile?.sleepTarget ?? local.sleep_target ?? 8);
    setStepsTarget(profile?.stepsTarget ?? local.steps_target ?? 10000);
  }, [profile?.stepsTarget, profile?.sleepTarget]);

  useFocusEffect(useCallback(() => { void reloadLocalTargets(); }, [reloadLocalTargets]));
  useEffect(() => registerTodayTargetsListener(() => { void reloadLocalTargets(); }), [reloadLocalTargets]);

  const calorieGoal    = profile?.calorieBudget ?? profile?.tdee ?? stats.dailyCalories;
  const caloriesTarget = calorieGoal != null ? calorieGoal.toLocaleString() : '—';
  const proteinTarget  = stats.proteinGrams ? String(stats.proteinGrams) : '—';
  const waterTarget    = ((profile?.waterGoalMl ?? 2000) / 1000).toFixed(1);
  const sleepTargetDisplay = sleepTarget % 1 === 0 ? sleepTarget.toFixed(0) : sleepTarget.toFixed(1);
  const stepsTargetDisplay = stepsTarget.toLocaleString();
  const goalDisplay = profile ? (GOAL_LABELS[profile.goal] ?? '—') : '—';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 96 }}
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader
        P={P}
        title="Basic Information"
        left={<HeaderButton P={P} icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Back" />}
      />

      <ProfileGroup P={P} title="Personal Information">
        <ProfileRow
          P={P}
          icon={User}
          label="Personal details"
          value={profile?.name ?? undefined}
          onPress={() => setEditProfileOpen(true)}
        />
      </ProfileGroup>

      <ProfileGroup P={P} title="Goals & Activity">
        <ProfileRow
          P={P}
          icon={Flag}
          label="Goals & Activity"
          value={goalDisplay}
          onPress={() => setGoalsOpen(true)}
        />
      </ProfileGroup>

      <View style={{ marginTop: 18 }}>
        <DailyTargetsGrid
          calories={caloriesTarget}
          protein={proteinTarget}
          water={waterTarget}
          sleep={sleepTargetDisplay}
          steps={stepsTargetDisplay}
          colors={{ card: P.card, edge: P.edge, text: P.text, dim: P.dim, faint: P.faint, sunken: P.sunken, isDark: P.isDark }}
          onEdit={() => setTargetsOpen(true)}
        />
      </View>

      <EditProfileModal visible={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
      <GoalsActivityModal visible={goalsOpen} onClose={() => setGoalsOpen(false)} />
      <DailyTargetsModal
        visible={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        onSaved={() => { void reloadLocalTargets(); }}
      />
    </ScrollView>
  );
}
