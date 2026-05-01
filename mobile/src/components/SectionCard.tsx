import React, { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, shadow } from "../theme/dressme";


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
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.text,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.body,
  },
  body: {
    gap: 8,
  },
});
