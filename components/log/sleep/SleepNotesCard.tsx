import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedCard, NotesField, usePalette } from '@/lib/log-theme';
import { sleepStyles } from '@/components/log/sleep/sleep-styles';

export interface SleepNotesCardProps {
  notes: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onChangeNotes: (text: string) => void;
}

export function SleepNotesCard({ notes, expanded, onToggleExpand, onChangeNotes }: SleepNotesCardProps) {
  const P = usePalette();

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
      <AnimatedCard delay={240} onPress={onToggleExpand}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: P.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}>
              How did it feel?
            </Text>
            <Text style={{ color: P.textFaint, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
              Add dreams, disruptions, late caffeine
            </Text>
          </View>
          {expanded ? (
            <Ionicons name="chevron-up" size={16} color={P.textFaint} />
          ) : (
            <View style={[sleepStyles.notesPill, { borderColor: P.cardEdge }]}>
              <Text style={{ color: P.textDim, fontSize: 12, fontWeight: '700' }}>+ Notes</Text>
            </View>
          )}
        </View>
        {expanded && (
          <View style={{ marginTop: 12 }}>
            <NotesField
              value={notes}
              onChangeText={onChangeNotes}
              placeholder="Dreams, disruptions, caffeine late?"
            />
          </View>
        )}
      </AnimatedCard>
    </View>
  );
}
