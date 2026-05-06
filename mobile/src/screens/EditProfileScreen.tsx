import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Camera, CheckCircle2 } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";

type Props = {
  onBack?: () => void;
  onSaved?: () => void;
};

export function EditProfileScreen({ onBack, onSaved }: Props) {
  const { user, token, updateUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName]   = useState(user?.lastName ?? "");
  const [bio, setBio]             = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [saving, setSaving]       = useState(false);

  const hasChanges =
    firstName !== (user?.firstName ?? "") ||
    lastName  !== (user?.lastName ?? "")  ||
    bio       !== (user?.bio ?? "")       ||
    avatarUrl !== (user?.avatarUrl ?? "");

const pickImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission refusée", "Autorisez l'accès à la galerie dans les paramètres.");
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return;

  if (!token) return;

  const asset = result.assets[0];
  const fileName = asset.uri.split("/").pop() ?? "avatar.jpg";
  const fileType = asset.mimeType ?? "image/jpeg";

  try {
    const uploaded = await client.uploadMedia(
      { uri: asset.uri, name: fileName, type: fileType },
      token
    );
    setAvatarUrl(uploaded.url);
  } catch (e) {
    Alert.alert("Erreur", "Impossible d'uploader la photo.");
  }
};

  const handleSave = async () => {
    if (!token || !user?.id) return;
    if (!firstName.trim()) {
      Alert.alert("Erreur", "Le prénom est obligatoire.");
      return;
    }

    setSaving(true);
    try {
      const updated = await client.updateProfile(
        user.id,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          bio: bio.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
        },
        token
      );
      updateUser(updated);
      Alert.alert("Succès", "Profil mis à jour !", [
        { text: "OK", onPress: onSaved ?? onBack },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.burgundy} />
        </Pressable>
        <Text style={styles.title}>Modifier le profil</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>
              {(firstName || user?.firstName || "?")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Pressable style={styles.cameraBtn} onPress={() => void pickImage()}>
            <Camera size={16} color={colors.white} />
        </Pressable>
      </View>

      {/* Champs */}
      <View style={styles.card}>
        <Field
          label="Prénom"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Votre prénom"
        />
        <Separator />
        <Field
          label="Nom"
          value={lastName}
          onChangeText={setLastName}
          placeholder="Votre nom"
        />
        <Separator />
        <Field
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Parlez de votre style..."
          multiline
          maxLength={200}
        />
        <Separator />
        <Field
          label="Photo (URL)"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="https://..."
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      {/* Info email */}
      <View style={styles.infoRow}>
        <CheckCircle2 size={14} color={colors.muted} />
        <Text style={styles.infoText}>
          Email : {user?.email ?? "—"} (non modifiable)
        </Text>
      </View>

      {/* Bouton sauvegarder */}
      <Pressable
        style={[
          styles.saveBtn,
          (!hasChanges || saving) && styles.saveBtnDisabled,
        ]}
        onPress={handleSave}
        disabled={!hasChanges || saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.saveBtnText}>Sauvegarder</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ── Sous-composants ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "url" | "email-address";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? "sentences"}
        keyboardType={keyboardType ?? "default"}
        returnKeyType={multiline ? "default" : "next"}
      />
      {maxLength && (
        <Text style={styles.charCount}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
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
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  avatarSection: {
    alignItems: "center",
    position: "relative",
    marginVertical: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: colors.beige,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.burgundy,
  },
  avatarInitials: {
    color: colors.white,
    fontSize: 36,
    fontWeight: "900",
  },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: "33%",
    backgroundColor: colors.burgundy,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    ...shadow.card,
  },
  field: {
    paddingVertical: 12,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 2,
  },
  fieldInputMulti: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "right",
  },
  separator: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: colors.muted,
  },
  saveBtn: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16,
  },
});