import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import {
  Bookmark,
  ChevronLeft,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
} from "lucide-react-native";

import { DressMeVideoPlayer } from "../components/DressMeVideoPlayer";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { Comment, Post, User } from "../types/contracts";

type Props = {
  postId: string;
  onBack: () => void;
};

export function PostDetailScreen({ postId, onBack }: Props) {
  const { token, user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadPost = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [postResponse, commentsResponse] = await Promise.all([
        client.getPost(postId, { token: token ?? undefined }),
        client.getPostComments(postId, { limit: 60, offset: 0 }),
      ]);
      setPost(postResponse);
      setComments(commentsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger la publication.");
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  const author = useMemo(() => (post ? toDisplayUser(post.author) : null), [post]);

  const toggleLike = async () => {
    if (!token || !post || liking) {
      return;
    }

    const previousPost = post;
    setLiking(true);
    setPost({
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: Math.max(0, post.likeCount + (post.likedByMe ? -1 : 1)),
    });

    try {
      const updatedPost = await client.togglePostLike(post.id, token);
      setPost(updatedPost);
    } catch (likeError) {
      setPost(previousPost);
      Alert.alert("Action impossible", likeError instanceof Error ? likeError.message : "Le like a echoue.");
    } finally {
      setLiking(false);
    }
  };

  const toggleSave = async () => {
    if (!token || !post || saving) {
      return;
    }

    const previousPost = post;
    setSaving(true);
    setPost({ ...post, savedByMe: !post.savedByMe });

    try {
      const updatedPost = await client.togglePostSave(post.id, token);
      setPost(updatedPost);
    } catch (saveError) {
      setPost(previousPost);
      Alert.alert(
        "Sauvegarde impossible",
        saveError instanceof Error ? saveError.message : "La sauvegarde a echoue.",
      );
    } finally {
      setSaving(false);
    }
  };

  const shareCurrentPost = async () => {
    if (!post) {
      return;
    }

    const displayAuthor = toDisplayUser(post.author);
    const mediaUrl = post.imageUrls[0] ?? "";

    try {
      const result = await Share.share({
        title: "DressMe",
        message: `${displayAuthor.name} sur DressMe\n\n${post.caption}\n${post.hashtags.join(" ")}${mediaUrl ? `\n${mediaUrl}` : ""}`,
        url: mediaUrl || undefined,
      });

      if (result.action === Share.dismissedAction || !token) {
        return;
      }

      const updatedPost = await client.sharePost(post.id, token);
      setPost(updatedPost);
    } catch (shareError) {
      Alert.alert(
        "Partage impossible",
        shareError instanceof Error ? shareError.message : "Le partage a echoue.",
      );
    }
  };

  const submitComment = async () => {
    const content = commentText.trim();
    if (!content || submitting) {
      return;
    }

    if (!token) {
      Alert.alert("Connexion requise", "Connecte-toi pour commenter cette publication.");
      return;
    }

    setSubmitting(true);
    try {
      const createdComment = await client.addPostComment(postId, content, token);
      setComments((current) => [createdComment, ...current]);
      setCommentText("");
      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      );
    } catch (commentError) {
      Alert.alert(
        "Commentaire impossible",
        commentError instanceof Error ? commentError.message : "Le commentaire n'a pas ete envoye.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 84 : 0}
    >
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <ChevronLeft size={24} color={colors.burgundy} />
        </Pressable>
        <Text style={styles.title}>Publication</Text>
        <Pressable style={styles.backButton} onPress={() => setMenuVisible(true)}>
          <MoreHorizontal size={23} color={colors.muted} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.burgundy} />
          <Text style={styles.centerText}>Chargement de la publication...</Text>
        </View>
      ) : error || !post || !author ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Publication indisponible</Text>
          <Text style={styles.centerText}>{error || "Cette publication n'existe plus."}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadPost()}>
            <Text style={styles.retryText}>Reessayer</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <PostDetailHeader
                author={author}
                post={post}
                onLike={() => void toggleLike()}
                onSave={() => void toggleSave()}
                onShare={() => void shareCurrentPost()}
                onOpenMenu={() => setMenuVisible(true)}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyTitle}>Aucun commentaire</Text>
                <Text style={styles.emptyText}>Sois le premier a donner ton avis sur ce look.</Text>
              </View>
            }
            renderItem={({ item }) => <CommentRow comment={item} />}
          />

          <View style={styles.commentComposer}>
            <Image
              source={{ uri: avatarForUser(user) }}
              style={styles.composerAvatar}
            />
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Ajouter un commentaire..."
              placeholderTextColor={colors.muted}
              style={styles.commentInput}
              multiline
            />
            <Pressable
              style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
              disabled={!commentText.trim() || submitting}
              onPress={() => void submitComment()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Send size={18} color={colors.white} />
              )}
            </Pressable>
          </View>
        </>
      )}

      <PostDetailActionSheet
        visible={menuVisible && Boolean(post)}
        post={post}
        onClose={() => setMenuVisible(false)}
        onShare={() => {
          setMenuVisible(false);
          void shareCurrentPost();
        }}
        onSave={() => {
          setMenuVisible(false);
          void toggleSave();
        }}
        onRefresh={() => {
          setMenuVisible(false);
          void loadPost();
        }}
      />
    </KeyboardAvoidingView>
  );
}

function PostDetailHeader({
  author,
  post,
  onLike,
  onSave,
  onShare,
  onOpenMenu,
}: {
  author: DisplayUser;
  post: Post;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onOpenMenu: () => void;
}) {
  const mediaUrl = post.imageUrls[0];
  const isVideo = post.mediaType === "video" || isVideoUrl(mediaUrl);
  const lastTapRef = useRef(0);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
    },
    [],
  );

  const playDoubleTapHeart = useCallback(() => {
    heartScale.setValue(0.25);
    heartOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        tension: 130,
        useNativeDriver: true,
      }),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 720,
        delay: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heartOpacity, heartScale]);

  const handleImagePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      Vibration.vibrate(8);
      playDoubleTapHeart();
      if (!post.likedByMe) {
        onLike();
      }
      return;
    }

    lastTapRef.current = now;
    singleTapTimeoutRef.current = setTimeout(() => {
      singleTapTimeoutRef.current = null;
    }, 290);
  }, [onLike, playDoubleTapHeart, post.likedByMe]);

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image source={{ uri: author.avatar }} style={styles.authorAvatar} />
        <View style={styles.identity}>
          <Text style={styles.authorName}>{author.name}</Text>
          <Text style={styles.meta}>@{author.username} · {formatRelativeDate(post.createdAt)}</Text>
        </View>
        <Pressable style={styles.menuButton} onPress={onOpenMenu}>
          <MoreHorizontal size={22} color={colors.muted} />
        </Pressable>
      </View>

      {isVideo ? (
        <View style={styles.videoFrame}>
          {mediaUrl ? (
            <DressMeVideoPlayer
              uri={mediaUrl}
              style={styles.postVideo}
              autoPlay
              nativeControls
              contentFit="contain"
            />
          ) : null}
        </View>
      ) : (
        <Pressable onPress={handleImagePress}>
          <Image source={{ uri: mediaUrl }} style={styles.postImage} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.postDoubleTapHeart,
              {
                opacity: heartOpacity,
                transform: [{ scale: heartScale }],
              },
            ]}
          >
            <Heart size={104} color={colors.white} fill={colors.white} />
          </Animated.View>
        </Pressable>
      )}

      <View style={styles.actionRow}>
        <Pressable style={styles.actionItem} onPress={onLike}>
          <Heart
            size={25}
            color={post.likedByMe ? colors.burgundy : colors.muted}
            fill={post.likedByMe ? colors.burgundy : "transparent"}
          />
          <Text style={styles.actionText}>{post.likeCount}</Text>
        </Pressable>
        <View style={styles.actionItem}>
          <MessageCircle size={25} color={colors.muted} />
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </View>
        <Pressable style={styles.actionItem} onPress={onShare}>
          <Share2 size={24} color={colors.muted} />
          {post.shareCount > 0 ? <Text style={styles.actionText}>{post.shareCount}</Text> : null}
        </Pressable>
        <Pressable style={styles.saveAction} onPress={onSave}>
          <Bookmark
            size={25}
            color={post.savedByMe ? colors.burgundy : colors.muted}
            fill={post.savedByMe ? colors.burgundy : "transparent"}
          />
          <Text style={[styles.saveText, post.savedByMe && styles.saveTextActive]}>
            {post.savedByMe
              ? post.mediaType === "video"
                ? "Video enregistree"
                : "Enregistre"
              : "Enregistrer"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.captionBlock}>
        <Text style={styles.caption}>
          <Text style={styles.username}>{author.username}</Text> {post.caption}
        </Text>
        {post.hashtags.length ? <Text style={styles.hashtags}>{post.hashtags.join(" ")}</Text> : null}
        {post.garmentTags.length ? (
          <View style={styles.tagRow}>
            {post.garmentTags.slice(0, 6).map((tag) => (
              <Text key={tag} style={styles.tagPill}>{tag}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <Text style={styles.commentsTitle}>Commentaires</Text>
    </View>
  );
}

function PostDetailActionSheet({
  visible,
  post,
  onClose,
  onShare,
  onSave,
  onRefresh,
}: {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onShare: () => void;
  onSave: () => void;
  onRefresh: () => void;
}) {
  const reportPost = () => {
    onClose();
    Alert.alert("Signalement recu", "Cette publication sera examinee par DressMe.");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Options de publication</Text>
          <Pressable style={styles.sheetOption} onPress={onShare}>
            <Text style={styles.sheetOptionText}>Partager</Text>
          </Pressable>
          <Pressable style={styles.sheetOption} onPress={onSave}>
            <Text style={styles.sheetOptionText}>
              {post?.savedByMe ? "Retirer des enregistrements" : "Enregistrer"}
            </Text>
          </Pressable>
          <Pressable style={styles.sheetOption} onPress={onRefresh}>
            <Text style={styles.sheetOptionText}>Actualiser</Text>
          </Pressable>
          <Pressable style={styles.sheetOption} onPress={reportPost}>
            <Text style={[styles.sheetOptionText, styles.sheetOptionDanger]}>Signaler</Text>
          </Pressable>
          <Pressable style={[styles.sheetOption, styles.sheetCancel]} onPress={onClose}>
            <Text style={styles.sheetCancelText}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
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

type DisplayUser = {
  name: string;
  username: string;
  avatar: string;
};

function toDisplayUser(user: User): DisplayUser {
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
    backgroundColor: colors.cream,
  },
  topBar: {
    height: 54,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  content: {
    padding: 12,
    paddingBottom: 18,
    gap: 10,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  centerText: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  errorTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 17,
  },
  retryButton: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: colors.white,
    fontWeight: "800",
  },
  postCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.beige,
  },
  identity: {
    flex: 1,
  },
  authorName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  postImage: {
    width: "100%",
    height: 430,
    backgroundColor: colors.beige,
  },
  postDoubleTapHeart: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  videoFrame: {
    height: 430,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  postVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.black,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    color: colors.muted,
    fontWeight: "800",
  },
  saveAction: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.beige,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveText: {
    color: colors.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  saveTextActive: {
    color: colors.burgundy,
  },
  captionBlock: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  caption: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  username: {
    fontWeight: "900",
    color: colors.text,
  },
  hashtags: {
    color: colors.burgundy,
    fontWeight: "800",
    fontSize: 13,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  tagPill: {
    color: colors.burgundy,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
  },
  commentsTitle: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 2,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.beige,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  commentAuthor: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  commentTime: {
    color: colors.muted,
    fontSize: 11,
  },
  commentContent: {
    color: colors.text,
    lineHeight: 19,
    fontSize: 13,
  },
  emptyComments: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 3,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 8,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontWeight: "700",
    fontSize: 22,
    marginBottom: 2,
  },
  sheetOption: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  sheetOptionText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 14,
  },
  sheetOptionDanger: {
    color: colors.danger,
  },
  sheetCancel: {
    backgroundColor: colors.beige,
    alignItems: "center",
  },
  sheetCancelText: {
    color: colors.burgundy,
    fontWeight: "900",
  },
  commentComposer: {
    minHeight: 64,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
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
    maxHeight: 92,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.burgundy,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
