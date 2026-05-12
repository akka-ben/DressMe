import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Bookmark,
  CheckCircle2,
  Grid3X3,
  LogOut,
  Settings,
  Tag,
  Video,
} from "lucide-react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { Post, Profile } from "../types/contracts";

type ProfileTab = "posts" | "saved" | "videos" | "tagged";

type Props = {
  onOpenPost?: (postId: string) => void;
  onEditProfile?: () => void;
  onOpenFollowers?: (userId: string) => void;
  onOpenFollowing?: (userId: string) => void;
};

export function ProfileScreen({ onOpenPost, onEditProfile, onOpenFollowers, onOpenFollowing }: Props) {
  const { token, user, logout } = useAuth();

  const [active, setActive] = useState<ProfileTab>("posts");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedVideos, setSavedVideos] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // ── Charger le profil + posts de l'utilisateur connecté ──────────────────
  const loadProfile = useCallback(async () => {
    if (!token || !user?.id) return;
    setLoading(true);
    try {
      const [profileData, postsData] = await Promise.all([
        client.getProfile(user.id),
        client.getMyPosts(token),
      ]);
      setProfile(profileData);
      setMyPosts(postsData);
    } catch (e) {
      console.warn("Erreur chargement profil:", e);
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  // ── Charger les posts enregistrés ─────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    if (!token) return;
    setLoadingSaved(true);
    try {
      const [savedResponse, videoResponse] = await Promise.all([
        client.getSavedPosts({ token, limit: 30 }),
        client.getSavedPosts({ token, mediaType: "video", limit: 30 }),
      ]);
      setSavedPosts(savedResponse);
      setSavedVideos(videoResponse);
    } finally {
      setLoadingSaved(false);
    }
  }, [token]);

  useEffect(() => {
    void loadProfile();
    void loadSaved();
  }, [loadProfile, loadSaved]);

  // ── Données affichées selon l'onglet actif ────────────────────────────────
  const displayName =
    `${profile?.firstName ?? user?.firstName ?? ""} ${profile?.lastName ?? user?.lastName ?? ""}`.trim();
  const username = user?.email ? user.email.split("@")[0] : "moi";
  const avatar = profile?.avatarUrl ?? user?.avatarUrl;

  const gridPosts =
    active === "posts"
      ? myPosts
      : active === "saved"
        ? savedPosts
        : active === "videos"
          ? savedVideos
          : [];

  const isRealGrid = active !== "tagged";
  const isGridLoading =
    loading || (loadingSaved && (active === "saved" || active === "videos"));

  const handleLogout = useCallback(() => {
    Alert.alert("Deconnexion", "Voulez-vous vraiment vous deconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se deconnecter",
        style: "destructive",
        onPress: () => void logout(),
      },
    ]);
  }, [logout]);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.shell}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.username}>@{username}</Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Modifier les parametres du profil"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onEditProfile}
            style={styles.headerIconButton}
          >
            <Settings size={21} color={colors.burgundy} />
          </Pressable>
          <Pressable
            accessibilityLabel="Se deconnecter"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleLogout}
            style={[styles.headerIconButton, styles.logoutButton]}
          >
            <LogOut size={20} color={colors.burgundy} />
          </Pressable>
        </View>
      </View>

      {/* Carte profil */}
      <View style={styles.card}>
        <View style={styles.profileTop}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>
                {(profile?.firstName ?? user?.firstName ?? "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.stats}>
            <Stat
              label="Publications"
              value={String(profile?.postCount ?? myPosts.length)}
            />
            <Pressable onPress={() => user?.id && onOpenFollowers?.(user.id)}>
              <Stat label="Abonnés" value={formatNumber(profile?.followerCount ?? 0)} />
            </Pressable>
            <Pressable onPress={() => user?.id && onOpenFollowing?.(user.id)}>
              <Stat label="Abonnements" value={formatNumber(profile?.followingCount ?? 0)} />
            </Pressable>
          </View>
        </View>

        <View style={styles.nameLine}>
          <Text style={styles.name}>{displayName || "—"}</Text>
          <CheckCircle2 size={17} color={colors.gold} fill={colors.gold} />
        </View>

        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={[styles.bio, { color: colors.muted }]}>
            Aucune bio renseignée
          </Text>
        )}

        <PrimaryButton
          label="Modifier le profil"
          variant="secondary"
          onPress={onEditProfile ?? (() => undefined)}
        />
      </View>

      {/* Onglets */}
      <View style={styles.tabs}>
        <ProfileTabButton
          active={active === "posts"}
          label="Publications"
          Icon={Grid3X3}
          onPress={() => setActive("posts")}
        />
        <ProfileTabButton
          active={active === "saved"}
          label="Enregistrés"
          Icon={Bookmark}
          onPress={() => setActive("saved")}
        />
        <ProfileTabButton
          active={active === "videos"}
          label="Vidéos"
          Icon={Video}
          onPress={() => setActive("videos")}
        />
        <ProfileTabButton
          active={active === "tagged"}
          label="Tagués"
          Icon={Tag}
          onPress={() => setActive("tagged")}
        />
      </View>

      {/* Grille */}
      {active === "tagged" ? (
        <View style={styles.emptySaved}>
          <Text style={styles.emptyTitle}>Fonctionnalité à venir</Text>
          <Text style={styles.emptyText}>
            Les publications où vous êtes tagué apparaîtront ici.
          </Text>
        </View>
      ) : isGridLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.burgundy} />
          <Text style={styles.emptyText}>Chargement...</Text>
        </View>
      ) : isRealGrid ? (
        <View style={styles.grid}>
          {gridPosts.map((post) => (
            <Pressable
              key={post.id}
              style={styles.tileWrap}
              onPress={() => onOpenPost?.(post.id)}
            >
              {post.mediaType === "video" && isVideoUrl(post.imageUrls[0]) ? (
                <View style={styles.videoTilePlaceholder}>
                  <Video size={24} color={colors.white} />
                </View>
              ) : post.imageUrls[0] ? (
                <Image
                  source={{ uri: post.imageUrls[0] }}
                  style={styles.tileImage}
                />
              ) : (
                <View style={styles.videoTilePlaceholder} />
              )}
              {post.mediaType === "video" && (
                <Text style={styles.videoBadge}>Vidéo</Text>
              )}
            </Pressable>
          ))}

          {gridPosts.length === 0 && (
            <View style={styles.emptySaved}>
              <Text style={styles.emptyTitle}>
                {active === "posts"
                  ? "Aucune publication"
                  : active === "videos"
                    ? "Aucune vidéo enregistrée"
                    : "Aucun post enregistré"}
              </Text>
              <Text style={styles.emptyText}>
                {active === "posts"
                  ? "Vos publications apparaîtront ici."
                  : "Touchez l'icône bookmark sur une publication pour l'enregistrer."}
              </Text>
            </View>
          )}
        </View>
      ) : null}
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

function ProfileTabButton({
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
      <Icon size={18} color={active ? colors.burgundy : colors.muted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function isVideoUrl(url?: string): boolean {
  return Boolean(
    url?.toLowerCase().split("?")[0].match(/\.(mp4|mov|m4v|webm)$/)
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  shell: { gap: 13 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  logoutButton: {
    borderColor: "rgba(122, 31, 48, 0.28)",
    backgroundColor: colors.cream,
  },
  username: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
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
    backgroundColor: colors.beige,
    borderWidth: 3,
    borderColor: colors.gold,
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
  bio: { color: colors.text, lineHeight: 19 },
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
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  tabActive: { backgroundColor: colors.cream },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: colors.burgundy },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  tileWrap: {
    width: "32.9%",
    aspectRatio: 1,
    backgroundColor: colors.beige,
  },
  tileImage: { width: "100%", height: "100%" },
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
  videoTilePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBox: {
    minHeight: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptySaved: {
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
