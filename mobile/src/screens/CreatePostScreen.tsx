import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, HelpCircle, Shirt, Tags, X } from "lucide-react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { colors, fonts, radius, shadow } from "../theme/dressme";

const defaultImage = "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900";

export function CreatePostScreen() {
  const [imageUrl, setImageUrl] = useState(defaultImage);
  const [caption, setCaption] = useState("Tenue du soir: blazer creme, satin noir et accessoire dore.");
  const [hashtags, setHashtags] = useState("#soirée #chic #burgundy");
  const [message, setMessage] = useState("Votre publication sera ajoutee en tete du feed demo.");

  const parsedTags = hashtags
    .split(" ")
    .filter((tag) => tag.startsWith("#"))
    .slice(0, 5);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <X size={22} color={colors.muted} />
        <Text style={styles.title}>Nouvelle publication</Text>
        <Text style={styles.publish}>Publier</Text>
      </View>

      <View style={styles.upload}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.preview} /> : null}
        <View style={styles.uploadOverlay}>
          <Camera size={34} color={colors.white} />
          <Text style={styles.uploadText}>Ajouter une photo</Text>
        </View>
      </View>

      <TextInput
        value={imageUrl}
        onChangeText={setImageUrl}
        placeholder="URL image"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Décrivez votre tenue..."
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.textArea]}
        multiline
      />
      <TextInput
        value={hashtags}
        onChangeText={setHashtags}
        placeholder="Ajouter des hashtags"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />

      <View style={styles.tagRow}>
        {parsedTags.map((tag) => (
          <Text key={tag} style={styles.tagPill}>{tag}</Text>
        ))}
      </View>

      <View style={styles.optionGrid}>
        <Pressable style={styles.optionCard}>
          <Shirt size={22} color={colors.burgundy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Tags vêtements</Text>
            <Text style={styles.optionText}>Type, couleur, style</Text>
          </View>
        </Pressable>
        <Pressable style={styles.optionCard}>
          <HelpCircle size={22} color={colors.burgundy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Help Me Choose</Text>
            <Text style={styles.optionText}>Créer un sondage</Text>
          </View>
        </Pressable>
        <Pressable style={styles.optionCard}>
          <Tags size={22} color={colors.burgundy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Hashtags mode</Text>
            <Text style={styles.optionText}>Parsing automatique</Text>
          </View>
        </Pressable>
      </View>

      <PrimaryButton
        label="Publier la tenue"
        onPress={() => setMessage("Publication creee. Elle apparaitra en tete du feed dans la prochaine integration.")}
      />
      <Text style={styles.note}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  publish: {
    color: colors.burgundy,
    fontWeight: "800",
  },
  upload: {
    height: 250,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.rose,
    backgroundColor: colors.beige,
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  uploadOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,21,32,0.24)",
    gap: 8,
  },
  uploadText: {
    color: colors.white,
    fontWeight: "900",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    color: colors.text,
  },
  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    color: colors.burgundy,
    backgroundColor: colors.beige,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "800",
    fontSize: 12,
  },
  optionGrid: {
    gap: 9,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  optionTitle: {
    color: colors.text,
    fontWeight: "800",
  },
  optionText: {
    color: colors.muted,
    fontSize: 12,
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
