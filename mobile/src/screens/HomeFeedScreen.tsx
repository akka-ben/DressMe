import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ListRenderItem,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  Bookmark,
  CheckCircle2,
  Heart,
  HelpCircle,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react-native";

import {
  aiSuggestions,
  FashionStory,
  getUser,
  notifications,
  stories as initialStories,
} from "../data/fashionData";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { Post, User } from "../types/contracts";

const filters = ["Tous", "#casual", "#soirée", "#streetwear", "#glam", "#vintage"];
const FEED_PAGE_SIZE = 10;

type FeedAuthor = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  verified?: boolean;
};

type FeedPost = {
  id: string;
  feedId: string;
  sourcePostId: string;
  author: FeedAuthor;
  image: string;
  description: string;
  hashtags: string[];
  likes: number;
  comments: number;
  timestamp: string;
  isLiked: boolean;
  isSaved: boolean;
  isPoll?: boolean;
  pollQuestion?: string;
  pollOptions?: Array<{ id: string; image: string; label: string; votes: number }>;
  selectedPollOptionId?: string;
};

export function HomeFeedScreen() {
  const { token } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState(initialStories);
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [activeStory, setActiveStory] = useState<FashionStory | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStylist, setShowStylist] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState("");
  const loadLockRef = useRef(false);

  const unreadNotifications = notifications.filter((item) => !item.read).length;

  const visiblePosts = useMemo(() => {
    if (activeFilter === "Tous") {
      return posts;
    }
    return posts.filter((post) => post.hashtags.includes(activeFilter));
  }, [activeFilter, posts]);

  useEffect(() => {
    visiblePosts.slice(0, 4).forEach((post) => {
      void Image.prefetch(post.image);
      post.pollOptions?.forEach((option) => void Image.prefetch(option.image));
    });
  }, [visiblePosts]);

  const fetchFeedPage = useCallback(
    async (offset: number, replace: boolean) => {
      setFeedError("");
      const apiPosts = await client.getFeed({
        token: token ?? undefined,
        limit: FEED_PAGE_SIZE,
        offset,
      });
      const mappedPosts = apiPosts.map(mapApiPost);

      setPosts((current) => (replace ? mappedPosts : [...current, ...mappedPosts]));
      setHasMore(apiPosts.length === FEED_PAGE_SIZE);
    },
    [token],
  );

  useEffect(() => {
    let mounted = true;
    setInitialLoading(true);
    fetchFeedPage(0, true)
      .catch((error: unknown) => {
        if (mounted) {
          setFeedError(error instanceof Error ? error.message : "Impossible de charger le feed.");
          setPosts([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setInitialLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fetchFeedPage]);

  const toggleLike = useCallback((feedId: string) => {
    const targetPost = posts.find((post) => post.feedId === feedId);
    setPosts((current) =>
      current.map((post) =>
        post.feedId === feedId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: Math.max(0, post.likes + (post.isLiked ? -1 : 1)),
            }
          : post,
      ),
    );

    if (!token || !targetPost) {
      return;
    }

    client
      .togglePostLike(targetPost.sourcePostId, token)
      .then((updatedPost) => {
        const mappedPost = mapApiPost(updatedPost);
        setPosts((current) =>
          current.map((post) =>
            post.feedId === feedId
              ? { ...mappedPost, feedId, isSaved: post.isSaved }
              : post,
          ),
        );
      })
      .catch(() => {
        setPosts((current) =>
          current.map((post) =>
            post.feedId === feedId
              ? {
                  ...post,
                  isLiked: !post.isLiked,
                  likes: Math.max(0, post.likes + (post.isLiked ? -1 : 1)),
                }
              : post,
          ),
        );
      });
  }, [posts, token]);

  const toggleSave = useCallback((feedId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.feedId === feedId ? { ...post, isSaved: !post.isSaved } : post,
      ),
    );
  }, []);

  const votePoll = useCallback((feedId: string, optionId: string) => {
    setPosts((current) =>
      current.map((post) => {
        if (post.feedId !== feedId || post.selectedPollOptionId) {
          return post;
        }

        return {
          ...post,
          selectedPollOptionId: optionId,
          pollOptions: post.pollOptions?.map((option) =>
            option.id === optionId ? { ...option, votes: option.votes + 1 } : option,
          ),
        };
      }),
    );
  }, []);

  const openStory = useCallback((story: FashionStory) => {
    setActiveStory(story);
    setStories((current) =>
      current.map((item) => (item.id === story.id ? { ...item, viewed: true } : item)),
    );
  }, []);

  const refreshFeed = useCallback(() => {
    setRefreshing(true);
    fetchFeedPage(0, true)
      .catch((error: unknown) => {
        setFeedError(error instanceof Error ? error.message : "Impossible de rafraichir le feed.");
      })
      .finally(() => {
      setRefreshing(false);
      loadLockRef.current = false;
      });
  }, [fetchFeedPage]);

  const loadMorePosts = useCallback(() => {
    if (loadLockRef.current || loadingMore || !hasMore || initialLoading) {
      return;
    }

    loadLockRef.current = true;
    setLoadingMore(true);
    fetchFeedPage(posts.length, false)
      .catch((error: unknown) => {
        setFeedError(error instanceof Error ? error.message : "Impossible de charger plus de posts.");
      })
      .finally(() => {
        setLoadingMore(false);
        loadLockRef.current = false;
      });
  }, [fetchFeedPage, hasMore, initialLoading, loadingMore, posts.length]);

  const renderPost = useCallback<ListRenderItem<FeedPost>>(
    ({ item }) => (
      <PostCard
        post={item}
        onHelp={() => setShowStylist(true)}
        onLike={() => toggleLike(item.feedId)}
        onSave={() => toggleSave(item.feedId)}
        onVote={(optionId) => votePoll(item.feedId, optionId)}
      />
    ),
    [toggleLike, toggleSave, votePoll],
  );

  return (
    <View style={styles.shell}>
      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.feedId}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <FeedHeader
            activeFilter={activeFilter}
            stories={stories}
            unreadNotifications={unreadNotifications}
            onFilterChange={setActiveFilter}
            onOpenNotifications={() => setShowNotifications(true)}
            onOpenStory={openStory}
            onOpenStylist={() => setShowStylist(true)}
          />
        }
        ListEmptyComponent={
          <FeedStatus activeFilter={activeFilter} error={feedError} loading={initialLoading} />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color={colors.burgundy} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshFeed}
            tintColor={colors.burgundy}
            colors={[colors.burgundy]}
          />
        }
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        updateCellsBatchingPeriod={60}
        removeClippedSubviews
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.45}
      />

      <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />
      <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
      <StylistModal visible={showStylist} onClose={() => setShowStylist(false)} />
    </View>
  );
}

function FeedHeader({
  activeFilter,
  stories,
  unreadNotifications,
  onFilterChange,
  onOpenNotifications,
  onOpenStory,
  onOpenStylist,
}: {
  activeFilter: string;
  stories: FashionStory[];
  unreadNotifications: number;
  onFilterChange: (filter: string) => void;
  onOpenNotifications: () => void;
  onOpenStory: (story: FashionStory) => void;
  onOpenStylist: () => void;
}) {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>DressMe</Text>
          <Text style={styles.headerSub}>Mode sociale & IA stylist</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={onOpenStylist}>
            <Sparkles size={20} color={colors.burgundy} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onOpenNotifications}>
            <Bell size={20} color={colors.burgundy} />
            {unreadNotifications ? (
              <Text style={styles.notificationBadge}>{unreadNotifications}</Text>
            ) : null}
          </Pressable>
        </View>
      </View>

      <FlatList
        horizontal
        data={stories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stories}
        renderItem={({ item }) => {
          const user = getUser(item.userId);
          return (
            <Pressable style={styles.storyItem} onPress={() => onOpenStory(item)}>
              <LinearGradient
                colors={item.viewed ? [colors.border, colors.border] : [colors.burgundy, colors.roseLight]}
                style={styles.storyRing}
              >
                <Image source={{ uri: user.avatar }} style={styles.storyAvatar} />
              </LinearGradient>
              <Text numberOfLines={1} style={styles.storyName}>
                {item.userId === "me" ? "Votre Story" : user.name.split(" ")[0]}
              </Text>
            </Pressable>
          );
        }}
      />

      <FlatList
        horizontal
        data={filters}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => {
          const active = item === activeFilter;
          return (
            <Pressable
              onPress={() => onFilterChange(item)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function mapApiPost(post: Post): FeedPost {
  return {
    id: post.id,
    feedId: post.id,
    sourcePostId: post.id,
    author: mapApiUserToAuthor(post.author),
    image: post.imageUrls[0] ?? "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900",
    description: post.caption,
    hashtags: post.hashtags,
    likes: post.likeCount,
    comments: post.commentCount,
    timestamp: formatRelativeDate(post.createdAt),
    isLiked: post.likedByMe,
    isSaved: false,
    isPoll: Boolean(post.poll),
    pollQuestion: post.poll ? "Quelle tenue preferez-vous ?" : undefined,
    pollOptions: post.poll?.options.map((option) => ({
      id: option.id,
      image: option.imageUrl,
      label: option.label,
      votes: option.votes,
    })),
  };
}

function mapApiUserToAuthor(user: User): FeedAuthor {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const usernameSource = user.email ? user.email.split("@")[0] : fullName;

  return {
    id: user.id,
    name: fullName || "Utilisateur DressMe",
    username: usernameSource.replace(/\s+/g, ".").toLowerCase() || "dressme.user",
    avatar: user.avatarUrl || `https://api.dicebear.com/8.x/avataaars/png?seed=${encodeURIComponent(user.id)}`,
    verified: false,
  };
}

function formatRelativeDate(value: string): string {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) {
    return "maintenant";
  }

  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
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

const PostCard = memo(function PostCard({
  post,
  onHelp,
  onLike,
  onSave,
  onVote,
}: {
  post: FeedPost;
  onHelp: () => void;
  onLike: () => void;
  onSave: () => void;
  onVote: (optionId: string) => void;
}) {
  const user = post.author;
  const totalVotes = post.pollOptions?.reduce((sum, option) => sum + option.votes, 0) ?? 0;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image source={{ uri: user.avatar }} style={styles.postAvatar} />
        <View style={styles.postIdentity}>
          <View style={styles.nameLine}>
            <Text style={styles.postName}>{user.name}</Text>
            {user.verified ? <CheckCircle2 size={14} color={colors.gold} fill={colors.gold} /> : null}
          </View>
          <Text style={styles.postMeta}>
            @{user.username} · {post.timestamp}
          </Text>
        </View>
        <MoreHorizontal size={21} color={colors.muted} />
      </View>

      <Image source={{ uri: post.image }} style={styles.postImage} />

      {post.isPoll && post.pollOptions ? (
        <View style={styles.pollBox}>
          <Text style={styles.pollQuestion}>{post.pollQuestion}</Text>
          <View style={styles.pollGrid}>
            {post.pollOptions.map((option) => {
              const percent = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
              const selected = post.selectedPollOptionId === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.pollOption, selected && styles.pollOptionSelected]}
                  onPress={() => onVote(option.id)}
                >
                  <Image source={{ uri: option.image }} style={styles.pollImage} />
                  <Text style={styles.pollLabel}>{option.label}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${percent}%` }]} />
                  </View>
                  <Text style={styles.pollPercent}>{percent}%</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.actionItem} onPress={onLike}>
          <Heart
            size={21}
            color={post.isLiked ? colors.burgundy : colors.muted}
            fill={post.isLiked ? colors.burgundy : "transparent"}
          />
          <Text style={styles.actionText}>{post.likes}</Text>
        </Pressable>
        <View style={styles.actionItem}>
          <MessageCircle size={21} color={colors.muted} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </View>
        <Share2 size={21} color={colors.muted} />
        <Pressable style={styles.helpButton} onPress={onHelp}>
          <HelpCircle size={16} color={colors.burgundy} />
          <Text style={styles.helpText}>Help Me Choose</Text>
        </Pressable>
        <Pressable onPress={onSave} style={styles.saveButton}>
          <Bookmark
            size={21}
            color={post.isSaved ? colors.burgundy : colors.muted}
            fill={post.isSaved ? colors.burgundy : "transparent"}
          />
        </Pressable>
      </View>

      <Text style={styles.description}>
        <Text style={styles.username}>{user.username}</Text> {post.description}
      </Text>
      <Text style={styles.hashtags}>{post.hashtags.join(" ")}</Text>
    </View>
  );
});

function FeedStatus({
  activeFilter,
  error,
  loading,
}: {
  activeFilter: string;
  error: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color={colors.burgundy} />
        <Text style={styles.emptyText}>Chargement des publications...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Feed indisponible</Text>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Aucune publication</Text>
      <Text style={styles.emptyText}>
        {activeFilter === "Tous"
          ? "Publie une tenue depuis l'onglet Publier pour alimenter MongoDB."
          : `Aucun look ne correspond au filtre ${activeFilter}.`}
      </Text>
    </View>
  );
}

function StoryViewer({ story, onClose }: { story: FashionStory | null; onClose: () => void }) {
  if (!story) {
    return null;
  }
  const user = getUser(story.userId);
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.storyModal}>
        <Image source={{ uri: story.image }} style={styles.storyFullImage} />
        <LinearGradient colors={["rgba(0,0,0,0.82)", "transparent"]} style={styles.storyTopOverlay}>
          <View style={styles.storyProgressRow}>
            {[0, 1, 2].map((item) => (
              <View key={item} style={styles.storyProgressTrack}>
                <View style={[styles.storyProgressFill, item === 0 && { width: "70%" }]} />
              </View>
            ))}
          </View>
          <View style={styles.storyViewerHeader}>
            <Image source={{ uri: user.avatar }} style={styles.storyViewerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.storyViewerName}>{user.name}</Text>
              <Text style={styles.storyViewerTime}>{story.timestamp}</Text>
            </View>
            <Pressable onPress={onClose}>
              <X size={26} color={colors.white} />
            </Pressable>
          </View>
        </LinearGradient>
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.82)"]} style={styles.storyBottomOverlay}>
          <View style={styles.storyReply}>
            <TextInput placeholder="Envoyer un message..." placeholderTextColor="#d8d0ca" style={styles.storyInput} />
            <Heart size={24} color={colors.white} />
            <Send size={24} color={colors.white} />
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

function NotificationsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Notifications</Text>
            <Pressable onPress={onClose}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          {notifications.map((item) => {
            const user = getUser(item.userId);
            return (
              <View key={item.id} style={[styles.notificationRow, !item.read && styles.notificationUnread]}>
                <Image source={{ uri: user.avatar }} style={styles.notificationAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notificationText}>
                    <Text style={styles.username}>{user.name}</Text> {item.text}
                  </Text>
                  <Text style={styles.postMeta}>{item.timestamp}</Text>
                </View>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </View>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

function StylistModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [chat, setChat] = useState<Array<{ role: "user" | "ai"; text: string }>>([
    { role: "ai", text: "Je peux composer un look selon ton occasion, ta palette et tes pieces." },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) {
      return;
    }
    setChat((current) => [
      ...current,
      { role: "user", text: input.trim() },
      { role: "ai", text: "Je partirais sur une base neutre, une piece burgundy forte et un accessoire dore discret." },
    ]);
    setInput("");
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheetLarge}>
          <View style={styles.sheetHeader}>
            <View style={styles.stylistTitleRow}>
              <LinearGradient colors={[colors.burgundy, colors.roseLight]} style={styles.stylistIcon}>
                <Sparkles size={24} color={colors.white} />
              </LinearGradient>
              <Text style={styles.sheetTitle}>DressMe Stylist</Text>
            </View>
            <Pressable onPress={onClose}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.stylistIntro}>Votre assistant style personnel.</Text>
          <FlatList
            horizontal
            data={aiSuggestions}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.aiCards}
            renderItem={({ item }) => (
              <View style={styles.aiCard}>
                <Image source={{ uri: item.image }} style={styles.aiImage} />
                <Text style={styles.aiTitle}>{item.title}</Text>
                <Text style={styles.aiDescription}>{item.description}</Text>
                <View style={styles.aiActions}>
                  <Pressable style={styles.aiLike}>
                    <ThumbsUp size={15} color={colors.white} />
                    <Text style={styles.aiLikeText}>J'aime</Text>
                  </Pressable>
                  <Pressable style={styles.aiShare}>
                    <Share2 size={15} color={colors.burgundy} />
                  </Pressable>
                </View>
              </View>
            )}
          />
          <View style={styles.chatBox}>
            {chat.map((message, index) => (
              <View
                key={`${message.role}-${index}`}
                style={[styles.chatBubble, message.role === "user" ? styles.chatUser : styles.chatAI]}
              >
                <Text style={[styles.chatText, message.role === "user" && styles.chatTextUser]}>{message.text}</Text>
              </View>
            ))}
            <View style={styles.chatInputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Posez une question sur le style..."
                placeholderTextColor={colors.muted}
                style={styles.chatInput}
              />
              <Pressable style={styles.chatSend} onPress={sendMessage}>
                <Send size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingTop: 18,
    paddingBottom: 96,
    gap: 16,
  },
  headerBlock: {
    gap: 14,
  },
  header: {
    position: "relative",
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 29,
    fontWeight: "700",
    color: colors.burgundy,
  },
  headerSub: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    backgroundColor: colors.burgundy,
    color: colors.white,
    fontSize: 10,
    textAlign: "center",
    fontWeight: "800",
    overflow: "hidden",
    paddingTop: 1,
  },
  stories: {
    gap: 12,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  storyItem: {
    width: 74,
    alignItems: "center",
    gap: 5,
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  storyAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: colors.cream,
    backgroundColor: colors.beige,
  },
  storyName: {
    width: 70,
    textAlign: "center",
    fontSize: 11,
    color: colors.text,
    fontFamily: fonts.body,
  },
  filters: {
    gap: 8,
    paddingBottom: 2,
  },
  filterPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.burgundy,
    borderColor: colors.burgundy,
  },
  filterText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.white,
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
  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.beige,
  },
  postIdentity: {
    flex: 1,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "800",
  },
  postMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  postImage: {
    width: "100%",
    height: 320,
    backgroundColor: colors.beige,
  },
  pollBox: {
    padding: 12,
    gap: 10,
    backgroundColor: colors.cream,
  },
  pollQuestion: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  pollGrid: {
    flexDirection: "row",
    gap: 10,
  },
  pollOption: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pollOptionSelected: {
    borderColor: colors.burgundy,
    backgroundColor: "#FBF3F5",
  },
  pollImage: {
    width: "100%",
    height: 106,
    borderRadius: radius.sm,
  },
  pollLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.beige,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.burgundy,
  },
  pollPercent: {
    fontSize: 11,
    color: colors.burgundy,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "700",
  },
  helpButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.beige,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  helpText: {
    fontSize: 11,
    color: colors.burgundy,
    fontWeight: "800",
  },
  saveButton: {
    marginLeft: 2,
  },
  description: {
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  username: {
    fontWeight: "800",
    color: colors.text,
  },
  hashtags: {
    color: colors.burgundy,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: 14,
  },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
  },
  listFooter: {
    paddingVertical: 18,
  },
  storyModal: {
    flex: 1,
    backgroundColor: colors.black,
  },
  storyFullImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  storyTopOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 52,
    paddingHorizontal: 14,
    paddingBottom: 80,
  },
  storyProgressRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  storyProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  storyProgressFill: {
    width: "100%",
    height: 3,
    backgroundColor: colors.white,
  },
  storyViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  storyViewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  storyViewerName: {
    color: colors.white,
    fontWeight: "800",
  },
  storyViewerTime: {
    color: "#d8d0ca",
    fontSize: 12,
  },
  storyBottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 90,
    paddingBottom: 38,
  },
  storyReply: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storyInput: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    color: colors.white,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  sheet: {
    maxHeight: "75%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    gap: 10,
  },
  sheetLarge: {
    maxHeight: "88%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationUnread: {
    backgroundColor: colors.beige,
  },
  notificationAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  notificationText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.burgundy,
  },
  stylistTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stylistIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  stylistIntro: {
    color: colors.muted,
    fontSize: 14,
  },
  aiCards: {
    gap: 12,
  },
  aiCard: {
    width: 220,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiImage: {
    height: 150,
    borderRadius: radius.md,
  },
  aiTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  aiDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  aiActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiLike: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.burgundy,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  aiLikeText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 12,
  },
  aiShare: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBox: {
    gap: 8,
  },
  chatBubble: {
    maxWidth: "82%",
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatAI: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
  },
  chatUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.burgundy,
  },
  chatText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  chatTextUser: {
    color: colors.white,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    color: colors.text,
  },
  chatSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.burgundy,
    alignItems: "center",
    justifyContent: "center",
  },
});
