import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowLeft,
  CheckCircle2,
  Grid3X3,
  MessageCircle,
  UserCheck,
  UserPlus,
  Video,
} from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { Post, Profile } from "../types/contracts";

type Props = {
  userId: string;
  onBack?: () => void;
  onOpenPost?: (postId: string) => void;
  onMessage?: (userId: string) => void;
};

type Tab = "posts" | "videos";

export function UserProfileScreen({
  userId,
  onBack,
  onOpenPost,
  onMessage,
}: Props) {
  const { token, user: me } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  // ── Charger le profil + posts ────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileData, postsData] = await Promise.all([
        client.getProfile(userId),
        client.getUserPosts(userId, token ?? undefined),
      ]);
      setProfile(profileData);
      setPosts(postsData);
    } catch (e) {
      console.warn("Erreur chargement profil utilisateur:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Follow / Unfollow ────────────────────────────────────────────────────
  const toggleFollow = async () => {
    if (!token) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await client.unfollowUser(userId, token);
        setIsFollowing(false);
        setProfile((prev) =>
          prev
            ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) }
            : prev
        );
      } else {
        await client.followUser(userId, token);
        setIsFollowing(true);
        setProfile((prev) =>
          prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev
        );
      }
    } catch (e) {
      console.warn("Erreur follow/unfollow:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Données grille ───────────────────────────────────────────────────────
  const gridPosts =
    activeTab === "videos"
      ? posts.filter((p) => p.mediaType === "video")
      : posts.filter((p) => p.mediaType === "image");

  const isOwnProfile = me?.id === userId;

  // ── Affichage ────────────────────────────────────────────────────────────
  const displayName =
    `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "—";
  const username = profile?.email
    ? profile.email.split("@")[0]
    : "utilisateur";

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={colors.burgundy} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          @{username}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.burgundy} size="large" />
          <Text style={styles.loadingText}>Chargement du profil…</Text>
        </View>
      ) : (
        <>
          {/* Carte profil */}
          <View style={styles.card}>
            <View style={styles.profileTop}>
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>
                    {(profile?.firstName || "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.stats}>
                <Stat
                  label="Publications"
                  value={String(profile?.postCount ?? posts.length)}
                />
                <Stat
                  label="Abonnés"
                  value={formatNumber(profile?.followerCount ?? 0)}
                />
                <Stat
                  label="Abonnements"
                  value={formatNumber(profile?.followingCount ?? 0)}
                />
              </View>
            </View>

            <View style={styles.nameLine}>
              <Text style={styles.name}>{displayName}</Text>
              <CheckCircle2 size={16} color={colors.gold} fill={colors.gold} />
            </View>

            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : (
              <Text style={[styles.bio, { color: colors.muted }]}>
                Aucune bio renseignée.
              </Text>
            )}

            {/* Boutons action — masqués si c'est son propre profil */}
            {!isOwnProfile && (
              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.followBtn,
                    isFollowing && styles.followBtnActive,
                  ]}
                  onPress={toggleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator
                      color={isFollowing ? colors.burgundy : colors.white}
                      size="small"
                    />
                  ) : isFollowing ? (
                    <>
                      <UserCheck size={16} color={colors.burgundy} />
                      <Text style={[styles.followBtnText, { color: colors.burgundy }]}>
                        Abonné
                      </Text>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} color={colors.white} />
                      <Text style={styles.followBtnText}>S'abonner</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.msgBtn}
                  onPress={() => onMessage?.(userId)}
                >
                  <MessageCircle size={16} color={colors.burgundy} />
                  <Text style={styles.msgBtnText}>Message</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Onglets */}
          <View style={styles.tabs}>
            <TabButton
              active={activeTab === "posts"}
              label="Publications"
              Icon={Grid3X3}
              onPress={() => setActiveTab("posts")}
            />
            <TabButton
              active={activeTab === "videos"}
              label="Vidéos"
              Icon={Video}
              onPress={() => setActiveTab("videos")}
            />
          </View>

          {/* Grille */}
          <View style={styles.grid}>
            {gridPosts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  {activeTab === "videos"
                    ? "Aucune vidéo publiée"
                    : "Aucune publication"}
                </Text>
                <Text style={styles.emptyText}>
                  Les publications apparaîtront ici.
                </Text>
              </View>
            ) : (
              gridPosts.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.tile}
                  onPress={() => onOpenPost?.(post.id)}
                >
                  {post.imageUrls[0] ? (
                    <Image
                      source={{ uri: post.imageUrls[0] }}
                      style={styles.tileImage}
                    />
                  ) : (
                    <View style={styles.tilePlaceholder}>
                      <Video size={20} color={colors.white} />
                    </View>
                  )}
                  {post.mediaType === "video" && (
                    <Text style={styles.videoBadge}>Vidéo</Text>
                  )}
                </Pressable>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
}

// ── Sous-composants ──────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({
  active,
  label,
  Icon,
  onPress,
}: {
  active: boolean;
  label: string;
  Icon: typeof Grid3X3;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Icon size={17} color={active ? colors.burgundy : colors.muted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },
  loadingBox: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
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
    fontSize: 32,
    fontWeight: "900",
  },
  stats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: { alignItems: "center", gap: 3 },
  statValue: { color: colors.text, fontWeight: "900", fontSize: 17 },
  statLabel: { color: colors.muted, fontSize: 10 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: colors.text, fontWeight: "900", fontSize: 16 },
  bio: { color: colors.text, lineHeight: 19, fontSize: 13 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  followBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingVertical: 10,
    ...shadow.card,
  },
  followBtnActive: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.burgundy,
  },
  followBtnText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 14,
  },
  msgBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.burgundy,
    ...shadow.card,
  },
  msgBtnText: {
    color: colors.burgundy,
    fontWeight: "900",
    fontSize: 14,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  tabActive: { backgroundColor: colors.cream },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.burgundy },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  tile: {
    width: "32.9%",
    aspectRatio: 1,
    backgroundColor: colors.beige,
  },
  tileImage: { width: "100%", height: "100%" },
  tilePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    position: "absolute",
    right: 5,
    top: 5,
    color: colors.white,
    backgroundColor: "rgba(0,0,0,0.58)",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "900",
  },
  emptyBox: {
    width: "100%",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 16,
    gap: 4,
  },
  emptyTitle: { color: colors.text, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});