import { Platform } from "react-native";

export const colors = {
  burgundy: "#6B1F2E",
  burgundyDark: "#4A1520",
  rose: "#A8475A",
  roseLight: "#C97B8C",
  cream: "#FAF7F2",
  beige: "#F0EBE3",
  white: "#FFFFFF",
  text: "#1A1A1A",
  muted: "#6B6560",
  border: "#E8E2D8",
  gold: "#C9A961",
  black: "#050505",
  danger: "#C03232",
};

export const fonts = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  }),
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "system-ui",
  }),
};

export const shadow = {
  card: {
    shadowColor: "rgba(107, 31, 46, 0.22)",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  button: {
    shadowColor: colors.burgundy,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  frame: 48,
};
