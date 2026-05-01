import React, { useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";
import { client } from "../services";
import { ApiError } from "../services/api/apiClient";


type Props = {
  onBackToLogin?: () => void;
};


export function ForgotPasswordScreen({ onBackToLogin }: Props) {
  const [email, setEmail] = useState("mohammed@example.com");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Enter your email to receive a reset link.");

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Missing email", "Enter your email address.");
      return;
    }

    try {
      setLoading(true);
      const response = await client.forgotPassword(email.trim().toLowerCase());
      setMessage(response.message);
      Alert.alert("Reset link", response.message);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Network error. Check your backend URL and connection.";
      setMessage(message);
      Alert.alert("Request failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Forgot Password" subtitle="Send a reset link from the DressMe backend.">
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        value={email}
      />
      <PrimaryButton
        disabled={loading}
        label={loading ? "Sending..." : "Send Reset Link"}
        onPress={handleForgotPassword}
      />
      <PrimaryButton label="Back to Login" onPress={() => onBackToLogin?.()} />
      {loading ? <ActivityIndicator color="#8f4d32" /> : null}
      <Text style={styles.note}>{message}</Text>
    </SectionCard>
  );
}


const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#dcc8b8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  note: {
    fontSize: 13,
    color: "#6d635c",
    lineHeight: 18,
  },
});
