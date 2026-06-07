import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Tabs, useSegments } from "expo-router";
import { useState } from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckinModal } from "@/components/checkin/CheckinModal";
import { useCheckin } from "@/hooks/use-checkin";
import { usePalette } from "@/lib/log-theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const SW = Dimensions.get("window").width;

const PILL_H    = 64;
const FAB_D     = 56;            // standalone Log button (right)
const TABBAR_GAP = 12;           // gap between the nav pill and the Log button
const PILL_W    = SW - 40 - FAB_D - TABBAR_GAP;
const FLOAT_BOT = 14;
const TAB_ICON  = 21;
const TAB_ICON_FOCUSED = 22;

/** Dark floating bar on light app screens — contrasts with #F6F6F8 page bg. */
const LIGHT_TAB_BAR_BG = "#18181B";
const LIGHT_TAB_BAR_BORDER = "rgba(255,255,255,0.10)";
const LIGHT_TAB_INACTIVE = "#9CA3AF";

const TABS: {
    name: string;
    icon: IoniconName;
    iconActive: IoniconName;
    label: string;
    fab?: true;
}[] = [
    { name: "index",    icon: "home-outline",    iconActive: "home",    label: "Home"     },
    { name: "insights", icon: "flash-outline",   iconActive: "flash",   label: "Insights" },
    { name: "log",      icon: "add-outline",     iconActive: "add",     label: "Log", fab: true },
    { name: "progress", icon: "pulse-outline",   iconActive: "pulse",   label: "Progress" },
    { name: "profile",  icon: "person-outline",  iconActive: "person",  label: "Profile"  },
];

const PROFILE_SUB_SCREENS = [
    "you", "health", "preferences", "theme", "security", "account",
    "cycle", "wearable", "notifications", "subscription", "paywall", "help",
];

/** Expo Router types `useSegments()` as a short tuple; paths can be deeper. */
function readTabSegments(segments: ReturnType<typeof useSegments>): {
    tab?: string;
    screen?: string;
} {
    const path = segments as readonly string[];
    return { tab: path[1], screen: path[2] };
}

function shouldHideTabBar(tab?: string, screen?: string): boolean {
    if (tab === "profile" && screen != null && PROFILE_SUB_SCREENS.includes(screen)) {
        return true;
    }
    if (tab === "log" && screen != null) return true;
    if (tab === "progress" && screen != null) return true;
    if (tab === "insights" && screen != null) return true;
    return false;
}

// ── Floating Tab Bar ──────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
    const P        = usePalette();
    const insets   = useSafeAreaInsets();
    const { tab, screen } = readTabSegments(useSegments());

    if (shouldHideTabBar(tab, screen)) return null;

    const activeColor = P.calories;
    const inactiveColor = P.isDark ? P.textFaint : LIGHT_TAB_INACTIVE;
    const pillBg = P.isDark ? P.card : LIGHT_TAB_BAR_BG;
    const pillBorder = P.isDark ? P.cardEdge : LIGHT_TAB_BAR_BORDER;
    const shadowOpacity = P.isDark ? 0.28 : 0.22;
    const shadowRadius  = P.isDark ? 20 : 18;

    const outerH = insets.bottom + FLOAT_BOT + PILL_H + 10;

    const go = (key: string, name: string, focused: boolean) => {
        const event = navigation.emit({
            type: "tabPress",
            target: key,
            canPreventDefault: true,
        });
        if (!event.defaultPrevented) {
            if (!focused) {
                if (name === "index") {
                    navigation.navigate(name);
                } else {
                    navigation.navigate(name, { screen: "index" });
                }
            }
        }
        if (process.env.EXPO_OS === "ios")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <View style={[s.outer, { height: outerH }]} pointerEvents="box-none">
            {/* Nav pill (left) — the four primary tabs */}
            <View
                style={[
                    s.pill,
                    {
                        bottom:          insets.bottom + FLOAT_BOT,
                        backgroundColor: pillBg,
                        borderColor:     pillBorder,
                        shadowOpacity,
                        shadowRadius,
                    },
                ]}
            >
                {state.routes.map((route, i) => {
                    const cfg     = TABS.find((t) => t.name === route.name);
                    if (!cfg || cfg.fab) return null;
                    const focused = state.index === i;

                    const color = focused ? activeColor : inactiveColor;
                    const iconName = focused ? cfg.iconActive : cfg.icon;
                    return (
                        <TouchableOpacity
                            key={route.key}
                            style={s.tabBtn}
                            onPress={() => go(route.key, route.name, focused)}
                            activeOpacity={0.65}
                        >
                            <Ionicons
                                name={iconName}
                                size={focused ? TAB_ICON_FOCUSED : TAB_ICON}
                                color={color}
                            />
                            <Text style={[s.tabLabel, { color }]}>{cfg.label}</Text>
                            {focused ? (
                                <View style={[s.activeDot, { backgroundColor: activeColor }]} />
                            ) : (
                                <View style={s.activeDotPlaceholder} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Standalone Log button (right) */}
            {state.routes.map((route, i) => {
                const cfg = TABS.find((t) => t.name === route.name);
                if (!cfg || !cfg.fab) return null;
                const focused = state.index === i;
                return (
                    <TouchableOpacity
                        key={route.key}
                        style={[s.fabWrap, { bottom: insets.bottom + FLOAT_BOT + (PILL_H - FAB_D) / 2 }]}
                        onPress={() => go(route.key, route.name, focused)}
                        activeOpacity={0.85}
                    >
                        <View
                            style={[
                                s.fab,
                                {
                                    backgroundColor: activeColor,
                                    borderColor:     activeColor,
                                    shadowColor:     activeColor,
                                    shadowOpacity:   focused ? 0.45 : 0.32,
                                    shadowRadius,
                                },
                            ]}
                        >
                            <Ionicons name={cfg.iconActive} size={26} color="#fff" />
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ── Checkin Gate ──────────────────────────────────────────────────────────────
function CheckinGate() {
    const { shouldShowCheckin, isLoading, hasCheckedInToday } = useCheckin();
    const [dismissed, setDismissed] = useState(false);
    const visible = !isLoading && shouldShowCheckin && !hasCheckedInToday && !dismissed;
    return <CheckinModal visible={visible} onClose={() => setDismissed(true)} />;
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function TabLayout() {
    return (
        <>
            <Tabs
                tabBar={(props) => <CustomTabBar {...props} />}
                screenOptions={{ headerShown: false }}
            >
                <Tabs.Screen name="index"    options={{ title: "Home"     }} />
                <Tabs.Screen name="insights" options={{ title: "Insights" }} />
                <Tabs.Screen name="log"      options={{ title: "Log"      }} />
                <Tabs.Screen name="progress" options={{ title: "Progress" }} />
                <Tabs.Screen name="profile"  options={{ title: "Profile"  }} />
            </Tabs>
            <CheckinGate />
        </>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    outer: {
        position: "absolute",
        left:     0,
        right:    0,
        bottom:   0,
    },

    pill: {
        position:      "absolute",
        left:          20,
        width:         PILL_W,
        height:        PILL_H,
        borderRadius:  22,
        flexDirection: "row",
        alignItems:    "center",
        paddingHorizontal: 6,
        borderWidth:   StyleSheet.hairlineWidth,
        shadowColor:   "#000",
        shadowOffset:  { width: 0, height: 8 },
        elevation:     12,
    },

    tabBtn: {
        flex:           1,
        alignItems:     "center",
        justifyContent: "center",
        height:         PILL_H,
        gap:            2,
        paddingTop:     2,
    },

    tabLabel: {
        fontSize:      10,
        fontWeight:    "700",
        letterSpacing: 0.2,
    },

    activeDot: {
        width:  4,
        height: 4,
        borderRadius: 2,
        marginTop: 1,
    },

    activeDotPlaceholder: {
        width:  4,
        height: 4,
        marginTop: 1,
    },

    fabWrap: {
        position:       "absolute",
        right:          20,
        width:          FAB_D,
        height:         FAB_D,
        alignItems:     "center",
        justifyContent: "center",
    },

    fab: {
        width:          FAB_D,
        height:         FAB_D,
        borderRadius:   FAB_D / 2,
        alignItems:     "center",
        justifyContent: "center",
        borderWidth:    StyleSheet.hairlineWidth,
        shadowOffset:   { width: 0, height: 4 },
        shadowRadius:   8,
        elevation:      6,
    },
});
