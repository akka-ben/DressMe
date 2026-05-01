import React, { useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api/apiClient";


type Props = {
  onRegistered?: () => void;
  onBackToLogin?: () => void;
};


export function RegisterScreen({ onRegistered, onBackToLogin }: Props) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("Mohammed");
  const [lastName, setLastName] = useState("Ben Akka Ouayad");
  const [email, setEmail] = useState("mohammed@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Create your DressMe account.");

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Alert.alert("Missing fields", "Fill in all registration fields.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Invalid password", "Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      const response = await register({
        firstName,
        lastName,
        email,
        password,
      });
      setMessage(response.message);
      Alert.alert("Account created", response.message, [
        { text: "Back to Login", onPress: () => onRegistered?.() },
        { text: "Stay here" },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Network error. Check your backend URL and connection.";
      setMessage(message);
      Alert.alert("Registration failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Register" subtitle="Create an account with the DressMe backend.">
      <TextInput
        onChangeText={setFirstName}
        placeholder="First name"
        style={styles.input}
        value={firstName}
      />
      <TextInput
        onChangeText={setLastName}
        placeholder="Last name"
        style={styles.input}
        value={lastName}
      />
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
        label={loading ? "Creating..." : "Create Account"}
        onPress={handleRegister}
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
