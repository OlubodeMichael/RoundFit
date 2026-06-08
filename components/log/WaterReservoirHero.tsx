import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";

import { WaterJarVisual } from "@/components/log/WaterJarVisual";
import {
    JAR_DISPLAY_SCALE_COMPACT,
    JAR_DISPLAY_SCALE_DEFAULT,
} from "@/components/log/water-jar-paths";
import { reservoirStyles as s } from "@/components/log/water-reservoir-styles";
import { usePalette } from "@/lib/log-theme";
import { formatOz, formatRemainOz } from "@/utils/water-screen";

export interface WaterReservoirHeroProps {
  totalOz: number;
  goalOz: number;
  progress: number;
  pct: number;
  remainOz: number;
  sipCount: number;
  message: { head: string; body: string };
  bumpToken?: number;
  layout?: "default" | "side";
}

export function WaterReservoirHero({
  totalOz,
  goalOz,
  progress,
  pct,
  remainOz,
  sipCount,
  message,
  bumpToken = 0,
  layout = "default",
}: WaterReservoirHeroProps) {
  const P = usePalette();
  const acc = P.water;
  const isSide = layout === "side";
  const jarScale = isSide
    ? JAR_DISPLAY_SCALE_COMPACT
    : JAR_DISPLAY_SCALE_DEFAULT;

  const isComplete = progress >= 1;
  const safeTotalOz = Number.isFinite(totalOz) ? totalOz : 0;
  const safeGoalOz = Number.isFinite(goalOz) && goalOz > 0 ? goalOz : 64;
  const safeRemainOz = Number.isFinite(remainOz) ? Math.max(0, remainOz) : 0;
  const safePct = Number.isFinite(pct) ? pct : 0;
  const showRemain = !isComplete && safeRemainOz > 0;
  const hasWater = progress > 0.08;

  const a11yLabel = isComplete
    ? `Hydration goal complete. ${formatOz(safeTotalOz)} fluid ounces of ${formatOz(safeGoalOz)} ounce goal.`
    : `${safePct} percent of daily goal. ${formatOz(safeTotalOz)} fluid ounces logged, ${formatRemainOz(safeRemainOz)}.`;

  return (
    <View style={isSide ? s.wrapSide : s.wrap}>
      <View style={s.topRow}>
        {isComplete ? (
          <View
            style={[
              s.completeChip,
              {
                backgroundColor: P.isDark
                  ? "rgba(52,211,153,0.18)"
                  : "rgba(16,185,129,0.12)",
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={13} color={P.sage} />
            <Text style={[s.completeTxt, { color: P.sage }]}>GOAL REACHED</Text>
          </View>
        ) : showRemain ? (
          <View style={[s.remainChip, { backgroundColor: P.waterSoft }]}>
            <Ionicons name="water-outline" size={12} color={acc} />
            <Text style={[s.remainTxt, { color: acc }]}>
              {formatRemainOz(safeRemainOz)}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <View
          style={[
            s.pctChip,
            { backgroundColor: P.isDark ? P.sunken : P.raised },
          ]}
        >
          <Text style={[s.pctTxt, { color: P.text }]}>{safePct}%</Text>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={a11yLabel}
        style={isSide ? s.jarStageSide : s.jarStage}
      >
        <WaterJarVisual
          progress={progress}
          isComplete={isComplete}
          bumpToken={bumpToken}
          scale={jarScale}
        />

        <View style={s.statsOverlay} pointerEvents="none">
          <Text
            style={[
              isSide ? s.heroOzSide : s.heroOz,
              { color: hasWater ? "#FFFFFF" : P.text },
            ]}
          >
            {formatOz(safeTotalOz)}
          </Text>
          <Text
            style={[
              s.heroUnit,
              { color: hasWater ? "rgba(255,255,255,0.9)" : P.textDim },
            ]}
          >
            fl oz today
          </Text>
          <Text
            style={[
              s.goalHint,
              { color: hasWater ? "rgba(255,255,255,0.65)" : P.textFaint },
            ]}
          >
            {formatOz(safeGoalOz)} oz goal
          </Text>
        </View>
      </View>

      {!isSide && (
        <View style={s.messageBlock}>
          <Text style={[s.messageHead, { color: P.text }]}>{message.head}</Text>
          <Text style={[s.messageBody, { color: P.textDim }]}>
            {message.body}
          </Text>
        </View>
      )}

      {!isSide && (
        <View style={s.metaRow}>
          <View
            style={[
              s.metaChip,
              {
                backgroundColor: P.isDark ? P.sunken : P.raised,
                borderColor: P.cardEdge,
              },
            ]}
          >
            <Ionicons name="flag-outline" size={13} color={acc} />
            <Text style={[s.metaTxt, { color: P.textDim }]}>
              {formatOz(safeGoalOz)} oz goal
            </Text>
          </View>
          <View
            style={[
              s.metaChip,
              {
                backgroundColor: P.isDark ? P.sunken : P.raised,
                borderColor: P.cardEdge,
              },
            ]}
          >
            <Ionicons name="water-outline" size={13} color={acc} />
            <Text style={[s.metaTxt, { color: P.textDim }]}>
              {sipCount} {sipCount === 1 ? "sip" : "sips"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
