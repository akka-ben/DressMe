import React, { useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Mail, UserRound, LockKeyhole } from "lucide-react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api/apiClient";
import { colors, fonts, radius } from "../theme/dressme";


type Props = {
  onRegistered?: (email: string) => void;
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
        { text: "Back to Login", onPress: () => onRegistered?.(email.trim().toLowerCase()) },
        { text: "Stay here" },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Network error. Check your backend URL and connection.";
      setMessage(message);
      Alert.alert("Registration failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.cream, colors.beige]} style={styles.wrap}>
      <SectionCard title="Créer un compte" subtitle="Rejoignez la communaute fashion DressMe.">
        <View style={styles.photoPicker}>
          <Camera size={28} color={colors.burgundy} />
          <Text style={styles.photoText}>Photo de profil optionnelle</Text>
        </View>
        <View style={styles.inputRow}>
          <UserRound size={18} color={colors.burgundy} />
          <TextInput onChangeText={setFirstName} placeholder="Prénom" style={styles.input} value={firstName} />
        </View>
        <View style={styles.inputRow}>
          <UserRound size={18} color={colors.burgundy} />
          <TextInput onChangeText={setLastName} placeholder="Nom" style={styles.input} value={lastName} />
        </View>
        <View style={styles.inputRow}>
          <Mail size={18} color={colors.burgundy} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={styles.input}
            value={email}
          />
        </View>
        <View style={styles.inputRow}>
          <LockKeyhole size={18} color={colors.burgundy} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Mot de passe"
            secureTextEntry
            style={styles.input}
            value={password}
          />
        </View>
        <TextInput
          editable={false}
          placeholder="Bio optionnelle"
          style={[styles.inputRow, styles.bioInput]}
          value="Passionné(e) de mode, looks et inspirations."
        />
      <PrimaryButton
        disabled={loading}
        label={loading ? "Création..." : "Créer mon compte"}
        onPress={handleRegister}
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
  photoPicker: {
    height: 94,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.rose,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoText: {
    color: colors.burgundy,
    fontWeight: "800",
    fontSize: 12,
  },
  inputRow: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: colors.cream,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  bioInput: {
    color: colors.muted,
    fontFamily: fonts.body,
  },
  note: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
});
