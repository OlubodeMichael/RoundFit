import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/lib/log-theme';

export const PAST_INSIGHTS_PAGE_SIZE = 5;

interface InsightListPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function InsightListPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: InsightListPaginationProps) {
  const P = usePalette();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) return null;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <View style={s.row}>
      <Pressable
        onPress={() => onPageChange(page - 1)}
        disabled={!canPrev}
        accessibilityLabel="Previous page"
        style={({ pressed }) => [
          s.btn,
          {
            backgroundColor: P.sunken,
            borderColor: P.cardEdge,
            opacity: canPrev ? (pressed ? 0.7 : 1) : 0.35,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={P.textDim} />
      </Pressable>

      <Text style={[s.label, { color: P.textDim }]}>
        {start}–{end} of {totalItems}
      </Text>

      <Pressable
        onPress={() => onPageChange(page + 1)}
        disabled={!canNext}
        accessibilityLabel="Next page"
        style={({ pressed }) => [
          s.btn,
          {
            backgroundColor: P.sunken,
            borderColor: P.cardEdge,
            opacity: canNext ? (pressed ? 0.7 : 1) : 0.35,
          },
        ]}
      >
        <Ionicons name="chevron-forward" size={18} color={P.textDim} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
