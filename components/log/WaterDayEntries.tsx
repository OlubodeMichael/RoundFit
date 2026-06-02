import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { WaterEntryRow } from "@/components/log/WaterEntryRow";
import type { WaterEntry } from "@/context/water-context";
import { usePalette } from "@/lib/log-theme";

const ML_PER_OZ = 29.5735;

interface WaterDayEntriesProps {
  entries: WaterEntry[];
  onDelete: (id: string) => void;
  layout?: "default" | "side";
  embedded?: boolean;
}

export function WaterDayEntries({
  entries,
  onDelete,
  layout = "default",
  embedded = false,
}: WaterDayEntriesProps) {
  const P = usePalette();
  const acc = P.water;
  const isEmbedded = layout === "side" && embedded;

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
      ),
    [entries],
  );

  const totalOz = useMemo(
    () => sorted.reduce((sum, e) => sum + e.amount_ml, 0) / ML_PER_OZ,
    [sorted],
  );

  if (entries.length === 0) return null;

  if (isEmbedded) {
    return (
      <View style={s.embeddedWrap}>
        <View style={s.embeddedHeader}>
          <View style={s.headerLeft}>
            <Text style={[s.embeddedTitle, { color: P.text }]}>Log</Text>
            <Text style={[s.embeddedSub, { color: P.textFaint }]}>
              {totalOz.toFixed(1)} fl oz
            </Text>
          </View>
          <View style={[s.countPill, { backgroundColor: P.waterSoft }]}>
            <Text style={[s.countPillTxt, { color: acc }]}>
              {sorted.length}
            </Text>
          </View>
        </View>

        <View
          style={[
            s.insetList,
            {
              backgroundColor: P.isDark ? P.sunken : "#F8FAFC",
              borderColor: P.hair,
            },
          ]}
        >
          {sorted.map((entry, i) => (
            <View
              key={entry.id}
              style={[
                i < sorted.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: P.hair,
                },
              ]}
            >
              <View style={s.insetRowPad}>
                <WaterEntryRow
                  entry={entry}
                  unit="oz"
                  onDelete={onDelete}
                  density="compact"
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={[s.label, { color: P.textFaint }]}>HYDRATION LOG</Text>
        <Text style={[s.count, { color: acc }]}>{entries.length}</Text>
      </View>

      <View
        style={[
          s.card,
          {
            backgroundColor: P.isDark ? "#111318" : P.card,
            borderColor: P.cardEdge,
          },
        ]}
      >
        {sorted.map((entry, i) => (
          <View
            key={entry.id}
            style={[
              i < sorted.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: P.hair,
              },
            ]}
          >
            <WaterEntryRow entry={entry} unit="oz" onDelete={onDelete} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  embeddedWrap: {
    flex: 1,
    gap: 10,
  },
  embeddedHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  embeddedTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.35,
  },
  embeddedSub: {
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  countPill: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillTxt: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  insetList: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  insetRowPad: {
    paddingHorizontal: 10,
  },

  wrap: { gap: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  count: { fontSize: 13, fontWeight: "800" },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: 4,
  },
});
