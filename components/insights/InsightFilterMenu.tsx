import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePalette } from '@/lib/log-theme';

export type InsightDateScope = 'all' | 'this_week';
export type InsightSortOrder = 'newest' | 'oldest';

export interface InsightListFilters {
  scope: InsightDateScope;
  sort: InsightSortOrder;
  dateQuery: string;
}

export const DEFAULT_INSIGHT_FILTERS: InsightListFilters = {
  scope: 'all',
  sort: 'newest',
  dateQuery: '',
};

const SCOPE_OPTIONS: { value: InsightDateScope; label: string }[] = [
  { value: 'all', label: 'All insights' },
  { value: 'this_week', label: 'This week' },
];

const SORT_OPTIONS: { value: InsightSortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

interface InsightFilterMenuProps {
  filters: InsightListFilters;
  onChange: (filters: InsightListFilters) => void;
  anchorTop: number;
}

export function InsightFilterMenu({
  filters,
  onChange,
  anchorTop,
}: InsightFilterMenuProps) {
  const P = usePalette();
  const [open, setOpen] = useState(false);

  const isActive = useMemo(
    () =>
      filters.scope !== DEFAULT_INSIGHT_FILTERS.scope ||
      filters.sort !== DEFAULT_INSIGHT_FILTERS.sort ||
      filters.dateQuery.trim().length > 0,
    [filters],
  );

  const patch = (partial: Partial<InsightListFilters>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityLabel="Filter and sort insights"
        accessibilityRole="button"
        style={({ pressed }) => [
          s.trigger,
          {
            backgroundColor: P.sunken,
            borderColor: P.cardEdge,
          },
          pressed && { opacity: 0.65 },
        ]}
      >
        <Ionicons name="options-outline" size={20} color={P.textDim} />
        {isActive ? (
          <View style={[s.activeDot, { backgroundColor: P.fat }]} />
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={[s.modalRoot, { paddingTop: anchorTop + 52 }]}>
          <Pressable
            style={s.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close filter menu"
          />
          <View
            style={[
              s.menu,
              {
                backgroundColor: P.card,
                borderColor: P.cardEdge,
                shadowOpacity: P.isDark ? 0.45 : 0.12,
              },
            ]}
          >
            <Text style={[s.menuLabel, { color: P.textFaint }]}>
              SEARCH BY DATE
            </Text>
            <View
              style={[
                s.searchRow,
                { backgroundColor: P.sunken, borderColor: P.cardEdge },
              ]}
            >
              <Ionicons name="search-outline" size={16} color={P.textFaint} />
              <TextInput
                value={filters.dateQuery}
                onChangeText={(dateQuery) => patch({ dateQuery })}
                placeholder="e.g. June 10, Monday"
                placeholderTextColor={P.textFaint}
                style={[s.searchInput, { color: P.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {filters.dateQuery.length > 0 ? (
                <Pressable
                  onPress={() => patch({ dateQuery: '' })}
                  hitSlop={8}
                  accessibilityLabel="Clear date search"
                >
                  <Ionicons name="close-circle" size={16} color={P.textFaint} />
                </Pressable>
              ) : null}
            </View>

            <Text style={[s.menuLabel, { color: P.textFaint, marginTop: 4 }]}>
              SHOW
            </Text>
            {SCOPE_OPTIONS.map((option) => {
              const selected = filters.scope === option.value;
              return (
                <FilterRow
                  key={option.value}
                  label={option.label}
                  selected={selected}
                  onPress={() => patch({ scope: option.value })}
                />
              );
            })}

            <Text style={[s.menuLabel, { color: P.textFaint, marginTop: 4 }]}>
              SORT
            </Text>
            {SORT_OPTIONS.map((option) => {
              const selected = filters.sort === option.value;
              return (
                <FilterRow
                  key={option.value}
                  label={option.label}
                  selected={selected}
                  onPress={() => patch({ sort: option.value })}
                />
              );
            })}

            {isActive ? (
              <Pressable
                onPress={() => {
                  onChange(DEFAULT_INSIGHT_FILTERS);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  s.resetBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[s.resetText, { color: P.textDim }]}>
                  Reset filters
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function FilterRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const P = usePalette();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        pressed && { opacity: 0.7 },
        selected && { backgroundColor: P.sunken },
      ]}
    >
      <Text style={[s.rowText, { color: selected ? P.text : P.textDim }]}>
        {label}
      </Text>
      {selected ? (
        <Ionicons name="checkmark" size={18} color={P.fat} />
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  trigger: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menu: {
    width: 260,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menuLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
