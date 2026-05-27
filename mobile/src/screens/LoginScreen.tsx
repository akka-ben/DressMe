import React, { useState } from "react";
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ApiError } from "../services/api/apiClient";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, radius, shadow } from "../theme/dressme";

type Props = {
  initialEmail?: string;
  onLoginSuccess?: () => void;
  onOpenRegister?: () => void;
  onOpenForgotPassword?: () => void;
};

export function LoginScreen({
  initialEmail = "",
  onLoginSuccess,
  onOpenRegister,
  onOpenForgotPassword,
}: Props) {
  const { login, user } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Connectez-vous avec votre compte DressMe.");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Champs manquants", "Entrez votre email et votre mot de passe.");
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      setMessage("Connexion reussie.");
      onLoginSuccess?.();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Erreur reseau. Verifiez l'URL du backend et la connexion.";
      Alert.alert("Connexion echouee", message);
      setMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.cream, colors.beige]} style={styles.wrap}>
      <View style={styles.brandBlock}>
        <Text style={styles.logo}>DressMe</Text>
        <Text style={styles.slogan}>Votre assistant mode personnel</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.toggle}>
          <Pressable
            accessibilityRole="button"
            hitSlop={4}
            style={[styles.toggleItem, styles.toggleActive]}
          >
            <Text style={[styles.toggleText, styles.toggleActiveText]}>Connexion</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={4}
            onPress={() => onOpenRegister?.()}
            style={styles.toggleItem}
          >
            <Text style={styles.toggleText}>Inscription</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Bon retour</Text>
        <Text style={styles.subtitle}>Connectez-vous pour retrouver votre feed fashion.</Text>

        {/* Email */}
        <View style={styles.inputRow}>
          <Mail size={18} color={colors.burgundy} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
          />
        </View>

        {/* Mot de passe avec icone voir/masquer */}
        <View style={styles.inputRow}>
          <LockKeyhole size={18} color={colors.burgundy} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPassword}
            style={styles.input}
            value={password}
          />
          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Voir le mot de passe"}
          >
            {showPassword
              ? <EyeOff size={18} color={colors.muted} />
              : <Eye size={18} color={colors.muted} />
            }
          </Pressable>
        </View>

        <PrimaryButton
          disabled={loading}
          label={loading ? "Connexion..." : "Se connecter"}
          onPress={handleLogin}
        />
        <View style={styles.actions}>
          <PrimaryButton label="Créer un compte" variant="secondary" onPress={() => onOpenRegister?.()} />
          <PrimaryButton label="Mot de passe oublié" variant="ghost" onPress={() => onOpenForgotPassword?.()} />
        </View>
        {loading ? (
          <ActivityIndicator color={colors.burgundy} />
        ) : (
          <>
            <Text style={styles.meta}>
              {user ? `Connecte en tant que ${user.firstName} ${user.lastName}` : "Non connecte"}
            </Text>
            <Text style={styles.meta}>{message}</Text>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  brandBlock: {
    alignItems: "center",
    paddingVertical: 12,
  },
  logo: {
    fontFamily: fonts.display,
    color: colors.burgundy,
    fontSize: 48,
    fontWeight: "700",
  },
  slogan: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.beige,
    borderRadius: radius.md,
    padding: 4,
  },
  toggleItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  toggleActive: {
    backgroundColor: colors.burgundy,
  },
  toggleText: {
    color: colors.muted,
    fontWeight: "800",
  },
  toggleActiveText: {
    color: colors.white,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  inputRow: {
    minHeight: 52,
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
    paddingVertical: 10,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
});