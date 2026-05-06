import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ListRenderItem,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Share2,
  Video,
} from "lucide-react-native";

import { DressMeVideoPlayer } from "../components/DressMeVideoPlayer";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { Post, User } from "../types/contracts";

const REELS_PAGE_SIZE = 8;

type Props = {
  onOpenPost?: (postId: string) => void;
};

export function ReelsScreen({ onOpenPost }: Props) {
  const { token } = useAuth();
  const { height } = useWindowDimensions();
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const loadLockRef = useRef(false);

  const reelHeight = useMemo(() => Math.max(560, height - 146), [height]);

  const fetchReels = useCallback(
    async (offset: number, replace: boolean) => {
      setError("");
      const response = await client.getReels({
        token: token ?? undefined,
        limit: REELS_PAGE_SIZE,
        offset,
      });
      setReels((current) => (replace ? response : [...current, ...response]));
      setHasMore(response.length === REELS_PAGE_SIZE);
    },
    [token],
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchReels(0, true)
      .catch((loadError: unknown) => {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger les reels.");
          setReels([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fetchReels]);

  const refreshReels = useCallback(() => {
    setRefreshing(true);
    fetchReels(0, true)
      .catch((refreshError: unknown) => {
        setError(refreshError instanceof Error ? refreshError.message : "Impossible de rafraichir les reels.");
      })
      .finally(() => {
        setRefreshing(false);
        loadLockRef.current = false;
      });
  }, [fetchReels]);

  const loadMore = useCallback(() => {
    if (loadLockRef.current || loadingMore || loading || !hasMore) {
      return;
    }

    loadLockRef.current = true;
    setLoadingMore(true);
    fetchReels(reels.length, false)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger plus de reels.");
      })
      .finally(() => {
        setLoadingMore(false);
        loadLockRef.current = false;
      });
  }, [fetchReels, hasMore, loading, loadingMore, reels.length]);

  const updateReel = useCallback((updatedPost: Post) => {
    setReels((current) => current.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
  }, []);

  const toggleLike = useCallback(
    async (post: Post) => {
      if (!token) {
        Alert.alert("Connexion requise", "Connecte-toi pour liker ce reel.");
        return;
      }

      const previous = post;
      setReels((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likedByMe: !item.likedByMe,
                likeCount: Math.max(0, item.likeCount + (item.likedByMe ? -1 : 1)),
              }
            : item,
        ),
      );

      try {
        updateReel(await client.togglePostLike(post.id, token));
      } catch (likeError) {
        updateReel(previous);
        Alert.alert("Action impossible", likeError instanceof Error ? likeError.message : "Le like a echoue.");
      }
    },
    [token, updateReel],
  );

  const toggleSave = useCallback(
    async (post: Post) => {
      if (!token) {
        Alert.alert("Connexion requise", "Connecte-toi pour enregistrer ce reel.");
        return;
      }

      const previous = post;
      setReels((current) =>
        current.map((item) => (item.id === post.id ? { ...item, savedByMe: !item.savedByMe } : item)),
      );

      try {
        updateReel(await client.togglePostSave(post.id, token));
      } catch (saveError) {
        updateReel(previous);
        Alert.alert(
          "Sauvegarde impossible",
          saveError instanceof Error ? saveError.message : "La sauvegarde a echoue.",
        );
      }
    },
    [token, updateReel],
  );

  const shareReel = useCallback(
    async (post: Post) => {
      const author = toDisplayUser(post.author);
      const mediaUrl = post.imageUrls[0] ?? "";
      try {
        const result = await Share.share({
          title: "DressMe Reels",
          message: `${author.name} sur DressMe Reels\n\n${post.caption}\n${post.hashtags.join(" ")}${mediaUrl ? `\n${mediaUrl}` : ""}`,
          url: mediaUrl || undefined,
        });

        if (result.action === Share.dismissedAction || !token) {
          return;
        }

        updateReel(await client.sharePost(post.id, token));
      } catch (shareError) {
        Alert.alert(
          "Partage impossible",
          shareError instanceof Error ? shareError.message : "Le partage a echoue.",
        );
      }
    },
    [token, updateReel],
  );

  const renderReel = useCallback<ListRenderItem<Post>>(
    ({ item }) => (
      <ReelCard
        post={item}
        height={reelHeight}
        onLike={() => void toggleLike(item)}
        onSave={() => void toggleSave(item)}
        onShare={() => void shareReel(item)}
        onComments={() => onOpenPost?.(item.id)}
      />
    ),
    [onOpenPost, reelHeight, shareReel, toggleLike, toggleSave],
  );

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reels</Text>
          <Text style={styles.subtitle}>Looks video de la communaute</Text>
        </View>
        <View style={styles.headerIcon}>
          <Video size={22} color={colors.burgundy} />
        </View>
      </View>

      <FlatList
        style={styles.list}
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={renderReel}
        showsVerticalScrollIndicator={false}
        pagingEnabled
        decelerationRate="fast"
        snapToAlignment="start"
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshReels}
            tintColor={colors.burgundy}
            colors={[colors.burgundy]}
          />
        }
        ListEmptyComponent={<ReelsStatus loading={loading} error={error} />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.burgundy} />
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.55}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

function ReelCard({
  post,
  height,
  onLike,
  onSave,
  onShare,
  onComments,
}: {
  post: Post;
  height: number;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onComments: () => void;
}) {
  const author = toDisplayUser(post.author);
  const mediaUrl = post.imageUrls[0];
  const isVideo = post.mediaType === "video" || isVideoUrl(mediaUrl);

  return (
    <View style={[styles.reel, { height }]}>
      <View style={styles.mediaFrame}>
        {mediaUrl && isVideo ? (
          <DressMeVideoPlayer
            uri={mediaUrl}
            style={styles.mediaImage}
            autoPlay
            loop
            nativeControls={false}
            contentFit="cover"
          />
        ) : mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.mediaImage} />
        ) : (
          <View style={styles.videoFallback}>
            <Video size={72} color={colors.white} />
            <Text style={styles.videoFallbackText}>Media indisponible</Text>
          </View>
        )}
        <View style={styles.mediaOverlay} />

        <View style={styles.sideActions}>
          <Pressable style={styles.roundAction} onPress={onLike}>
            <Heart
              size={24}
              color={colors.white}
              fill={post.likedByMe ? colors.burgundy : "transparent"}
            />
          </Pressable>
          <Text style={styles.actionCount}>{post.likeCount}</Text>

          <Pressable style={styles.roundAction} onPress={onComments}>
            <MessageCircle size={24} color={colors.white} />
          </Pressable>
          <Text style={styles.actionCount}>{post.commentCount}</Text>

          <Pressable style={styles.roundAction} onPress={onShare}>
            <Share2 size={24} color={colors.white} />
          </Pressable>
          <Text style={styles.actionCount}>{post.shareCount}</Text>

          <Pressable style={styles.roundAction} onPress={onSave}>
            <Bookmark
              size={24}
              color={colors.white}
              fill={post.savedByMe ? colors.burgundy : "transparent"}
            />
          </Pressable>
        </View>

        <View style={styles.captionBlock}>
          <View style={styles.authorRow}>
            <Image source={{ uri: author.avatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{author.name}</Text>
              <Text style={styles.username}>@{author.username}</Text>
            </View>
          </View>
          <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
          {post.hashtags.length ? <Text style={styles.hashtags}>{post.hashtags.join(" ")}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function ReelsStatus({ loading, error }: { loading: boolean; error: string }) {
  if (loading) {
    return (
      <View style={styles.statusCard}>
        <ActivityIndicator color={colors.burgundy} />
        <Text style={styles.statusText}>Chargement des reels...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Reels indisponibles</Text>
        <Text style={styles.statusText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>Aucun reel pour le moment</Text>
      <Text style={styles.statusText}>
        Cree une publication de type Reel ou importe des posts MongoDB avec media_type video.
      </Text>
    </View>
  );
}

function toDisplayUser(user: User) {
  const name = `${user.firstName} ${user.lastName}`.trim() || "Utilisateur DressMe";
  const usernameSource = user.email ? user.email.split("@")[0] : name;
  return {
    name,
    username: usernameSource.replace(/\s+/g, ".").toLowerCase() || "dressme.user",
    avatar: user.avatarUrl || `https://api.dicebear.com/8.x/avataaars/png?seed=${encodeURIComponent(user.id)}`,
  };
}

function isVideoUrl(url?: string): boolean {
  return Boolean(url?.toLowerCase().split("?")[0].match(/\.(mp4|mov|m4v|webm)$/));
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    backgroundColor: colors.black,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.display,
    color: colors.white,
    fontWeight: "700",
    fontSize: 31,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  reel: {
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  mediaFrame: {
    flex: 1,
    minHeight: 540,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...shadow.card,
  },
  mediaImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    resizeMode: "cover",
  },
  videoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.burgundyDark,
  },
  videoFallbackText: {
    color: colors.white,
    fontWeight: "900",
  },
  mediaOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  sideActions: {
    position: "absolute",
    right: 10,
    bottom: 98,
    alignItems: "center",
    gap: 6,
  },
  roundAction: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  actionCount: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12,
  },
  captionBlock: {
    position: "absolute",
    left: 14,
    right: 72,
    bottom: 18,
    gap: 8,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.beige,
  },
  authorName: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 14,
  },
  username: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
  },
  caption: {
    color: colors.white,
    lineHeight: 19,
    fontSize: 13,
    fontWeight: "700",
  },
  hashtags: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 13,
  },
  statusCard: {
    margin: 14,
    minHeight: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  statusTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 17,
    textAlign: "center",
  },
  statusText: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    fontSize: 13,
  },
  footer: {
    paddingVertical: 18,
  },
});
