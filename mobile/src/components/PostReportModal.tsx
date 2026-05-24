import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import {
  Ban,
  BellOff,
  Check,
  ChevronRight,
  EyeOff,
  Shield,
  UserMinus,
  X,
} from "lucide-react-native";

import { client } from "../services";
import { colors } from "../theme/dressme";

const REPORT_REASONS = [
  { key: "dont_like", label: "Je n'aime tout simplement pas" },
  { key: "bullying_contact", label: "Harcèlement ou contact indésirable" },
  { key: "self_harm_eating", label: "Suicide, automutilation ou troubles alimentaires" },
  { key: "violence_hate_exploitation", label: "Violence, haine ou exploitation" },
  { key: "restricted_items", label: "Vente ou promotion d'articles réglementés" },
  { key: "nudity_sexual_activity", label: "Nudité ou activité sexuelle" },
  { key: "scam_fraud_spam", label: "Arnaque, fraude ou spam" },
  { key: "false_information", label: "Fausses informations" },
  { key: "intellectual_property", label: "Propriété intellectuelle" },
];

type Props = {
  visible: boolean;
  postId?: string;
  authorUsername?: string;
  token?: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function PostReportModal({
  visible,
  postId,
  authorUsername,
  token,
  onClose,
  onSubmitted,
}: Props) {
  const [reportingKey, setReportingKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const username = useMemo(() => authorUsername || "ce compte", [authorUsername]);

  useEffect(() => {
    if (!visible) {
      setReportingKey(null);
      setSubmitted(false);
    }
  }, [visible]);

  const submitReport = async (reason: (typeof REPORT_REASONS)[number]) => {
    if (!postId) {
      return;
    }
    if (!token) {
      Alert.alert("Connexion requise", "Connecte-toi pour signaler cette publication.");
      return;
    }
    if (reportingKey) {
      return;
    }

    setReportingKey(reason.key);
    try {
      await client.reportPost(
        postId,
        {
          reasonKey: reason.key,
          reasonLabel: reason.label,
        },
        token,
      );
      Vibration.vibrate(10);
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      Alert.alert(
        "Signalement impossible",
        error instanceof Error ? error.message : "Le signalement n'a pas pu etre envoye.",
      );
    } finally {
      setReportingKey(null);
    }
  };

  const showPlaceholderAction = (label: string) => {
    Alert.alert(label, "Cette action sera reliee au systeme de moderation apres le MVP.");
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Signaler</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer le signalement"
            hitSlop={12}
            style={styles.closeButton}
            onPress={onClose}
          >
            <X size={31} color={colors.text} strokeWidth={2.5} />
          </Pressable>
        </View>

        {submitted ? (
          <View style={styles.successContent}>
            <View style={styles.checkCircle}>
              <Check size={42} color={colors.text} strokeWidth={3} />
            </View>
            <Text style={styles.successTitle}>Merci pour votre retour</Text>
            <Text style={styles.successText}>
              Nous utilisons ces signalements pour vous montrer moins de contenu de ce type a l'avenir.
            </Text>

            <View style={styles.nextSteps}>
              <Text style={styles.nextStepsTitle}>Autres actions possibles</Text>
              <ReportActionRow
                icon={<Ban size={28} color={colors.text} />}
                label={`Bloquer ${username}`}
                onPress={() => showPlaceholderAction(`Bloquer ${username}`)}
              />
              <ReportActionRow
                icon={<EyeOff size={28} color={colors.text} />}
                label={`Restreindre ${username}`}
                onPress={() => showPlaceholderAction(`Restreindre ${username}`)}
              />
              <ReportActionRow
                icon={<UserMinus size={28} color={colors.text} />}
                label={`Ne plus suivre ${username}`}
                onPress={() => showPlaceholderAction(`Ne plus suivre ${username}`)}
              />
              <ReportActionRow
                icon={<BellOff size={28} color={colors.text} />}
                label={`Masquer ${username}`}
                onPress={() => showPlaceholderAction(`Masquer ${username}`)}
              />
              <ReportActionRow
                icon={<Shield size={28} color={colors.text} />}
                label="En savoir plus sur les regles de la communaute"
                onPress={() => showPlaceholderAction("Regles de la communaute")}
              />
            </View>

            <View style={styles.doneBar}>
              <Pressable style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>Termine</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.reasonScroll}
            contentContainerStyle={styles.reasonContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Pourquoi signalez-vous cette publication ?</Text>
            <Text style={styles.subtitle}>
              Votre signalement sera examine par DressMe. Si quelqu'un est en danger immediat,
              contactez les services d'urgence locaux.
            </Text>

            <View style={styles.reasons}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.key}
                  disabled={Boolean(reportingKey)}
                  style={styles.reasonRow}
                  onPress={() => void submitReport(reason)}
                >
                  <Text style={styles.reasonText}>{reason.label}</Text>
                  {reportingKey === reason.key ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <ChevronRight size={27} color={colors.muted} />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function ReportActionRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.nextStepRow} onPress={onPress}>
      <View style={styles.nextStepIcon}>{icon}</View>
      <Text style={styles.nextStepLabel}>{label}</Text>
      <ChevronRight size={27} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    height: Platform.OS === "ios" ? 56 : 62,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 18,
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonScroll: {
    flex: 1,
  },
  reasonContent: {
    paddingTop: 58,
    paddingBottom: 34,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 28,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
    paddingHorizontal: 34,
    marginTop: 25,
  },
  reasons: {
    marginTop: 58,
  },
  reasonRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  reasonText: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
  },
  successContent: {
    flex: 1,
    alignItems: "center",
    paddingTop: 62,
  },
  checkCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#eef0f4",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 52,
    paddingHorizontal: 24,
  },
  successText: {
    color: "#6b7280",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
    paddingHorizontal: 28,
    marginTop: 28,
  },
  nextSteps: {
    alignSelf: "stretch",
    marginTop: 70,
    paddingHorizontal: 24,
  },
  nextStepsTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 24,
  },
  nextStepRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  nextStepIcon: {
    width: 36,
    alignItems: "center",
  },
  nextStepLabel: {
    flex: 1,
    color: "#2c2f34",
    fontSize: 20,
    lineHeight: 25,
  },
  doneBar: {
    marginTop: "auto",
    alignSelf: "stretch",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 18 : 24,
  },
  doneButton: {
    height: 58,
    borderRadius: 14,
    backgroundColor: "#4355ff",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
  },
});
