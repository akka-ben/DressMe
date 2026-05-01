import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";


type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};


export function PrimaryButton({ label, onPress, disabled = false }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  button: {
    backgroundColor: "#8f4d32",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.56,
  },
  label: {
    color: "#fffaf5",
    fontSize: 14,
    fontWeight: "700",
  },
});
