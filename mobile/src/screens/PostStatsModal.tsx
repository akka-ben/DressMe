import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart2, Bookmark, Heart, MessageCircle, Share2, X } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, radius, shadow } from "../theme/dressme";
import type { PostStats } from "../types/contracts";

type Props = {
  postId: string | null;
  onClose: () => void;
};

export function PostStatsModal({ postId, onClose }: Props) {
  const { token } = useAuth();
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId || !token) return;
    setLoading(true);
    client.getPostStats(postId, token)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [postId, token]);

  return (
    <Modal visible={!!postId} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <BarChart2 size={18} color={colors.burgundy} />
          <Text style={styles.title}>Statistiques</Text>
          <Pressable onPress={onClose}>
            <X size={20} color={colors.muted} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.burgundy} style={{ marginVertical: 30 }} />
        ) : stats ? (
          <View style={styles.statsGrid}>
            <StatCard icon={<Heart size={20} color="#e11d48" />} label="J'aime" value={stats.likeCount} />
            <StatCard icon={<MessageCircle size={20} color={colors.burgundy} />} label="Commentaires" value={stats.commentCount} />
            <StatCard icon={<Share2 size={20} color={colors.gold} />} label="Partages" value={stats.shareCount} />
            <StatCard icon={<Bookmark size={20} color={colors.burgundy} />} label="Enregistrements" value={stats.saveCount} />
          </View>
        ) : (
          <Text style={styles.errorText}>Impossible de charger les statistiques.</Text>
        )}
      </View>
    </Modal>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    gap: 20,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 20,
  },
  statCard: {
    width: "47%",
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "700",
  },
  errorText: {
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 20,
  },
});