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
  Alert,
  FlatList,
  Image,
  ListRenderItem,
  Modal,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AtSign,
  Bell,
  Bookmark,
  CheckCircle2,
  Eye,
  Heart,
  HelpCircle,
  MessageCircle,
  MoreHorizontal,
  PlusSquare,
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
  users as demoUsers,
} from "../data/fashionData";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { Post, Story, User } from "../types/contracts";

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
  shareCount: number;
  timestamp: string;
  isLiked: boolean;
  isSaved: boolean;
  isPoll?: boolean;
  pollQuestion?: string;
  pollOptions?: Array<{ id: string; image: string; label: string; votes: number }>;
  selectedPollOptionId?: string;
};

type FeedStory = {
  id: string;
  sourceStoryId?: string;
  userId: string;
  image: string;
  mediaType: "image" | "video";
  timestamp: string;
  viewed: boolean;
  viewerCount: number;
  author: FeedAuthor;
};

type HomeFeedScreenProps = {
  onOpenPost?: (postId: string) => void;
  onOpenCreate?: () => void;
  onOpenProfile?: (userId: string) => void;
};

export function HomeFeedScreen({ onOpenPost, onOpenCreate, onOpenProfile }: HomeFeedScreenProps) {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<FeedStory[]>(() => initialStories.map(mapFashionStory));
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [activeStory, setActiveStory] = useState<FeedStory | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStylist, setShowStylist] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [actionPost, setActionPost] = useState<FeedPost | null>(null);
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

  const fetchStories = useCallback(async () => {
    const apiStories = await client.getStories({
      token: token ?? undefined,
      limit: 24,
    });
    setStories(
      apiStories.length
        ? apiStories.map((story) => mapApiStory(story, user?.id))
        : initialStories.map(mapFashionStory),
    );
  }, [token, user?.id]);

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
    fetchStories().catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [fetchFeedPage, fetchStories]);

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
    const targetPost = posts.find((post) => post.feedId === feedId);
    setPosts((current) =>
      current.map((post) =>
        post.feedId === feedId ? { ...post, isSaved: !post.isSaved } : post,
      ),
    );

    if (!token || !targetPost) {
      return;
    }

    client
      .togglePostSave(targetPost.sourcePostId, token)
      .then((updatedPost) => {
        const mappedPost = mapApiPost(updatedPost);
        setPosts((current) =>
          current.map((post) =>
            post.feedId === feedId
              ? { ...mappedPost, feedId, selectedPollOptionId: post.selectedPollOptionId }
              : post,
          ),
        );
      })
      .catch(() => {
        setPosts((current) =>
          current.map((post) =>
            post.feedId === feedId ? { ...post, isSaved: !post.isSaved } : post,
          ),
        );
      });
  }, [posts, token]);

  const sharePost = useCallback(
    async (post: FeedPost) => {
      try {
        const result = await Share.share({
          title: "DressMe",
          message: `${post.author.name} sur DressMe\n\n${post.description}\n${post.hashtags.join(" ")}\n${post.image}`,
          url: post.image,
        });

        if (result.action === Share.dismissedAction || !token) {
          return;
        }

        const updatedPost = await client.sharePost(post.sourcePostId, token);
        const mappedPost = mapApiPost(updatedPost);
        setPosts((current) =>
          current.map((item) =>
            item.feedId === post.feedId
              ? {
                  ...mappedPost,
                  feedId: item.feedId,
                  selectedPollOptionId: item.selectedPollOptionId,
                }
              : item,
          ),
        );
      } catch (shareError) {
        Alert.alert(
          "Partage impossible",
          shareError instanceof Error ? shareError.message : "Le partage a echoue.",
        );
      }
    },
    [token],
  );

  const hidePost = useCallback((feedId: string) => {
    setPosts((current) => current.filter((post) => post.feedId !== feedId));
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

  const openStory = useCallback((story: FeedStory) => {
    setActiveStory(story);
    setStories((current) =>
      current.map((item) => (item.id === story.id ? { ...item, viewed: true } : item)),
    );
    const isOwnStory = story.userId === "me" || story.author.id === user?.id;
    if (token && story.sourceStoryId && !isOwnStory) {
      client.markStoryViewed(story.sourceStoryId, token).catch(() => undefined);
    }
  }, [token, user?.id]);

  const refreshFeed = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchFeedPage(0, true), fetchStories()])
      .catch((error: unknown) => {
        setFeedError(error instanceof Error ? error.message : "Impossible de rafraichir le feed.");
      })
      .finally(() => {
      setRefreshing(false);
      loadLockRef.current = false;
      });
  }, [fetchFeedPage, fetchStories]);

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
        onOpen={() => onOpenPost?.(item.sourcePostId)}
        onOpenProfile={() => onOpenProfile?.(item.author.id)}
        onHelp={() => setShowStylist(true)}
        onLike={() => toggleLike(item.feedId)}
        onSave={() => toggleSave(item.feedId)}
        onShare={() => void sharePost(item)}
        onOpenMenu={() => setActionPost(item)}
        onVote={(optionId) => votePoll(item.feedId, optionId)}
      />
    ),
    [onOpenPost, onOpenProfile, sharePost, toggleLike, toggleSave, votePoll],
  );

  return (
    <View style={styles.shell}>
      <FlatList
        style={styles.feedList}
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
            onOpenCreate={onOpenCreate}
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

      <StoryViewer
        story={activeStory}
        token={token ?? undefined}
        currentUserId={user?.id}
        onClose={() => setActiveStory(null)}
      />
      <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
      <StylistModal visible={showStylist} onClose={() => setShowStylist(false)} />
      <PostActionSheet
        post={actionPost}
        onClose={() => setActionPost(null)}
        onOpen={() => {
          if (actionPost) {
            onOpenPost?.(actionPost.sourcePostId);
            setActionPost(null);
          }
        }}
        onShare={() => {
          if (actionPost) {
            void sharePost(actionPost);
            setActionPost(null);
          }
        }}
        onSave={() => {
          if (actionPost) {
            toggleSave(actionPost.feedId);
            setActionPost(null);
          }
        }}
        onHide={() => {
          if (actionPost) {
            hidePost(actionPost.feedId);
            setActionPost(null);
          }
        }}
      />
    </View>
  );
}

function FeedHeader({
  activeFilter,
  stories,
  unreadNotifications,
  onFilterChange,
  onOpenCreate,
  onOpenNotifications,
  onOpenStory,
  onOpenStylist,
}: {
  activeFilter: string;
  stories: FeedStory[];
  unreadNotifications: number;
  onFilterChange: (filter: string) => void;
  onOpenCreate?: () => void;
  onOpenNotifications: () => void;
  onOpenStory: (story: FeedStory) => void;
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
          {onOpenCreate ? (
            <Pressable style={styles.iconButton} onPress={onOpenCreate}>
              <PlusSquare size={20} color={colors.burgundy} />
            </Pressable>
          ) : null}
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
          const user = item.author;
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
    shareCount: post.shareCount,
    timestamp: formatRelativeDate(post.createdAt),
    isLiked: post.likedByMe,
    isSaved: post.savedByMe,
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

function mapFashionStory(story: FashionStory): FeedStory {
  const user = getUser(story.userId);
  return {
    id: story.id,
    userId: story.userId,
    image: story.image,
    mediaType: "image",
    timestamp: story.timestamp,
    viewed: story.viewed,
    viewerCount: 0,
    author: {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      verified: user.verified,
    },
  };
}

function mapApiStory(story: Story, currentUserId?: string): FeedStory {
  const author = mapApiUserToAuthor(story.author);
  return {
    id: story.id,
    sourceStoryId: story.id,
    userId: currentUserId && story.author.id === currentUserId ? "me" : story.author.id,
    image: story.mediaUrl,
    mediaType: story.mediaType,
    timestamp: formatRelativeDate(story.createdAt),
    viewed: story.viewedByMe,
    viewerCount: story.viewerCount,
    author,
  };
}

function demoMentionFollowers(): FeedAuthor[] {
  return demoUsers
    .filter((item) => item.id !== "me")
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      name: item.name,
      username: item.username,
      avatar: item.avatar,
      verified: item.verified,
    }));
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
  onOpen,
  onOpenProfile,
  onHelp,
  onLike,
  onSave,
  onShare,
  onOpenMenu,
  onVote,
}: {
  post: FeedPost;
  onOpen: () => void;
  onOpenProfile: () => void;
  onHelp: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onOpenMenu: () => void;
  onVote: (optionId: string) => void;
}) {

  const user = post.author;
  const totalVotes = post.pollOptions?.reduce((sum, option) => sum + option.votes, 0) ?? 0;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Pressable onPress={onOpenProfile}>
          <Image source={{ uri: user.avatar }} style={styles.postAvatar} />
        </Pressable>
        <View style={styles.postIdentity}>
          <View style={styles.nameLine}>
            <Text style={styles.postName}>{user.name}</Text>
            {user.verified ? <CheckCircle2 size={14} color={colors.gold} fill={colors.gold} /> : null}
          </View>
          <Text style={styles.postMeta}>
            @{user.username} · {post.timestamp}
          </Text>
        </View>
        <Pressable style={styles.menuButton} onPress={onOpenMenu}>
          <MoreHorizontal size={21} color={colors.muted} />
        </Pressable>
      </View>

      <Pressable onPress={onOpen}>
        <Image source={{ uri: post.image }} style={styles.postImage} />
      </Pressable>

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
        <Pressable style={styles.actionItem} onPress={onOpen}>
          <MessageCircle size={21} color={colors.muted} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </Pressable>
        <Pressable style={styles.actionItem} onPress={onShare}>
          <Share2 size={21} color={colors.muted} />
          {post.shareCount > 0 ? <Text style={styles.actionText}>{post.shareCount}</Text> : null}
        </Pressable>
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

      <Pressable onPress={onOpen}>
        <Text style={styles.description}>
          <Text style={styles.username}>{user.username}</Text> {post.description}
        </Text>
        <Text style={styles.hashtags}>{post.hashtags.join(" ")}</Text>
      </Pressable>
    </View>
  );
});

function PostActionSheet({
  post,
  onClose,
  onOpen,
  onShare,
  onSave,
  onHide,
}: {
  post: FeedPost | null;
  onClose: () => void;
  onOpen: () => void;
  onShare: () => void;
  onSave: () => void;
  onHide: () => void;
}) {
  const visible = Boolean(post);

  const reportPost = () => {
    onClose();
    Alert.alert("Signalement recu", "Cette publication sera examinee par DressMe.");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.actionSheetBackdrop} onPress={onClose}>
        <Pressable style={styles.actionSheet}>
          <View style={styles.actionSheetHandle} />
          <Text style={styles.actionSheetTitle}>
            {post ? `@${post.author.username}` : "Publication"}
          </Text>
          <Pressable style={styles.sheetOption} onPress={onOpen}>
            <Text style={styles.sheetOptionText}>Voir la publication</Text>
          </Pressable>
          <Pressable style={styles.sheetOption} onPress={onShare}>
            <Text style={styles.sheetOptionText}>Partager</Text>
          </Pressable>
          <Pressable style={styles.sheetOption} onPress={onSave}>
            <Text style={styles.sheetOptionText}>
              {post?.isSaved ? "Retirer des enregistrements" : "Enregistrer"}
            </Text>
          </Pressable>
          <Pressable style={styles.sheetOption} onPress={onHide}>
            <Text style={styles.sheetOptionText}>Masquer cette publication</Text>
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

function StoryViewer({
  story,
  token,
  currentUserId,
  onClose,
}: {
  story: FeedStory | null;
  token?: string;
  currentUserId?: string;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState("");
  const [liked, setLiked] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [showSendTargets, setShowSendTargets] = useState(false);
  const [viewers, setViewers] = useState<FeedAuthor[]>([]);
  const [followers, setFollowers] = useState<FeedAuthor[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const progressRef = useRef(0);

  const isOwnStory = Boolean(story && (story.userId === "me" || story.author.id === currentUserId));
  const timerPaused = showViewers || showMentions || showSendTargets;

  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
    setReply("");
    setLiked(false);
    setShowViewers(false);
    setShowMentions(false);
    setShowSendTargets(false);
    setViewers([]);
    setFollowers([]);
  }, [story?.id]);

  useEffect(() => {
    if (!story || timerPaused) {
      return undefined;
    }

    const durationMs = story.mediaType === "video" ? 15000 : 8000;
    const startedAt = Date.now() - progressRef.current * durationMs;
    const interval = setInterval(() => {
      const nextProgress = Math.min(1, (Date.now() - startedAt) / durationMs);
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      if (nextProgress >= 1) {
        clearInterval(interval);
        onClose();
      }
    }, 80);

    return () => clearInterval(interval);
  }, [onClose, story, timerPaused]);

  const loadViewers = async () => {
    if (!story?.sourceStoryId || !token) {
      setViewers([]);
      setShowViewers(true);
      return;
    }

    setLoadingViewers(true);
    setShowViewers(true);
    try {
      const apiViewers = await client.getStoryViewers(story.sourceStoryId, token);
      setViewers(apiViewers.map(mapApiUserToAuthor));
    } catch (error) {
      Alert.alert(
        "Vues indisponibles",
        error instanceof Error ? error.message : "Impossible de charger les vues de cette story.",
      );
    } finally {
      setLoadingViewers(false);
    }
  };

  const loadFollowerCandidates = async () => {
    setLoadingFollowers(true);
    try {
      const apiFollowers = token ? await client.getFollowers(token) : [];
      setFollowers(apiFollowers.length ? apiFollowers.map(mapApiUserToAuthor) : demoMentionFollowers());
    } catch {
      setFollowers(demoMentionFollowers());
    } finally {
      setLoadingFollowers(false);
    }
  };

  const openMentionSheet = async () => {
    setShowMentions(true);
    await loadFollowerCandidates();
  };

  const openSendSheet = async () => {
    setShowSendTargets(true);
    await loadFollowerCandidates();
  };

  const sendReply = () => {
    if (!reply.trim()) {
      return;
    }
    Alert.alert("Message envoye", "Ta reponse a la story a ete preparee.");
    setReply("");
    onClose();
  };

  const mentionFollower = (follower: FeedAuthor) => {
    Alert.alert("Mention ajoutee", `@${follower.username} sera mentionne(e) dans ta story.`);
    setShowMentions(false);
  };

  const sendStoryTo = (follower: FeedAuthor) => {
    Alert.alert("Story envoyee", `Ta story a ete envoyee a @${follower.username}.`);
    setShowSendTargets(false);
  };

  if (!story) {
    return null;
  }

  const user = story.author;
  const progressWidth = `${Math.round(progress * 100)}%` as `${number}%`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.storyModal}>
        <Image source={{ uri: story.image }} style={styles.storyFullImage} />

        <LinearGradient colors={["rgba(0,0,0,0.88)", "rgba(0,0,0,0.18)", "transparent"]} style={styles.storyTopOverlay}>
          <View style={styles.storyProgressTrack}>
            <View style={[styles.storyProgressFill, { width: progressWidth }]} />
          </View>
          <View style={styles.storyViewerHeader}>
            <Image source={{ uri: user.avatar }} style={styles.storyViewerAvatar} />
            <View style={styles.storyHeaderText}>
              <Text style={styles.storyViewerName}>{isOwnStory ? "Your story" : user.name}</Text>
              <Text style={styles.storyViewerTime}>{story.timestamp}</Text>
            </View>
            {isOwnStory ? (
              <Pressable style={styles.storyHeaderIcon} onPress={() => Alert.alert("Options", "Options de story a connecter dans la phase suivante.")}>
                <MoreHorizontal size={25} color={colors.white} />
              </Pressable>
            ) : null}
            <Pressable style={styles.storyHeaderIcon} onPress={onClose}>
              <X size={30} color={colors.white} />
            </Pressable>
          </View>
        </LinearGradient>

        <LinearGradient colors={["transparent", "rgba(0,0,0,0.88)"]} style={styles.storyBottomOverlay}>
          {isOwnStory ? (
            <View style={styles.ownerStoryActions}>
              <StoryOwnerAction
                icon={<Eye size={22} color={colors.white} />}
                label="Activite"
                subLabel={`${story.viewerCount} vues`}
                onPress={() => void loadViewers()}
              />
              <StoryOwnerAction
                icon={<Share2 size={22} color={colors.white} />}
                label="Partager"
                onPress={() => void Share.share({ message: story.image, url: story.image })}
              />
              <StoryOwnerAction
                icon={<AtSign size={24} color={colors.white} />}
                label="Mention"
                onPress={() => void openMentionSheet()}
              />
              <StoryOwnerAction
                icon={<Send size={23} color={colors.white} />}
                label="Envoyer"
                onPress={() => void openSendSheet()}
              />
              <StoryOwnerAction
                icon={<MoreHorizontal size={24} color={colors.white} />}
                label="Plus"
                onPress={() => Alert.alert("Plus", "Options supplementaires de story.")}
              />
            </View>
          ) : (
            <View style={styles.storyReply}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Envoyer un message..."
                placeholderTextColor="#d8d0ca"
                style={styles.storyInput}
              />
              <Pressable onPress={() => setLiked((current) => !current)}>
                <Heart
                  size={27}
                  color={colors.white}
                  fill={liked ? colors.white : "transparent"}
                />
              </Pressable>
              <Pressable onPress={sendReply}>
                <Send size={28} color={colors.white} />
              </Pressable>
            </View>
          )}
        </LinearGradient>

        <StoryViewersSheet
          visible={showViewers}
          viewers={viewers}
          loading={loadingViewers}
          onClose={() => setShowViewers(false)}
        />
        <StoryMentionSheet
          visible={showMentions}
          title="Mention"
          subtitle="Choisir parmi tes followers"
          actionLabel="Mentionner"
          loadingText="Chargement des followers..."
          followers={followers}
          loading={loadingFollowers}
          onSelect={mentionFollower}
          onClose={() => setShowMentions(false)}
        />
        <StoryMentionSheet
          visible={showSendTargets}
          title="Envoyer a"
          subtitle="Choisir les destinataires"
          actionLabel="Envoyer"
          loadingText="Chargement des destinataires..."
          followers={followers}
          loading={loadingFollowers}
          onSelect={sendStoryTo}
          onClose={() => setShowSendTargets(false)}
        />
      </View>
    </Modal>
  );
}

function StoryOwnerAction({
  icon,
  label,
  subLabel,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.ownerStoryAction} onPress={onPress}>
      <View style={styles.ownerStoryIcon}>{icon}</View>
      <Text style={styles.ownerStoryLabel}>{label}</Text>
      <Text style={[styles.ownerStorySubLabel, !subLabel && styles.ownerStorySubLabelHidden]}>
        {subLabel || "0 vues"}
      </Text>
    </Pressable>
  );
}

function StoryViewersSheet({
  visible,
  viewers,
  loading,
  onClose,
}: {
  visible: boolean;
  viewers: FeedAuthor[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.storySheetBackdrop} onPress={onClose}>
        <Pressable style={styles.storySheet}>
          <View style={styles.actionSheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Activite</Text>
              <Text style={styles.storySheetSubtitle}>{viewers.length} vues</Text>
            </View>
            <Pressable onPress={onClose}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.storySheetState}>
              <ActivityIndicator color={colors.burgundy} />
              <Text style={styles.emptyText}>Chargement des vues...</Text>
            </View>
          ) : viewers.length ? (
            viewers.map((viewer) => (
              <View key={viewer.id} style={styles.storyPersonRow}>
                <Image source={{ uri: viewer.avatar }} style={styles.storyPersonAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.storyPersonName}>{viewer.name}</Text>
                  <Text style={styles.storyPersonMeta}>@{viewer.username}</Text>
                </View>
                <Eye size={18} color={colors.burgundy} />
              </View>
            ))
          ) : (
            <View style={styles.storySheetState}>
              <Text style={styles.emptyTitle}>Aucune vue pour le moment</Text>
              <Text style={styles.emptyText}>Les personnes qui voient ta story apparaitront ici.</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StoryMentionSheet({
  visible,
  title,
  subtitle,
  actionLabel,
  loadingText,
  followers,
  loading,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  actionLabel: string;
  loadingText: string;
  followers: FeedAuthor[];
  loading: boolean;
  onSelect: (follower: FeedAuthor) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.storySheetBackdrop} onPress={onClose}>
        <Pressable style={styles.storySheet}>
          <View style={styles.actionSheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.storySheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.storySheetState}>
              <ActivityIndicator color={colors.burgundy} />
              <Text style={styles.emptyText}>{loadingText}</Text>
            </View>
          ) : followers.length === 0 ? (
            <View style={styles.storySheetState}>
              <Text style={styles.emptyTitle}>Aucun utilisateur disponible</Text>
              <Text style={styles.emptyText}>Les utilisateurs disponibles apparaitront ici.</Text>
            </View>
          ) : (
            followers.map((follower) => (
              <Pressable key={follower.id} style={styles.storyPersonRow} onPress={() => onSelect(follower)}>
                <Image source={{ uri: follower.avatar }} style={styles.storyPersonAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.storyPersonName}>{follower.name}</Text>
                  <Text style={styles.storyPersonMeta}>@{follower.username}</Text>
                </View>
                <Text style={styles.mentionAction}>{actionLabel}</Text>
              </Pressable>
            ))
          )}
        </Pressable>
      </Pressable>
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
    minHeight: "100%",
    backgroundColor: colors.cream,
  },
  feedList: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.cream,
  },
  listContent: {
    flexGrow: 1,
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
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
    paddingBottom: 120,
  },
  storyProgressRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  storyProgressTrack: {
    width: "100%",
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
    marginBottom: 14,
  },
  storyProgressFill: {
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
  storyHeaderText: {
    flex: 1,
  },
  storyViewerName: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
  storyViewerTime: {
    color: "#d8d0ca",
    fontSize: 12,
  },
  storyHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
  ownerStoryActions: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  ownerStoryAction: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  ownerStoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  ownerStoryLabel: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  ownerStorySubLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    minHeight: 12,
  },
  ownerStorySubLabelHidden: {
    opacity: 0,
  },
  storySheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  storySheet: {
    maxHeight: "64%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 10,
  },
  storySheetSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  storySheetState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  storyPersonRow: {
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storyPersonAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.beige,
  },
  storyPersonName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  storyPersonMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  mentionAction: {
    color: colors.burgundy,
    fontWeight: "900",
    fontSize: 12,
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
  actionSheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  actionSheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 8,
  },
  actionSheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  actionSheetTitle: {
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
