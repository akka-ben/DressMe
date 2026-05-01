import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles } from "lucide-react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { colors, fonts, radius, shadow } from "../theme/dressme";

type Props = {
  onGetStarted?: () => void;
};

export function OnboardingScreen({ onGetStarted }: Props) {
  return (
    <LinearGradient colors={[colors.cream, colors.beige]} style={styles.wrap}>
      <View style={styles.hero}>
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900" }}
          style={styles.heroImage}
        />
        <LinearGradient colors={["transparent", "rgba(74,21,32,0.78)"]} style={styles.heroOverlay}>
          <View style={styles.sparkleBadge}>
            <Sparkles size={18} color={colors.gold} />
            <Text style={styles.badgeText}>AI Stylist</Text>
          </View>
          <Text style={styles.logo}>DressMe</Text>
          <Text style={styles.title}>Votre assistant mode personnel</Text>
        </LinearGradient>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Instagram + WhatsApp + IA stylist</Text>
        <Text style={styles.text}>
          Partagez vos looks, demandez l'avis de votre communaute et recevez des suggestions
          de style personnalisees.
        </Text>
        <PrimaryButton label="Get Started" onPress={() => onGetStarted?.()} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  hero: {
    height: 380,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.black,
    ...shadow.card,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 22,
    paddingTop: 120,
  },
  sparkleBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  badgeText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 12,
  },
  logo: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 46,
    fontWeight: "700",
  },
  title: {
    color: colors.cream,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "600",
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 23,
    fontWeight: "700",
    color: colors.text,
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});
