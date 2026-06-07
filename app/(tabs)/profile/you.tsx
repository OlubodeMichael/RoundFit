import { useFocusEffect } from '@react-navigation/native';
import { Flag, User } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';

import { DailyTargetsGrid } from '@/components/profile/DailyTargetsGrid';
import { DailyTargetsModal } from '@/components/profile/DailyTargetsModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { GoalsActivityModal } from '@/components/profile/GoalsActivityModal';
import {
  NavRow,
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { useProfile } from '@/hooks/use-profile';
import { getLocalTargets } from '@/utils/local-targets';
import { registerTodayTargetsListener } from '@/utils/today-sync';

const GOAL_LABELS: Record<string, string> = {
  lose_weight:  'Lose weight',
  build_muscle: 'Build muscle',
  boost_energy: 'Boost energy',
  maintain:     'Maintain',
};

export default function YouScreen() {
  const P = useSettingsPalette();
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
    <SettingsScreen title="You" subtitle="Your details, goals and daily targets.">
      <Section label="Personal Information" P={P}>
        <NavRow
          icon={User}
          color="#A855F7"
          label="Personal details"
          value={profile?.name ?? undefined}
          P={P}
          onPress={() => setEditProfileOpen(true)}
        />
      </Section>

      <Section label="Goals & Activity" P={P}>
        <NavRow
          icon={Flag}
          color="#F97316"
          label="Goals & Activity"
          value={goalDisplay}
          P={P}
          onPress={() => setGoalsOpen(true)}
        />
      </Section>

      <DailyTargetsGrid
        calories={caloriesTarget}
        protein={proteinTarget}
        water={waterTarget}
        sleep={sleepTargetDisplay}
        steps={stepsTargetDisplay}
        colors={{ card: P.card, edge: P.edge, text: P.text, dim: P.dim, faint: P.faint, sunken: P.sunken, isDark: P.isDark }}
        onEdit={() => setTargetsOpen(true)}
      />

      <EditProfileModal visible={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
      <GoalsActivityModal visible={goalsOpen} onClose={() => setGoalsOpen(false)} />
      <DailyTargetsModal
        visible={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        onSaved={() => { void reloadLocalTargets(); }}
      />
    </SettingsScreen>
  );
}
