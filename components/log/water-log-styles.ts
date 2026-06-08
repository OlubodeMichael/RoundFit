import { StyleSheet } from "react-native";

export const waterLogStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  dateArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    minWidth: 108,
    justifyContent: "center",
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
});
