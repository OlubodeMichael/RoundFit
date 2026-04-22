import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

const TICK_COUNT = 36;
const TICK_WIDTH = 2;
const TICK_HEIGHT = 7;
const TICK_FILLED_WIDTH = 4;
const TICK_FILLED_HEIGHT = 9;
const TICK_RADIUS = 2;
const LEADING_TICK_WIDTH = 5;
const LEADING_TICK_HEIGHT = 11;
const LEADING_HALO_SIZE = 14;
const LEADING_HALO_OFFSET = -2;
const TICK_TOP_INSET = 3;

type SegmentedDialProps = {
  size: number;
  progress: number;
  trackColor: string;
  fillColor: string;
  haloColor: string;
  tickCount?: number;
  children?: ReactNode;
};

export function SegmentedDial({
  size,
  progress,
  trackColor,
  fillColor,
  haloColor,
  tickCount = TICK_COUNT,
  children,
}: SegmentedDialProps) {
  const tickAngleStep = 360 / tickCount;
  const pct = Math.min(Math.max(progress, 0), 1);
  const fractional = pct * tickCount;
  const filledCount = Math.floor(fractional);
  const isComplete = pct >= 1;
  const leadingIdx = pct > 0 && !isComplete ? filledCount : -1;

  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: tickCount }).map((_, index) => {
        const isFilled = index < filledCount || isComplete;
        const isLeading = index === leadingIdx;
        const tickColor = isFilled || isLeading ? fillColor : trackColor;
        const width = isLeading ? LEADING_TICK_WIDTH : isFilled ? TICK_FILLED_WIDTH : TICK_WIDTH;
        const height = isLeading ? LEADING_TICK_HEIGHT : isFilled ? TICK_FILLED_HEIGHT : TICK_HEIGHT;

        return (
          <View
            key={index}
            pointerEvents="none"
            style={{
              position: "absolute",
              width: size,
              height: size,
              alignItems: "center",
              transform: [{ rotate: `${index * tickAngleStep}deg` }],
            }}
          >
            {isLeading && (
              <View
                style={{
                  position: "absolute",
                  top: LEADING_HALO_OFFSET,
                  width: LEADING_HALO_SIZE,
                  height: LEADING_HALO_SIZE,
                  borderRadius: LEADING_HALO_SIZE / 2,
                  backgroundColor: haloColor,
                }}
              />
            )}
            <View
              style={{
                position: "absolute",
                top: TICK_TOP_INSET,
                width,
                height,
                borderRadius: TICK_RADIUS,
                backgroundColor: tickColor,
                opacity: 1,
              }}
            />
          </View>
        );
      })}

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
