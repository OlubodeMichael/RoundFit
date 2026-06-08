import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { CardAccent } from '@/components/ui/gradient-card-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface MirrorSectionHeaderProps {
  accent: CardAccent;
  icon: IoniconName;
  label: string;
  meta?: string;
  textDim: string;
  textFaint: string;
}

export function MirrorSectionHeader({
  accent,
  icon,
  label,
  meta,
  textDim,
  textFaint,
}: MirrorSectionHeaderProps) {
  return (
    <View style={s.row}>
      <View style={[s.iconRing, { backgroundColor: accent.iconSoft }]}>
        <View style={[s.iconBox, { backgroundColor: accent.iconBg }]}>
          <Ionicons name={icon} size={16} color="#FFF" />
        </View>
      </View>
      <View style={s.copy}>
        <Text style={[s.label, { color: textDim }]}>{label}</Text>
        {meta ? (
          <Text style={[s.meta, { color: textFaint }]} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconRing: { padding: 4, borderRadius: 14 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 3, minWidth: 0 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
