import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { WorkoutActivityCard } from '@/components/log/workout/WorkoutActivityCard';
import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import { usePalette } from '@/lib/log-theme';
import { getRecentCatalogEntries } from '@/utils/workout-recent';

import { WorkoutRecentRow } from './WorkoutRecentRow';

export interface WorkoutActivityGridProps {
  entries: readonly WorkoutCatalogEntry[];
  selectedId: string | null;
  onSelect: (entry: WorkoutCatalogEntry) => void;
  onRecentSelect?: (entry: WorkoutCatalogEntry) => void;
}

export function WorkoutActivityGrid({
  entries,
  selectedId,
  onSelect,
  onRecentSelect,
}: WorkoutActivityGridProps) {
  const P = usePalette();
  const [search, setSearch] = useState('');
  const [recentEntries, setRecentEntries] = useState<WorkoutCatalogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    void getRecentCatalogEntries().then((recents) => {
      if (!cancelled) setRecentEntries(recents);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRecents = useMemo(() => {
    const entryIds = new Set(entries.map((entry) => entry.id));
    return recentEntries.filter((entry) => entryIds.has(entry.id));
  }, [entries, recentEntries]);

  const handleRecentSelect = onRecentSelect ?? onSelect;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q));
  }, [entries, search]);

  return (
    <View style={styles.wrap}>
      {visibleRecents.length > 0 && (
        <WorkoutRecentRow entries={visibleRecents} onSelect={handleRecentSelect} />
      )}
      <SearchBar P={P} value={search} onChange={setSearch} />

      {filtered.length === 0 ? (
        <Text style={[styles.empty, { color: P.textFaint }]}>No activities match your search.</Text>
      ) : (
        <View style={styles.grid}>
          {filtered.map((entry, index) => (
            <WorkoutActivityCard
              key={entry.id}
              entry={entry}
              selected={entry.id === selectedId}
              cornerIndex={index}
              onPress={() => onSelect(entry)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SearchBar({
  P,
  value,
  onChange,
}: {
  P: ReturnType<typeof usePalette>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={[styles.searchBar, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <Ionicons name="search-outline" size={16} color={P.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search activities"
        placeholderTextColor={P.textFaint}
        style={[styles.searchInput, { color: P.text }]}
        autoCorrect={false}
        autoCapitalize="words"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={10}>
          <Ionicons name="close-circle" size={16} color={P.textFaint} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  empty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 28,
  },
});
