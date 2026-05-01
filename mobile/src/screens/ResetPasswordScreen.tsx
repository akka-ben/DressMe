import React, { useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { PrimaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";
import { client } from "../services";
import { ApiError } from "../services/api/apiClient";
import { colors, radius } from "../theme/dressme";


type Props = {
  token: string;
  onBackToLogin?: () => void;
  onResetSuccess?: () => void;
};


export function ResetPasswordScreen({ token, onBackToLogin, onResetSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Choose a new password for your DressMe account.");

  const handleResetPassword = async () => {
    if (!token) {
      Alert.alert("Invalid link", "Password reset token is missing.");
      return;
    }

    if (!password || !confirmPassword) {
      Alert.alert("Missing fields", "Enter and confirm your new password.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Invalid password", "Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Both passwords must match.");
      return;
    }

    try {
      setLoading(true);
      const response = await client.resetPassword(token, password);
      setMessage(response.message);
      Alert.alert("Password reset", response.message, [
        { text: "Back to Login", onPress: () => onResetSuccess?.() },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Network error. Check your backend URL and connection.";
      setMessage(message);
      Alert.alert("Reset failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.cream, colors.beige]} style={styles.wrap}>
    <SectionCard title="Nouveau mot de passe" subtitle="Sécurisez votre compte DressMe.">
      <TextInput
        autoCapitalize="none"
        onChangeText={setPassword}
        placeholder="Nouveau mot de passe"
        placeholderTextColor={colors.muted}
        secureTextEntry
        style={styles.input}
        value={password}
      />
      <TextInput
        autoCapitalize="none"
        onChangeText={setConfirmPassword}
        placeholder="Confirmer le mot de passe"
        placeholderTextColor={colors.muted}
        secureTextEntry
        style={styles.input}
        value={confirmPassword}
      />
      <PrimaryButton
        disabled={loading}
        label={loading ? "Réinitialisation..." : "Réinitialiser"}
        onPress={handleResetPassword}
      />
      <PrimaryButton label="Retour connexion" variant="secondary" onPress={() => onBackToLogin?.()} />
      {loading ? <ActivityIndicator color={colors.burgundy} /> : null}
      <Text style={styles.note}>{message}</Text>
    </SectionCard>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cream,
    color: colors.text,
  },
  note: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
});
