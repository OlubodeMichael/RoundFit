import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Mock catalog — swap for real search API results.
const CATALOG = [
  { id: '1',  name: 'Grilled chicken breast', brand: 'Whole Foods',       kcal: 165, serving: '100g' },
  { id: '2',  name: 'Greek yogurt',           brand: 'Fage · 2%',         kcal: 120, serving: '170g' },
  { id: '3',  name: 'Oatmeal',                brand: "Bob's Red Mill",    kcal: 150, serving: '40g'  },
  { id: '4',  name: 'Banana',                 brand: 'Fresh',             kcal: 105, serving: '1 med'},
  { id: '5',  name: 'Almonds',                brand: 'Blue Diamond',      kcal: 160, serving: '28g'  },
  { id: '6',  name: 'Brown rice',             brand: 'Uncle Ben\'s',      kcal: 215, serving: '1 cup'},
  { id: '7',  name: 'Salmon fillet',          brand: 'Atlantic',          kcal: 208, serving: '100g' },
  { id: '8',  name: 'Avocado',                brand: 'Hass',              kcal: 160, serving: '1 med'},
  { id: '9',  name: 'Egg, large',             brand: 'Cage-free',         kcal:  78, serving: '1 egg'},
  { id: '10', name: 'Peanut butter',          brand: 'Jif · natural',     kcal: 190, serving: '2 tbsp'},
];

const RECENT = ['Chicken breast', 'Oatmeal', 'Banana', 'Greek yogurt'];
const QUICK: { id: string; label: string; icon: IoniconName; href: string; accent: 'calories' | 'protein' | 'water' }[] = [
  { id: 'photo',  label: 'Photo',   icon: 'camera',       href: '/(tabs)/log/food/photo',  accent: 'calories' },
  { id: 'manual', label: 'Manual',  icon: 'create',       href: '/(tabs)/log/food/manual', accent: 'protein'  },
  { id: 'scan',   label: 'Scan',    icon: 'barcode',      href: '/(tabs)/log/food/scan',   accent: 'water'    },
];

export default function FoodSearchScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CATALOG.filter((f) =>
      f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q),
    );
  }, [query]);

  const showingResults = query.trim().length > 0;

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
            returnKeyType="search"
            style={{ flex: 1, color: P.text, fontSize: 15, fontWeight: '600', paddingVertical: 0 }}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={P.textFaint} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!showingResults ? (
          <>
            {/* ── Quick actions ───────────────────────── */}
            <View style={{ paddingHorizontal: 20, marginTop: 8, flexDirection: 'row', gap: 10 }}>
              {QUICK.map((q, i) => (
                <AnimatedCard key={q.id} delay={60 + i * 50} padding={14} style={{ flex: 1 }}>
                  <Pressable
                    onPress={() => router.push(q.href as any)}
                    style={{ alignItems: 'center', gap: 8 }}
                  >
                    <View style={[
                      styles.quickIcon,
                      { backgroundColor: P[`${q.accent}Soft`] as string },
                    ]}>
                      <Ionicons name={q.icon} size={16} color={P[q.accent]} />
                    </View>
                    <Text style={[styles.quickLabel, { color: P.text }]}>
                      {q.label}
                    </Text>
                  </Pressable>
                </AnimatedCard>
              ))}
            </View>

            {/* ── Recent searches ─────────────────────── */}
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <Text style={[styles.section, { color: P.textFaint }]}>RECENT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {RECENT.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setQuery(r)}
                    style={({ pressed }) => [
                      styles.recentPill,
                      { backgroundColor: P.card, borderColor: P.cardEdge },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="time-outline" size={12} color={P.textFaint} />
                    <Text style={[styles.recentText, { color: P.textDim }]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── Popular ─────────────────────────────── */}
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <Text style={[styles.section, { color: P.textFaint }]}>POPULAR</Text>
              <AnimatedCard delay={200} padding={0} style={{ marginTop: 10 }}>
                {CATALOG.slice(0, 5).map((item, i) => (
                  <View key={item.id}>
                    {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: P.hair, marginLeft: 18 }} />}
                    <FoodRow
                      item={item}
                      onPress={() => router.push(`/(tabs)/log/food/${item.id}` as any)}
                    />
                  </View>
                ))}
              </AnimatedCard>
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            {results.length === 0 ? (
              <AnimatedCard delay={0}>
                <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                  <View style={[styles.emptyIcon, { backgroundColor: P.sunken }]}>
                    <Ionicons name="search" size={22} color={P.textFaint} />
                  </View>
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
                    <Ionicons name="create" size={14} color="#fff" />
                    <Text style={styles.emptyCtaText}>Add manually</Text>
                  </Pressable>
                </View>
              </AnimatedCard>
            ) : (
              <AnimatedCard delay={0} padding={0}>
                {results.map((item, i) => (
                  <View key={item.id}>
                    {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: P.hair, marginLeft: 18 }} />}
                    <FoodRow
                      item={item}
                      onPress={() => router.push(`/(tabs)/log/food/${item.id}` as any)}
                    />
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

  quickIcon: {
    width:          38, height: 38, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },

  section: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.5,
  },
  recentPill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal:12,
    paddingVertical:  7,
    borderRadius:     999,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  recentText: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.1,
  },

  emptyIcon: {
    width:          56, height: 56, borderRadius: 18,
    alignItems:     'center',
    justifyContent: 'center',
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
