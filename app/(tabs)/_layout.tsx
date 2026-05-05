import Feather from "@expo/vector-icons/Feather";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Tabs, useSegments } from "expo-router";
import { useState } from "react";
import {
    Dimensions,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckinModal } from "@/components/checkin/CheckinModal";
import { useCheckin } from "@/hooks/use-checkin";
import { useTheme } from "@/hooks/use-theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

const SW = Dimensions.get("window").width;

const PILL_H    = 64;
const PILL_W    = SW - 48;
const FAB_D     = 46;
const FLOAT_BOT = 16;

const TABS: { name: string; icon: FeatherName; fab?: true }[] = [
    { name: "index",    icon: "home"     },
    { name: "insights", icon: "zap"      },
    { name: "log",      icon: "plus", fab: true },
    { name: "progress", icon: "activity" },
    { name: "profile",  icon: "user"     },
];

const PROFILE_SUB_SCREENS = [
    "cycle", "wearable", "notifications", "subscription", "paywall",
];

// ── Floating Tab Bar ──────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
    const { isDark } = useTheme();
    const insets     = useSafeAreaInsets();
    const segments   = useSegments();

    const isProfileSubScreen =
        segments[1] === "profile" &&
        PROFILE_SUB_SCREENS.includes(segments[2] as string);

    if (isProfileSubScreen) return null;

    const ACTIVE   = "#F97316";
    const INACTIVE = isDark ? "#5A5A66" : "#8A8A96";
    const PILL_BG  = isDark ? "#18181E" : "#131318";
    const FAB_BG   = isDark ? "#252530" : "#252530";

    // Outer height determines the inset React Navigation adds to screens
    const outerH = insets.bottom + FLOAT_BOT + PILL_H + 12;

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

    return (
        <View style={[s.outer, { height: outerH }]} pointerEvents="box-none">
            <View
                style={[
                    s.pill,
                    {
                        bottom:          insets.bottom + FLOAT_BOT,
                        backgroundColor: PILL_BG,
                    },
                ]}
            >
                {state.routes.map((route, i) => {
                    const cfg     = TABS.find((t) => t.name === route.name);
                    const focused = state.index === i;
                    if (!cfg) return null;

                    if (cfg.fab) {
                        return (
                            <TouchableOpacity
                                key={route.key}
                                style={s.fabSlot}
                                onPress={() => go(route.key, route.name, focused)}
                                activeOpacity={0.8}
                            >
                                <View
                                    style={[
                                        s.fab,
                                        {
                                            backgroundColor: focused ? ACTIVE : FAB_BG,
                                            shadowColor:     focused ? ACTIVE : "#000",
                                        },
                                    ]}
                                >
                                    <Feather
                                        name="plus"
                                        size={26.5}
                                        color={focused ? "#fff" : INACTIVE}
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    }

                    const color = focused ? ACTIVE : INACTIVE;
                    return (
                        <TouchableOpacity
                            key={route.key}
                            style={s.tabBtn}
                            onPress={() => go(route.key, route.name, focused)}
                            activeOpacity={0.65}
                        >
                            <Feather name={cfg.icon} size={22.5} color={color} />
                            {focused && (
                                <View style={[s.activeDot, { backgroundColor: ACTIVE }]} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

// ── Checkin Gate ──────────────────────────────────────────────────────────────
function CheckinGate() {
    const { shouldShowCheckin, isLoading } = useCheckin();
    const [dismissed, setDismissed]        = useState(false);
    const visible = !isLoading && shouldShowCheckin && !dismissed;
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
        left:          (SW - PILL_W) / 2,
        width:         PILL_W,
        height:        PILL_H,
        borderRadius:  PILL_H / 2,
        flexDirection: "row",
        alignItems:    "center",
        paddingHorizontal: 8,

        // Shadow
        shadowColor:   "#000",
        shadowOffset:  { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius:  24,
        elevation:     24,
    },

    tabBtn: {
        flex:            1,
        alignItems:      "center",
        justifyContent:  "center",
        height:          PILL_H,
        gap:             4,
    },

    activeDot: {
        width:        3,
        height:       3,
        borderRadius: 2,
    },

    fabSlot: {
        flex:           1,
        alignItems:     "center",
        justifyContent: "center",
        height:         PILL_H,
    },

    fab: {
        width:          FAB_D,
        height:         FAB_D,
        borderRadius:   FAB_D / 2,
        alignItems:     "center",
        justifyContent: "center",
        shadowOffset:   { width: 0, height: 4 },
        shadowOpacity:  0.4,
        shadowRadius:   10,
        elevation:      8,
    },
});
