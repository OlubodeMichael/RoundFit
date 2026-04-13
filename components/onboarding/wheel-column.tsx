import { useRef, useEffect, useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const ITEM_H      = 54;
const VISIBLE     = 7;
const FADE_LAYERS = 20;

type Props = {
  labels:        readonly string[];
  selectedIndex: number;
  onChange:      (index: number) => void;
  isDark:        boolean;
};

export function WheelColumn({ labels, selectedIndex, onChange, isDark }: Props) {
  const listRef  = useRef<FlatList<string>>(null);
  const lastIdx  = useRef(selectedIndex);
  const liveRef  = useRef(selectedIndex);
  const [h, setH]       = useState(0);
  const [live, setLive] = useState(selectedIndex);

  // ── Scroll helpers ────────────────────────────────────────────────────────
  const scrollTo = useCallback((idx: number, animated: boolean) => {
    const i = Math.max(0, Math.min(labels.length - 1, idx));
    listRef.current?.scrollToOffset({ offset: i * ITEM_H, animated });
  }, [labels.length]);

  useEffect(() => {
    const i = Math.max(0, Math.min(labels.length - 1, selectedIndex));
    liveRef.current = i;
    setLive(i);
    const frame = requestAnimationFrame(() => scrollTo(i, false));
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex, labels.length, scrollTo]);

  // ── Scroll handlers ───────────────────────────────────────────────────────
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(
      labels.length - 1,
      Math.round(e.nativeEvent.contentOffset.y / ITEM_H),
    ));
    liveRef.current = idx;
    setLive(idx);
  }, [labels.length]);

  const commit = useCallback((y: number) => {
    const idx = Math.max(0, Math.min(labels.length - 1, Math.round(y / ITEM_H)));
    liveRef.current = idx;
    setLive(idx);
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      onChange(idx);
      if (Platform.OS === 'ios') Haptics.selectionAsync();
    }
    scrollTo(idx, true);
  }, [labels.length, onChange, scrollTo]);

  const onSettle = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commit(e.nativeEvent.contentOffset.y);
  }, [commit]);

  // ── Geometry ──────────────────────────────────────────────────────────────
  const padV      = h > 0 ? (h - ITEM_H) / 2 : Math.floor(VISIBLE / 2) * ITEM_H;
  const centerTop = h > 0 ? (h - ITEM_H) / 2 : 0;
  const fadeH     = centerTop;

  const surf = isDark ? '#0F0F0F' : '#FAFAF8';

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: string; index: number }) => {
    const dist       = Math.abs(index - liveRef.current);
    const isSelected = dist === 0;

    const opacity =
      isSelected ? 1 :
      dist === 1  ? 0.38 :
      dist === 2  ? 0.16 :
                    0.06;

    const fontSize =
      isSelected ? 22 :
      dist === 1  ? 17 :
      dist === 2  ? 14.5 :
                    13.5;

    const fontWeight: '700' | '500' | '400' =
      isSelected ? '700' :
      dist === 1  ? '400' :
                    '400';

    const color = isSelected
      ? '#F97316'
      : isDark ? '#BBBBBB' : '#444444';

    return (
      <View style={[s.cell, { height: ITEM_H }]}>
        <Text
          numberOfLines={1}
          style={{
            fontSize,
            fontWeight,
            opacity,
            color,
            letterSpacing: isSelected ? -0.3 : 0.1,
            fontVariant: ['tabular-nums'],
          }}
        >
          {item}
        </Text>
      </View>
    );
  }, [isDark]);

  if (!labels.length) return <View style={s.wrap} />;

  return (
    <View
      style={s.wrap}
      onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)}
    >
      {h > 0 && (
        <>
          {/* ── Wide selection pill ─────────────────────────────────────── */}
          <View
            pointerEvents="none"
            style={[
              s.pill,
              {
                top: centerTop,
                backgroundColor: isDark
                  ? 'rgba(249,115,22,0.08)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
          />

          {/* ── Scrollable list ─────────────────────────────────────────── */}
          <FlatList
            ref={listRef}
            data={[...labels]}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            extraData={live}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate="fast"
            getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
            contentContainerStyle={{ paddingVertical: padV }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onSettle}
            onScrollEndDrag={onSettle}
          />

          {/* ── Top gradient fade ────────────────────────────────────────── */}
          {fadeH > 0 && Array.from({ length: FADE_LAYERS }, (_, i) => (
            <View
              key={`t${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0, right: 0,
                top: (i / FADE_LAYERS) * fadeH,
                height: fadeH / FADE_LAYERS + 1,
                backgroundColor: surf,
                opacity: (FADE_LAYERS - 1 - i) / (FADE_LAYERS - 1),
                zIndex: 4,
              }}
            />
          ))}

          {/* ── Bottom gradient fade ─────────────────────────────────────── */}
          {fadeH > 0 && Array.from({ length: FADE_LAYERS }, (_, i) => (
            <View
              key={`b${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0, right: 0,
                bottom: (i / FADE_LAYERS) * fadeH,
                height: fadeH / FADE_LAYERS + 1,
                backgroundColor: surf,
                opacity: (FADE_LAYERS - 1 - i) / (FADE_LAYERS - 1),
                zIndex: 4,
              }}
            />
          ))}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, minHeight: ITEM_H * VISIBLE },

  // Wide, borderless pill — full column width with minimal inset
  pill: {
    position: 'absolute',
    left: 2, right: 2,
    height: ITEM_H,
    borderRadius: 14,
    zIndex: 1,
  },

  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
});
