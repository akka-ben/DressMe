import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";


type Props = {
  onGetStarted?: () => void;
};


export function OnboardingScreen({ onGetStarted }: Props) {
  return (
    <SectionCard
      title="Onboarding"
      subtitle="Product framing prepared for Sprint 1 mock validation."
    >
      <View style={styles.block}>
        <Text style={styles.heading}>Instagram + WhatsApp + AI Stylist</Text>
        <Text style={styles.text}>
          Share looks, ask your friends to vote, and get AI outfit suggestions from one app.
        </Text>
      </View>
      <PrimaryButton label="Get Started" onPress={() => onGetStarted?.()} />
    </SectionCard>
  );
}


const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f1a17",
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5f554d",
  },
});
