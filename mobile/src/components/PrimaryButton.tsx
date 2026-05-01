import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { colors, fonts, radius, shadow } from "../theme/dressme";


type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
};


export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  style,
}: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text style={[styles.label, variant !== "primary" && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  primary: {
    backgroundColor: colors.burgundy,
    ...shadow.button,
  },
  secondary: {
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.56,
  },
  label: {
    color: colors.cream,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: fonts.body,
  },
  secondaryLabel: {
    color: colors.burgundy,
  },
});
