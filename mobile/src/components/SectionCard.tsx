import React, { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";


type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;


export function SectionCard({ title, subtitle, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#eadfd5",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1a17",
  },
  subtitle: {
    fontSize: 13,
    color: "#6d635c",
  },
  body: {
    gap: 8,
  },
});
