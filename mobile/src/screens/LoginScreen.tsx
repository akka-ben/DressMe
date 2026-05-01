import React, { useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ApiError } from "../services/api/apiClient";
import { useAuth } from "../context/AuthContext";

type Props = {
  onLoginSuccess?: () => void;
  onOpenRegister?: () => void;
  onOpenForgotPassword?: () => void;
};


export function LoginScreen({ onLoginSuccess, onOpenRegister, onOpenForgotPassword }: Props) {
  const { login, user } = useAuth();
  const [email, setEmail] = useState("demo@dressme.app");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sign in with your DressMe account.");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      setMessage("Login successful.");
      onLoginSuccess?.();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Network error. Check your backend URL and connection.";
      Alert.alert("Login failed", message);
      setMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        value={email}
      />
      <TextInput
        autoCapitalize="none"
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
      />
      <PrimaryButton
        disabled={loading}
        label={loading ? "Signing In..." : "Sign In"}
        onPress={handleLogin}
      />
      <View style={styles.actions}>
        <PrimaryButton label="Register" onPress={() => onOpenRegister?.()} />
        <PrimaryButton label="Forgot Password" onPress={() => onOpenForgotPassword?.()} />
      </View>
      {loading ? (
        <ActivityIndicator color="#8f4d32" />
      ) : (
        <>
          <Text style={styles.meta}>
            {user ? `Connected as ${user.firstName} ${user.lastName}` : "Not connected"}
          </Text>
          <Text style={styles.meta}>{message}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffaf5",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e8d8ca",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1a17",
  },
  input: {
    borderWidth: 1,
    borderColor: "#dcc8b8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  meta: {
    color: "#5f554d",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
});
