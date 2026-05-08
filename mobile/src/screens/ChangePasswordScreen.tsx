import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";

type Props = {
  onBack?: () => void;
};

export function ChangePasswordScreen({ onBack }: Props) {
  const { token } = useAuth();

  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!current || !next || !confirm) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires.");
      return;
    }
    if (next.length < 8) {
      Alert.alert("Erreur", "Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (next !== confirm) {
      Alert.alert("Erreur", "Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (!token) return;

    setSaving(true);
    try {
      await client.changePassword(current, next, token);
      Alert.alert("Succès", "Mot de passe modifié avec succès !", [
        { text: "OK", onPress: onBack },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={colors.burgundy} />
        </Pressable>
        <Text style={styles.headerTitle}>Changer le mot de passe</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Formulaire */}
      <View style={styles.card}>
        <PasswordField
          label="Mot de passe actuel"
          value={current}
          onChangeText={setCurrent}
          show={showCurrent}
          onToggle={() => setShowCurrent((v) => !v)}
        />
        <View style={styles.separator} />
        <PasswordField
          label="Nouveau mot de passe"
          value={next}
          onChangeText={setNext}
          show={showNext}
          onToggle={() => setShowNext((v) => !v)}
        />
        <View style={styles.separator} />
        <PasswordField
          label="Confirmer le nouveau mot de passe"
          value={confirm}
          onChangeText={setConfirm}
          show={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
        />
      </View>

      {/* Règle */}
      <View style={styles.infoRow}>
        <Lock size={13} color={colors.muted} />
        <Text style={styles.infoText}>Minimum 8 caractères</Text>
      </View>

      {/* Bouton */}
      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.saveBtnText}>Sauvegarder</Text>
        )}
      </Pressable>
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          placeholderTextColor={colors.muted}
          placeholder="••••••••"
        />
        <Pressable onPress={onToggle}>
          {show ? (
            <EyeOff size={18} color={colors.muted} />
          ) : (
            <Eye size={18} color={colors.muted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 13 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    ...shadow.card,
  },
  field: { paddingVertical: 12, gap: 4 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 2,
  },
  separator: { height: 0.5, backgroundColor: colors.border },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: { fontSize: 12, color: colors.muted },
  saveBtn: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16,
  },
});