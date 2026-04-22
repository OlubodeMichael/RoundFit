import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ── Dimensions ────────────────────────────────────────────────────────────────
const SW = Dimensions.get("window").width;
const TAB_H = 60;
const FAB_D = 58;
const FAB_R = FAB_D / 2;
const NOTCH_W = 82; // width of the gap in the border
const NOTCH_D = 34; // how far the notch dips down

const TABS: { name: string; icon: IoniconsName; label: string; fab?: true }[] =
  [
    { name: "index", icon: "home-outline", label: "Home" },
    { name: "insights", icon: "bulb-outline", label: "Insights" },
    { name: "log", icon: "add", label: "Log", fab: true },
    { name: "progress", icon: "trending-up-outline", label: "Progress" },
    { name: "profile", icon: "person-outline", label: "Profile" },
  ];

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const tabBg = isDark ? "#1C1D23" : "#FFFFFF";
  const borderClr = isDark ? "#333340" : "#EDE9E3";
  const active = "#F97316";
  const inactive = isDark ? "#707078" : "#BBBBBB";

  const tabBarH = TAB_H + insets.bottom;
  const leftW = (SW - NOTCH_W) / 2;

  const go = (key: string, name: string, focused: boolean) => {
    const event = navigation.emit({
      type: "tabPress",
      target: key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(name);
    if (process.env.EXPO_OS === "ios")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const logRoute = state.routes.find((r) => r.name === "log")!;
  const logFocused = state.routes[state.index]?.name === "log";

  return (
    // Outer wrapper — taller than the tab bar so the FAB can poke above
    <View
      style={[s.outer, { height: tabBarH + FAB_R + 12 }]}
      pointerEvents="box-none"
    >
      {/* ── TAB BAR SURFACE ───────────────────────────────────────── */}
      <View style={[s.surface, { height: tabBarH, backgroundColor: tabBg }]}>
        {/* Left border segment */}
        <View
          style={[
            s.borderLine,
            { left: 0, width: leftW, backgroundColor: borderClr },
          ]}
        />

        {/* Notch U-shape: no top border, rounded bottom, left + right sides */}
        <View
          style={[
            s.notch,
            {
              left: leftW,
              width: NOTCH_W,
              height: NOTCH_D,
              borderColor: borderClr,
              borderBottomLeftRadius: NOTCH_W / 2,
              borderBottomRightRadius: NOTCH_W / 2,
            },
          ]}
        />

        {/* Right border segment */}
        <View
          style={[
            s.borderLine,
            { right: 0, width: leftW, backgroundColor: borderClr },
          ]}
        />
      </View>

      {/* ── TAB ITEMS ─────────────────────────────────────────────── */}
      <View style={[s.row, { bottom: insets.bottom, height: TAB_H }]}>
        {state.routes.map((route, i) => {
          const cfg = TABS.find((t) => t.name === route.name);
          const focused = state.index === i;

          if (!cfg) return null;

          // Spacer slot for the FAB — actual button rendered separately
          if (cfg.fab) return <View key={route.key} style={{ flex: 1 }} />;

          const color = focused ? active : inactive;
          return (
            <TouchableOpacity
              key={route.key}
              style={s.tab}
              onPress={() => go(route.key, route.name, focused)}
              activeOpacity={0.7}
            >
              <Ionicons name={cfg.icon} size={22} color={color} />
              <Text style={[s.label, { color }]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── FAB ──────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[
          s.fab,
          {
            left: SW / 2 - FAB_R,
            bottom: tabBarH - FAB_R + 8, // center sits 8 px above tab bar top
          },
        ]}
        onPress={() => go(logRoute.key, logRoute.name, logFocused)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="insights" options={{ title: "Insights" }} />
      <Tabs.Screen name="log" options={{ title: "Log" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  surface: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Two straight border segments
  borderLine: {
    position: "absolute",
    top: 0,
    height: 1,
  },

  // The U-shaped notch — no top border, left/right/bottom borders with big bottom radius
  notch: {
    position: "absolute",
    top: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopWidth: 0,
  },

  // Tab items row
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // Floating action button
  fab: {
    position: "absolute",
    width: FAB_D,
    height: FAB_D,
    borderRadius: FAB_R,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
});
