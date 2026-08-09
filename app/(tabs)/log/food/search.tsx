import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedCard, usePalette, useScreenPadding } from '@/lib/log-theme';
import { FoodRow } from '@/components/log/FoodRow';
import { useFood, defaultPortion, macrosForGrams, type Food } from '@/hooks/use-food';
import { usePostHog } from 'posthog-react-native';

/** Long enough to skip most mid-word keystrokes without feeling laggy. */
const SEARCH_DEBOUNCE_MS = 350;
/** Single characters match most of the catalogue and waste provider quota. */
const MIN_QUERY_LENGTH = 2;

/** Maps a food to the row shape, priced at its default portion. */
function toRow(food: Food) {
  const portion = defaultPortion(food);
  return {
    id:      food.id,
    name:    food.name,
    brand:   food.brand ?? (food.verified ? 'Generic' : 'Food'),
    kcal:    macrosForGrams(food, portion.grams).calories,
    serving: portion.label,
  };
}

export default function FoodSearchScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();

  const { searchFoods, getRecentFoods } = useFood();

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [recent,  setRecent]  = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Responses can land out of order — only the newest query may render.
  const requestSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const foods = await getRecentFoods();
      if (!cancelled) setRecent(foods);
    })();
    return () => { cancelled = true; };
  }, [getRecentFoods]);

  const runSearch = useCallback(async (q: string, seq: number) => {
    const foods = await searchFoods(q);
    if (seq !== requestSeq.current) return;

    setResults(foods);
    setLoading(false);
    setSearched(true);
    posthog.capture('food_searched', { query: q, result_count: foods.length });
  }, [searchFoods, posthog]);

  useEffect(() => {
    const q = query.trim();

    if (q.length < MIN_QUERY_LENGTH) {
      requestSeq.current += 1; // invalidate any in-flight request
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }

    setLoading(true);
    const seq = ++requestSeq.current;
    const timer = setTimeout(() => { void runSearch(q, seq); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const openFood = (food: Food) =>
    router.push(`/(tabs)/log/food/${encodeURIComponent(food.id)}` as any);

  const showingResults = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      {/* ── Sticky search bar ────────────────────────── */}
      <View style={{ paddingTop: pad.paddingTop, paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={[styles.searchRow, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.searchBack}>
            <Ionicons name="chevron-back" size={20} color={P.text} />
          </Pressable>
          <Ionicons name="search" size={16} color={P.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search any food or brand"
            placeholderTextColor={P.textFaint}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, color: P.text, fontSize: 15, fontWeight: '600', paddingVertical: 0 }}
          />
          {loading ? (
            <ActivityIndicator size="small" color={P.textFaint} />
          ) : !!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={P.textFaint} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!showingResults ? (
          recent.length > 0 ? (
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <Text style={[styles.section, { color: P.textFaint }]}>RECENT</Text>
              <AnimatedCard delay={80} padding={0} style={{ marginTop: 10 }}>
                {recent.map((food, i) => (
                  <View key={food.id}>
                    {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: P.hair, marginLeft: 18 }} />}
                    <FoodRow item={toRow(food)} onPress={() => openFood(food)} />
                  </View>
                ))}
              </AnimatedCard>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <AnimatedCard delay={80}>
                <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                  <Text style={[styles.emptyTitle, { color: P.text }]}>
                    Search any food
                  </Text>
                  <Text style={[styles.emptyBody, { color: P.textFaint, textAlign: 'center' }]}>
                    Foods you log will show up here for one-tap logging next time.
                  </Text>
                </View>
              </AnimatedCard>
            </View>
          )
        ) : (
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            {results.length === 0 ? (
              // Only claim "nothing found" once a search has actually returned —
              // otherwise it flashes while the first request is still in flight.
              searched && !loading ? (
                <AnimatedCard delay={0}>
                  <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                    <Text style={[styles.emptyTitle, { color: P.text }]}>
                      Nothing found
                    </Text>
                    <Text style={[styles.emptyBody, { color: P.textFaint, textAlign: 'center' }]}>
                      Try a different spelling, or add it manually.
                    </Text>
                    <Pressable
                      onPress={() => router.push('/(tabs)/log/food/manual')}
                      style={[styles.emptyCta, { backgroundColor: P.calories }]}
                    >
                      <Text style={styles.emptyCtaText}>Add manually</Text>
                    </Pressable>
                  </View>
                </AnimatedCard>
              ) : null
            ) : (
              <AnimatedCard delay={0} padding={0}>
                {results.map((food, i) => (
                  <View key={food.id}>
                    {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: P.hair, marginLeft: 18 }} />}
                    <FoodRow item={toRow(food)} onPress={() => openFood(food)} />
                  </View>
                ))}
              </AnimatedCard>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  searchRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    paddingHorizontal:14,
    paddingVertical:  12,
    borderRadius:     16,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  searchBack: {
    marginRight:    -4,
    width:          24, height: 24,
    alignItems:     'center',
    justifyContent: 'center',
  },

  section: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.5,
  },

  emptyTitle: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize:      12,
    fontWeight:    '500',
    lineHeight:    17,
  },
  emptyCta: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal:14,
    paddingVertical:  9,
    borderRadius:     12,
    marginTop:        6,
  },
  emptyCtaText: {
    color:          '#fff',
    fontSize:       12,
    fontWeight:     '800',
    letterSpacing:  0.1,
  },
});
