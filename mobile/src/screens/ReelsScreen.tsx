import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  ListRenderItem,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Send,
  Share2,
  Video,
  X,
} from "lucide-react-native";

import { DressMeVideoPlayer } from "../components/DressMeVideoPlayer";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius } from "../theme/dressme";
import type { Comment, Post, User } from "../types/contracts";
import { iconTouchHitSlop, touchHitSlop, touchRetentionOffset } from "../utils/touchTargets";

const REELS_PAGE_SIZE = 8;

type Props = {
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
};

export function ReelsScreen({ onOpenProfile }: Props) {
  const { token, user } = useAuth();
  const { height } = useWindowDimensions();
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [containerHeight, setContainerHeight] = useState(0);
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const loadLockRef = useRef(false);

  const reelHeight = useMemo(() => Math.max(1, containerHeight || height), [containerHeight, height]);

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

  const shareReelExternally = useCallback(
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

  const updateCommentCount = useCallback((postId: string, delta: number) => {
    setReels((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, commentCount: Math.max(0, post.commentCount + delta) }
          : post,
      ),
    );
  }, []);

  const renderReel = useCallback<ListRenderItem<Post>>(
    ({ item }) => (
      <ReelCard
        post={item}
        height={reelHeight}
        onLike={() => void toggleLike(item)}
        onSave={() => void toggleSave(item)}
        onExternalShare={() => void shareReelExternally(item)}
        onSend={() => setSharePost(item)}
        onComments={() => setCommentsPost(item)}
        onOpenProfile={() => onOpenProfile?.(item.author.id)}
      />
    ),
    [onOpenProfile, reelHeight, shareReelExternally, toggleLike, toggleSave],
  );

  return (
    <View
      style={styles.shell}
      onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
    >
      <FlatList
        style={styles.list}
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={renderReel}
        showsVerticalScrollIndicator={false}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={reelHeight}
        snapToAlignment="start"
        contentContainerStyle={!reels.length ? styles.listContent : undefined}
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
        getItemLayout={(_, index) => ({
          length: reelHeight,
          offset: reelHeight * index,
          index,
        })}
        removeClippedSubviews
      />
      <ReelCommentsSheet
        visible={Boolean(commentsPost)}
        post={commentsPost}
        token={token ?? undefined}
        currentUser={user ?? null}
        onClose={() => setCommentsPost(null)}
        onCommentCountChange={updateCommentCount}
      />
      <ReelShareSheet
        visible={Boolean(sharePost)}
        post={sharePost}
        token={token ?? undefined}
        currentUserId={user?.id}
        onClose={() => setSharePost(null)}
        onShared={updateReel}
        onExternalShare={(post) => void shareReelExternally(post)}
      />
    </View>
  );
}

function ReelCard({
  post,
  height,
  onLike,
  onSave,
  onExternalShare,
  onSend,
  onComments,
  onOpenProfile,
}: {
  post: Post;
  height: number;
  onLike: () => void;
  onSave: () => void;
  onExternalShare: () => void;
  onSend: () => void;
  onComments: () => void;
  onOpenProfile: () => void;
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

        <View style={styles.reelsTopBar}>
          <Text style={styles.reelsTitle}>Reels</Text>
          <Video size={22} color={colors.white} />
        </View>

        <View style={styles.sideActions}>
          <Pressable
            hitSlop={iconTouchHitSlop}
            onPress={onLike}
            pressRetentionOffset={touchRetentionOffset}
            style={styles.roundAction}
          >
            <Heart
              size={24}
              color={colors.white}
              fill={post.likedByMe ? colors.burgundy : "transparent"}
            />
          </Pressable>
          <Text style={styles.actionCount}>{post.likeCount}</Text>

          <Pressable
            hitSlop={iconTouchHitSlop}
            onPress={onComments}
            pressRetentionOffset={touchRetentionOffset}
            style={styles.roundAction}
          >
            <MessageCircle size={24} color={colors.white} />
          </Pressable>
          <Text style={styles.actionCount}>{post.commentCount}</Text>

          <Pressable
            hitSlop={iconTouchHitSlop}
            onPress={onSend}
            pressRetentionOffset={touchRetentionOffset}
            style={styles.roundAction}
          >
            <Send size={23} color={colors.white} />
          </Pressable>
          <Text style={styles.actionCount}>{post.shareCount}</Text>

          <Pressable
            hitSlop={iconTouchHitSlop}
            onPress={onExternalShare}
            pressRetentionOffset={touchRetentionOffset}
            style={styles.roundAction}
          >
            <Share2 size={24} color={colors.white} />
          </Pressable>

          <Pressable
            hitSlop={iconTouchHitSlop}
            onPress={onSave}
            pressRetentionOffset={touchRetentionOffset}
            style={styles.roundAction}
          >
            <Bookmark
              size={24}
              color={colors.white}
              fill={post.savedByMe ? colors.burgundy : "transparent"}
            />
          </Pressable>
        </View>

        <View style={styles.captionBlock}>
          <Pressable
            accessibilityRole="button"
            hitSlop={touchHitSlop}
            onPress={onOpenProfile}
            pressRetentionOffset={touchRetentionOffset}
            style={styles.authorRow}
          >
            <Image source={{ uri: author.avatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{author.name}</Text>
              <Text style={styles.username}>@{author.username}</Text>
            </View>
          </Pressable>
          <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
          {post.hashtags.length ? <Text style={styles.hashtags}>{post.hashtags.join(" ")}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function ReelCommentsSheet({
  visible,
  post,
  token,
  currentUser,
  onClose,
  onCommentCountChange,
}: {
  visible: boolean;
  post: Post | null;
  token?: string;
  currentUser: User | null;
  onClose: () => void;
  onCommentCountChange: (postId: string, delta: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible || !post) {
      setComments([]);
      setCommentText("");
      setSending(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    client
      .getPostComments(post.id, { limit: 80, offset: 0 })
      .then((response) => {
        if (mounted) {
          setComments(response);
        }
      })
      .catch(() => {
        if (mounted) {
          setComments([]);
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
  }, [post, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return undefined;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(0, event.endCoordinates.height - 2));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  const submitComment = async () => {
    const content = commentText.trim();
    if (!post || !content || sending) {
      return;
    }
    if (!token || !currentUser) {
      Alert.alert("Connexion requise", "Connecte-toi pour commenter ce reel.");
      return;
    }

    const optimisticComment: Comment = {
      id: `optimistic-${Date.now()}`,
      author: currentUser,
      content,
      createdAt: new Date().toISOString(),
    };

    setSending(true);
    setCommentText("");
    setComments((current) => [optimisticComment, ...current]);
    onCommentCountChange(post.id, 1);

    try {
      const createdComment = await client.addPostComment(post.id, content, token);
      setComments((current) =>
        current.map((comment) => (comment.id === optimisticComment.id ? createdComment : comment)),
      );
    } catch (commentError) {
      setComments((current) => current.filter((comment) => comment.id !== optimisticComment.id));
      setCommentText(content);
      onCommentCountChange(post.id, -1);
      Alert.alert(
        "Commentaire impossible",
        commentError instanceof Error ? commentError.message : "Le commentaire a echoue.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <View style={[styles.commentsSheet, keyboardHeight > 0 && { marginBottom: keyboardHeight }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Commentaires</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={iconTouchHitSlop}
              onPress={onClose}
              pressRetentionOffset={touchRetentionOffset}
            >
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.sheetState}>
              <ActivityIndicator color={colors.burgundy} />
              <Text style={styles.sheetStateText}>Chargement des commentaires...</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.commentsList}
              renderItem={({ item }) => <ReelCommentRow comment={item} />}
              ListEmptyComponent={
                <View style={styles.sheetState}>
                  <Text style={styles.emptyTitle}>Aucun commentaire</Text>
                  <Text style={styles.sheetStateText}>Sois le premier a reagir a ce reel.</Text>
                </View>
              }
            />
          )}
          <View style={styles.commentComposer}>
            <Image source={{ uri: avatarForUser(currentUser) }} style={styles.composerAvatar} />
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Ajouter un commentaire..."
              placeholderTextColor={colors.muted}
              multiline
              style={styles.commentInput}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!commentText.trim() || sending}
              hitSlop={iconTouchHitSlop}
              onPress={() => void submitComment()}
              pressRetentionOffset={touchRetentionOffset}
              style={[styles.commentSendButton, (!commentText.trim() || sending) && styles.disabledButton]}
            >
              {sending ? <ActivityIndicator color={colors.white} /> : <Send size={18} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReelShareSheet({
  visible,
  post,
  token,
  currentUserId,
  onClose,
  onShared,
  onExternalShare,
}: {
  visible: boolean;
  post: Post | null;
  token?: string;
  currentUserId?: string;
  onClose: () => void;
  onShared: (post: Post) => void;
  onExternalShare: (post: Post) => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setUsers([]);
      setSelectedIds([]);
      setSending(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    const loadUsers = async () => {
      if (token && currentUserId) {
        const following = await client.getFollowing(currentUserId, token);
        if (following.length) {
          return following;
        }
      }
      return client.getChatUsers(token);
    };

    loadUsers()
      .then((response) => {
        if (mounted) {
          setUsers(response);
        }
      })
      .catch(() => {
        if (mounted) {
          setUsers([]);
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
  }, [currentUserId, token, visible]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return users;
    }
    return users.filter((item) => {
      const displayUser = toDisplayUser(item);
      return `${displayUser.name} ${displayUser.username}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, users]);

  const toggleRecipient = (userId: string) => {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const sendInternalShare = async () => {
    if (!post || !token || selectedIds.length === 0 || sending) {
      return;
    }

    const previousPost = post;
    setSending(true);
    onShared({ ...post, shareCount: post.shareCount + 1 });
    try {
      await Promise.all(
        selectedIds.map(async (userId) => {
          const conversation = await client.startConversation(userId, token);
          await client.sendConversationMessage(
            conversation.id,
            {
              kind: "shared_post",
              body: JSON.stringify({
                postId: post.id,
                caption: post.caption,
                mediaUrl: post.imageUrls[0] ?? "",
              }),
            },
            token,
          );
        }),
      );
      const updatedPost = await client.sharePost(post.id, token);
      onShared(updatedPost);
      Vibration.vibrate(10);
      Alert.alert("Envoye", `Reel envoye a ${selectedIds.length} destinataire(s).`);
      onClose();
    } catch (sendError) {
      onShared(previousPost);
      Alert.alert("Envoi impossible", sendError instanceof Error ? sendError.message : "Le partage interne a echoue.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <View style={styles.shareSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Envoyer le reel</Text>
              <Text style={styles.shareSubtitle}>{post ? `@${toDisplayUser(post.author).username}` : "Reel DressMe"}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              hitSlop={iconTouchHitSlop}
              onPress={onClose}
              pressRetentionOffset={touchRetentionOffset}
            >
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un ami..."
            placeholderTextColor={colors.muted}
            style={styles.shareSearchInput}
          />
          {selectedIds.length ? <Text style={styles.shareSelectedText}>{selectedIds.length} selectionne(s)</Text> : null}
          {loading ? (
            <View style={styles.sheetState}>
              <ActivityIndicator color={colors.burgundy} />
              <Text style={styles.sheetStateText}>Chargement des contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.shareList}
              renderItem={({ item }) => {
                const displayUser = toDisplayUser(item);
                const selected = selectedIds.includes(item.id);
                return (
                  <Pressable
                    hitSlop={touchHitSlop}
                    pressRetentionOffset={touchRetentionOffset}
                    style={[styles.sharePersonRow, selected && styles.sharePersonSelected]}
                    onPress={() => toggleRecipient(item.id)}
                  >
                    <Image source={{ uri: displayUser.avatar }} style={styles.shareAvatar} />
                    <View style={styles.shareIdentity}>
                      <Text style={styles.shareName}>{displayUser.name}</Text>
                      <Text style={styles.shareMeta}>@{displayUser.username}</Text>
                    </View>
                    <Text style={[styles.shareChooseText, selected && styles.shareChooseTextActive]}>
                      {selected ? "Selectionne" : "Choisir"}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.sheetState}>
                  <Text style={styles.emptyTitle}>Aucun contact</Text>
                  <Text style={styles.sheetStateText}>Essaie une autre recherche.</Text>
                </View>
              }
            />
          )}
          <View style={styles.shareActions}>
            <Pressable
              hitSlop={touchHitSlop}
              pressRetentionOffset={touchRetentionOffset}
              style={styles.shareExternalButton}
              onPress={() => {
                if (post) {
                  onClose();
                  onExternalShare(post);
                }
              }}
            >
              <Share2 size={17} color={colors.burgundy} />
              <Text style={styles.shareExternalText}>Partager hors app</Text>
            </Pressable>
            <Pressable
              disabled={!selectedIds.length || sending || !token}
              hitSlop={touchHitSlop}
              pressRetentionOffset={touchRetentionOffset}
              style={[
                styles.shareSendButton,
                (!selectedIds.length || sending || !token) && styles.disabledButton,
              ]}
              onPress={() => void sendInternalShare()}
            >
              {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.shareSendText}>Envoyer</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReelCommentRow({ comment }: { comment: Comment }) {
  const author = toDisplayUser(comment.author);
  return (
    <View style={styles.commentRow}>
      <Image source={{ uri: author.avatar }} style={styles.commentAvatar} />
      <View style={styles.commentBubble}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{author.username}</Text>
          <Text style={styles.commentTime}>{formatRelativeDate(comment.createdAt)}</Text>
        </View>
        <Text style={styles.commentContent}>{comment.content}</Text>
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
    avatar: avatarForUser(user),
  };
}

function avatarForUser(user: User | null): string {
  if (user?.avatarUrl) {
    return user.avatarUrl;
  }
  const seed = user?.id || user?.email || "dressme";
  return `https://api.dicebear.com/8.x/avataaars/png?seed=${encodeURIComponent(seed)}`;
}

function formatRelativeDate(value: string): string {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) {
    return "maintenant";
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
  if (diffMinutes < 1) {
    return "maintenant";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h`;
  }
  return `${Math.floor(diffHours / 24)} j`;
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
    backgroundColor: colors.black,
  },
  mediaFrame: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.black,
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
  reelsTopBar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reelsTitle: {
    color: colors.white,
    fontFamily: fonts.display,
    fontWeight: "700",
    fontSize: 30,
    textShadowColor: "rgba(0,0,0,0.42)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  sideActions: {
    position: "absolute",
    right: 12,
    bottom: 112,
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
    bottom: 36,
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardSheet: {
    justifyContent: "flex-end",
  },
  commentsSheet: {
    maxHeight: "78%",
    minHeight: "54%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    overflow: "hidden",
  },
  shareSheet: {
    maxHeight: "82%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 10,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.16)",
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
  },
  sheetTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 18,
  },
  sheetState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  sheetStateText: {
    color: colors.muted,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 14,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.beige,
  },
  commentBubble: {
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAuthor: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  commentTime: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 11,
  },
  commentContent: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  commentComposer: {
    minHeight: 66,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 10,
  },
  composerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.beige,
    marginBottom: 5,
  },
  commentInput: {
    flex: 1,
    maxHeight: 94,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontWeight: "700",
  },
  commentSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.burgundy,
  },
  disabledButton: {
    opacity: 0.45,
  },
  shareSubtitle: {
    color: colors.muted,
    fontWeight: "800",
    marginTop: 2,
  },
  shareSearchInput: {
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 15,
    fontWeight: "700",
  },
  shareSelectedText: {
    color: colors.burgundy,
    fontWeight: "900",
    fontSize: 12,
  },
  shareList: {
    maxHeight: 330,
  },
  sharePersonRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  sharePersonSelected: {
    borderColor: colors.burgundy,
    backgroundColor: colors.roseLight,
  },
  shareAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.beige,
  },
  shareIdentity: {
    flex: 1,
    minWidth: 0,
  },
  shareName: {
    color: colors.text,
    fontWeight: "900",
  },
  shareMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  shareChooseText: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 12,
  },
  shareChooseTextActive: {
    color: colors.burgundy,
  },
  shareActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shareExternalButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  shareExternalText: {
    color: colors.burgundy,
    fontWeight: "900",
  },
  shareSendButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.burgundy,
    alignItems: "center",
    justifyContent: "center",
  },
  shareSendText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 15,
  },
});
