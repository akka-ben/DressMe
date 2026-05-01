import React, { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
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
  FashionPost,
  FashionStory,
  getUser,
  notifications,
  posts as initialPosts,
  stories as initialStories,
} from "../data/fashionData";
import { colors, fonts, radius, shadow } from "../theme/dressme";

const filters = ["Tous", "#casual", "#soirée", "#streetwear", "#glam", "#vintage"];

export function FeedScreen() {
  const [posts, setPosts] = useState(initialPosts);
  const [stories, setStories] = useState(initialStories);
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [activeStory, setActiveStory] = useState<FashionStory | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStylist, setShowStylist] = useState(false);
  const unreadNotifications = notifications.filter((item) => !item.read).length;

  const visiblePosts = useMemo(() => {
    if (activeFilter === "Tous") {
      return posts;
    }
    return posts.filter((post) => post.hashtags.includes(activeFilter));
  }, [activeFilter, posts]);

  const toggleLike = (postId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.likes + (post.isLiked ? -1 : 1),
            }
          : post,
      ),
    );
  };

  const toggleSave = (postId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, isSaved: !post.isSaved } : post,
      ),
    );
  };

  const votePoll = (postId: string, optionId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              pollOptions: post.pollOptions?.map((option) =>
                option.id === optionId ? { ...option, votes: option.votes + 1 } : option,
              ),
            }
          : post,
      ),
    );
  };

  const openStory = (story: FashionStory) => {
    setActiveStory(story);
    setStories((current) =>
      current.map((item) => (item.id === story.id ? { ...item, viewed: true } : item)),
    );
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>DressMe</Text>
          <Text style={styles.headerSub}>Mode sociale & IA stylist</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => setShowStylist(true)}>
            <Sparkles size={20} color={colors.burgundy} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setShowNotifications(true)}>
            <Bell size={20} color={colors.burgundy} />
            {unreadNotifications ? (
              <Text style={styles.notificationBadge}>{unreadNotifications}</Text>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
        {stories.map((story) => {
          const user = getUser(story.userId);
          return (
            <Pressable key={story.id} style={styles.storyItem} onPress={() => openStory(story)}>
              <LinearGradient
                colors={story.viewed ? [colors.border, colors.border] : [colors.burgundy, colors.roseLight]}
                style={styles.storyRing}
              >
                <Image source={{ uri: user.avatar }} style={styles.storyAvatar} />
              </LinearGradient>
              <Text numberOfLines={1} style={styles.storyName}>
                {story.userId === "me" ? "Votre Story" : user.name.split(" ")[0]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((filter) => {
          const active = filter === activeFilter;
          return (
            <Pressable
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.feedList}>
        {visiblePosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onHelp={() => setShowStylist(true)}
            onLike={() => toggleLike(post.id)}
            onSave={() => toggleSave(post.id)}
            onVote={(optionId) => votePoll(post.id, optionId)}
          />
        ))}
      </View>

      <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />
      <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
      <StylistModal visible={showStylist} onClose={() => setShowStylist(false)} />
    </View>
  );
}

function PostCard({
  post,
  onHelp,
  onLike,
  onSave,
  onVote,
}: {
  post: FashionPost;
  onHelp: () => void;
  onLike: () => void;
  onSave: () => void;
  onVote: (optionId: string) => void;
}) {
  const user = getUser(post.userId);
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
          <Text style={styles.postMeta}>@{user.username} · {post.timestamp}</Text>
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
              return (
                <Pressable key={option.id} style={styles.pollOption} onPress={() => onVote(option.id)}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiCards}>
            {aiSuggestions.map((suggestion) => (
              <View key={suggestion.id} style={styles.aiCard}>
                <Image source={{ uri: suggestion.image }} style={styles.aiImage} />
                <Text style={styles.aiTitle}>{suggestion.title}</Text>
                <Text style={styles.aiDescription}>{suggestion.description}</Text>
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
            ))}
          </ScrollView>
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
  feedList: {
    gap: 16,
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
