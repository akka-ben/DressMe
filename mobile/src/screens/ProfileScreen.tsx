import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Bookmark, CheckCircle2, Grid3X3, Settings, Tag, Video } from "lucide-react-native";

import { currentUser, posts } from "../data/fashionData";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { Post } from "../types/contracts";

type ProfileTab = "posts" | "saved" | "videos" | "tagged";

type Props = {
  onOpenPost?: (postId: string) => void;
};

export function ProfileScreen({ onOpenPost }: Props) {
  const { token, user } = useAuth();
  const [active, setActive] = useState<ProfileTab>("posts");
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedVideos, setSavedVideos] = useState<Post[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const displayName = `${user?.firstName ?? currentUser.name.split(" ")[0]} ${user?.lastName ?? ""}`.trim();
  const username = user?.email ? user.email.split("@")[0] : currentUser.username;
  const avatar = user?.avatarUrl || currentUser.avatar;

  const loadSaved = useCallback(async () => {
    if (!token) {
      return;
    }

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
    void loadSaved();
  }, [loadSaved]);

  const mockVisiblePosts = posts.slice(0, active === "tagged" ? 4 : 6);
  const realVisiblePosts = active === "videos" ? savedVideos : savedPosts;
  const useRealGrid = active === "saved" || active === "videos";

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text style={styles.username}>@{username}</Text>
        <Settings size={22} color={colors.burgundy} />
      </View>

      <View style={styles.card}>
        <View style={styles.profileTop}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.stats}>
            <Stat label="Publications" value={String(posts.length)} />
            <Stat label="Abonnés" value={formatNumber(currentUser.followers)} />
            <Stat label="Abonnements" value={String(currentUser.following)} />
          </View>
        </View>
        <View style={styles.nameLine}>
          <Text style={styles.name}>{displayName}</Text>
          <CheckCircle2 size={17} color={colors.gold} fill={colors.gold} />
        </View>
        <Text style={styles.bio}>{currentUser.bio}</Text>
        <Text style={styles.city}>{currentUser.city} · Minimal & streetwear</Text>
        <PrimaryButton label="Modifier le profil" variant="secondary" onPress={() => undefined} />
      </View>

      <View style={styles.tabs}>
        <ProfileTabButton active={active === "posts"} label="Publications" Icon={Grid3X3} onPress={() => setActive("posts")} />
        <ProfileTabButton active={active === "saved"} label="Enregistrés" Icon={Bookmark} onPress={() => setActive("saved")} />
        <ProfileTabButton active={active === "videos"} label="Vidéos" Icon={Video} onPress={() => setActive("videos")} />
        <ProfileTabButton active={active === "tagged"} label="Tagués" Icon={Tag} onPress={() => setActive("tagged")} />
      </View>

      {loadingSaved && useRealGrid ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.burgundy} />
          <Text style={styles.emptyText}>Chargement des enregistrements...</Text>
        </View>
      ) : useRealGrid ? (
        <View style={styles.grid}>
          {realVisiblePosts.map((post) => (
            <Pressable key={post.id} style={styles.tileWrap} onPress={() => onOpenPost?.(post.id)}>
              {post.mediaType === "video" && isVideoUrl(post.imageUrls[0]) ? (
                <View style={styles.videoTilePlaceholder}>
                  <Video size={24} color={colors.white} />
                </View>
              ) : (
                <Image source={{ uri: post.imageUrls[0] }} style={styles.tileImage} />
              )}
              {post.mediaType === "video" ? <Text style={styles.videoBadge}>Video</Text> : null}
            </Pressable>
          ))}
          {!realVisiblePosts.length ? (
            <View style={styles.emptySaved}>
              <Text style={styles.emptyTitle}>
                {active === "videos" ? "Aucune video enregistree" : "Aucun post enregistre"}
              </Text>
              <Text style={styles.emptyText}>
                Ouvre une publication puis touche l'icone bookmark pour l'ajouter ici.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.grid}>
          {mockVisiblePosts.map((post) => (
            <Image key={post.id} source={{ uri: post.image }} style={styles.tile} />
          ))}
        </View>
      )}
    </View>
  );
}

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
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Icon size={18} color={active ? colors.burgundy : colors.muted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function isVideoUrl(url?: string): boolean {
  return Boolean(url?.toLowerCase().split("?")[0].match(/\.(mp4|mov|m4v|webm)$/));
}

const styles = StyleSheet.create({
  shell: {
    gap: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  stats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 17,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  bio: {
    color: colors.text,
    lineHeight: 19,
  },
  city: {
    color: colors.muted,
    fontSize: 13,
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
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.cream,
  },
  tabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.burgundy,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  tile: {
    width: "32.9%",
    aspectRatio: 1,
    backgroundColor: colors.beige,
  },
  tileWrap: {
    width: "32.9%",
    aspectRatio: 1,
    backgroundColor: colors.beige,
  },
  tileImage: {
    width: "100%",
    height: "100%",
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
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
