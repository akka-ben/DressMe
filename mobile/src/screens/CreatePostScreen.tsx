import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";


export function CreatePostScreen() {
  const [message, setMessage] = useState("Next integration step: upload service, hashtags, garment tags, and poll creation.");

  return (
    <SectionCard title="Create Post" subtitle="Mock-first composer for outfit publishing.">
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Image picker placeholder</Text>
      </View>
      <TextInput style={styles.input} value="Need feedback for tonight's outfit." editable={false} />
      <PrimaryButton
        label="Publish Outfit (Mock)"
        onPress={() => setMessage("Mock post published to the feed. In Sprint 2 this button will call the real upload/post APIs.")}
      />
      <Text style={styles.note}>{message}</Text>
    </SectionCard>
  );
}


const styles = StyleSheet.create({
  placeholder: {
    height: 140,
    borderRadius: 16,
    backgroundColor: "#efe4d8",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#8f4d32",
    fontWeight: "700",
  },
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
  },
});
