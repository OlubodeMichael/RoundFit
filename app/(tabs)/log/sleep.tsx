import { ForceDarkScope } from '@/context/theme-context';
import { SleepLogScreenContent } from '@/components/log/sleep/SleepLogScreenContent';
import { useSleepLog } from '@/hooks/use-sleep-log';

export default function SleepLogScreen() {
  const { view, actions } = useSleepLog();

  return (
    <ForceDarkScope>
      <SleepLogScreenContent view={view} actions={actions} />
    </ForceDarkScope>
  );
}
