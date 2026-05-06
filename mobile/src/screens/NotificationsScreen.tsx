import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AtSign,
  Bell,
  Bookmark,
  Grid2X2,
  Heart,
  Lock,
  MessageCircle,
  Radio,
  Repeat2,
  ShoppingBag,
  UserPlus,
  X,
} from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { ActivityNotification, Post, Profile, User } from "../types/contracts";

type ActivityTab = "you" | "following";
type FilterKey = ActivityNotification["filterKey"];
type NotificationSection = {
  title: string;
  data: ActivityNotification[];
};

type Props = {
  onClose: () => void;
  onOpenPost?: (postId: string) => void;
  onUnreadChange?: (count: number) => void;
};

const tabs: Array<{ key: ActivityTab; label: string }> = [
  { key: "you", label: "Vous" },
  { key: "following", label: "Abonnements" },
];

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tout" },
  { key: "requests", label: "Demandes" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Commentaires" },
  { key: "mentions", label: "Mentions" },
  { key: "follows", label: "Follows" },
  { key: "live", label: "Live" },
  { key: "stories", label: "Stories" },
  { key: "shopping", label: "Shopping" },
  { key: "suggestions", label: "Suggestions" },
];

export function NotificationsScreen({ onClose, onOpenPost, onUnreadChange }: Props) {
  const { token } = useAuth();
  const [items, setItems] = useState<ActivityNotification[]>([]);
  const [activeTab, setActiveTab] = useState<ActivityTab>("you");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyActionId, setBusyActionId] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  const markReadLocally = useCallback(
    (ids: string[]) => {
      if (!ids.length) {
        return;
      }
      setItems((current) =>
        current.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)),
      );
    },
    [],
  );

  const markRead = useCallback(
    (ids: string[]) => {
      if (!token || !ids.length) {
        return;
      }
      markReadLocally(ids);
      client.markNotificationsRead({ token, notificationIds: ids }).catch(() => undefined);
    },
    [markReadLocally, token],
  );

  const loadNotifications = useCallback(
    async (refresh = false) => {
      if (!token) {
        setItems([]);
        setLoading(false);
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const response = await client.getNotifications({ token, limit: 100 });
        setItems(response);
        const unreadIds = response.filter((item) => !item.read).map((item) => item.id);
        if (unreadIds.length) {
          markRead(unreadIds);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les notifications.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [markRead, token],
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (item.tab !== activeTab) {
        return false;
      }
      return activeFilter === "all" || item.filterKey === activeFilter;
    });
  }, [activeFilter, activeTab, items]);

  const sections = useMemo(() => groupNotifications(visibleItems), [visibleItems]);
  const countsByFilter = useMemo(() => buildFilterCounts(items, activeTab), [activeTab, items]);
  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [onUnreadChange, unreadCount]);

  const openNotification = useCallback(
    (item: ActivityNotification) => {
      markRead([item.id]);

      if ((item.targetType === "post" || item.targetType === "shopping") && item.targetId) {
        onOpenPost?.(item.targetId);
        onClose();
        return;
      }

      if (item.targetType === "profile" && item.targetId) {
        setProfileId(item.targetId);
        return;
      }

      const actorId = item.actors[0]?.id;
      if ((item.targetType === "live" || item.targetType === "story") && actorId) {
        setProfileId(actorId);
      }
    },
    [markRead, onClose, onOpenPost],
  );

  const runInlineAction = useCallback(
    async (item: ActivityNotification) => {
      if (!token) {
        return;
      }

      if (item.action === "open" || item.action === "view_request") {
        openNotification(item);
        return;
      }

      if (item.action !== "follow_back") {
        return;
      }

      const targetUserId = item.targetId ?? item.actors[0]?.id;
      if (!targetUserId) {
        return;
      }

      setBusyActionId(item.id);
      try {
        markRead([item.id]);
        const profile = await client.followUser(targetUserId, token);
        const nextLabel = profile.followStatus === "requested" ? "Demande envoyee" : "Suivi";
        setItems((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, action: "none", actionLabel: nextLabel }
              : notification,
          ),
        );
      } finally {
        setBusyActionId("");
      }
    },
    [openNotification, token],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Activite</Text>
          <Text style={styles.subtitle}>
            {unreadCount ? `${unreadCount} nouvelle(s) notification(s)` : "Tout est a jour"}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          const count = items.filter((item) => item.tab === tab.key).length;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              onPress={() => {
                setActiveTab(tab.key);
                setActiveFilter("all");
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              <Text style={[styles.tabCount, active && styles.tabTextActive]}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        style={styles.filterScroller}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {filters.map((filter) => {
          const count = countsByFilter[filter.key] ?? 0;
          if (filter.key !== "all" && count === 0) {
            return null;
          }
          const active = activeFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              accessibilityRole="button"
              onPress={() => setActiveFilter(filter.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {filter.label}{filter.key !== "all" ? ` ${count}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityState label="Chargement de l'activite..." loading />
      ) : error ? (
        <ActivityState label={error} />
      ) : (
        <SectionList<ActivityNotification, NotificationSection>
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              busy={busyActionId === item.id}
              onPress={() => openNotification(item)}
              onAction={() => void runInlineAction(item)}
            />
          )}
          ListEmptyComponent={<ActivityState label="Aucune notification pour ce filtre." />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadNotifications(true)}
              tintColor={colors.burgundy}
              colors={[colors.burgundy]}
            />
          }
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      <ProfilePreviewSheet
        userId={profileId}
        onClose={() => setProfileId(null)}
        onOpenPost={(postId) => {
          setProfileId(null);
          onOpenPost?.(postId);
          onClose();
        }}
      />
    </View>
  );
}

function NotificationRow({
  item,
  busy,
  onPress,
  onAction,
}: {
  item: ActivityNotification;
  busy: boolean;
  onPress: () => void;
  onAction: () => void;
}) {
  const actor = item.actors[0];
  const avatar = actorAvatar(actor);
  const Icon = notificationIcon(item.type);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.notificationRow, !item.read && styles.unreadRow]}
    >
      <View style={styles.avatarWrap}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.typeBadge}>
          <Icon size={13} color={colors.white} strokeWidth={2.4} />
        </View>
      </View>

      <View style={styles.notificationBody}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        {item.body ? <Text style={styles.notificationText} numberOfLines={2}>{item.body}</Text> : null}
        <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
      </View>

      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
      ) : null}

      {item.action !== "none" && item.actionLabel ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onAction}
          style={[styles.inlineAction, item.action === "follow_back" && styles.followAction]}
        >
          {busy ? <ActivityIndicator size="small" color={colors.white} /> : null}
          <Text style={styles.inlineActionText}>{item.actionLabel}</Text>
        </Pressable>
      ) : item.actionLabel ? (
        <View style={styles.doneAction}>
          <Text style={styles.doneActionText}>{item.actionLabel}</Text>
        </View>
      ) : null}

      {!item.read ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

function ProfilePreviewSheet({
  userId,
  onClose,
  onOpenPost,
}: {
  userId: string | null;
  onClose: () => void;
  onOpenPost: (postId: string) => void;
}) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setPosts([]);
      return;
    }

    let mounted = true;
    setLoading(true);
    Promise.all([
      client.getProfile(userId, { token: token ?? undefined }),
      client.getProfilePosts({ userId, token: token ?? undefined, limit: 12 }),
    ])
      .then(([profileResponse, postResponse]) => {
        if (!mounted) {
          return;
        }
        setProfile(profileResponse);
        setPosts(postResponse);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token, userId]);

  const onFollowPress = async () => {
    if (!token || !profile || profile.followStatus === "self") {
      return;
    }
    setBusy(true);
    try {
      const updated =
        profile.followStatus === "following" || profile.followStatus === "requested"
          ? await client.unfollowUser(profile.id, token)
          : await client.followUser(profile.id, token);
      setProfile(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={Boolean(userId)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.profileBackdrop}>
        <View style={styles.profileSheet}>
          <View style={styles.profileSheetHandle} />
          <View style={styles.profileHeader}>
            <Text style={styles.profileUsername}>{profile ? username(profile) : "Profil"}</Text>
            <Pressable onPress={onClose} style={styles.profileClose}>
              <X size={22} color={colors.text} />
            </Pressable>
          </View>

          {loading || !profile ? (
            <ActivityState label="Chargement du profil..." loading />
          ) : (
            <>
              <View style={styles.profileSummary}>
                <Image source={{ uri: actorAvatar(profile) }} style={styles.profileAvatar} />
                <View style={styles.profileIdentity}>
                  <Text style={styles.profileName}>{displayName(profile)}</Text>
                  <Text style={styles.profileBio} numberOfLines={2}>
                    {profile.bio || "Profil DressMe"}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <Stat label="posts" value={profile.postCount} />
                <Stat label="followers" value={profile.followerCount} />
                <Stat label="following" value={profile.followingCount} />
              </View>

              {profile.followStatus !== "self" ? (
                <Pressable
                  disabled={busy}
                  onPress={() => void onFollowPress()}
                  style={[
                    styles.profileAction,
                    profile.followStatus !== "not_following" && styles.profileActionSecondary,
                  ]}
                >
                  {busy ? <ActivityIndicator size="small" color={profile.followStatus === "not_following" ? colors.white : colors.burgundy} /> : null}
                  <Text
                    style={[
                      styles.profileActionText,
                      profile.followStatus !== "not_following" && styles.profileActionTextSecondary,
                    ]}
                  >
                    {profileActionLabel(profile)}
                  </Text>
                </Pressable>
              ) : null}

              {profile.canViewPosts ? (
                <View style={styles.profileGrid}>
                  {posts.slice(0, 9).map((post) => {
                    const mediaUrl = post.imageUrls[0];
                    return (
                      <Pressable
                        key={post.id}
                        onPress={() => onOpenPost(post.id)}
                        style={styles.profileTile}
                      >
                        {mediaUrl ? <Image source={{ uri: mediaUrl }} style={styles.profileTileImage} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.privateState}>
                  <Lock size={44} color={colors.text} />
                  <Text style={styles.privateTitle}>Ce profil est prive</Text>
                  <Text style={styles.privateText}>
                    Abonnez-vous a ce profil pour voir ses photos et videos.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ActivityState({ label, loading = false }: { label: string; loading?: boolean }) {
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator color={colors.burgundy} /> : <Bell size={28} color={colors.burgundy} />}
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{formatCount(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function groupNotifications(items: ActivityNotification[]): NotificationSection[] {
  const buckets: NotificationSection[] = [
    { title: "Aujourd'hui", data: [] },
    { title: "Cette semaine", data: [] },
    { title: "Ce mois-ci", data: [] },
    { title: "Plus ancien", data: [] },
  ];

  items.forEach((item) => {
    buckets[bucketIndex(item.createdAt)].data.push(item);
  });

  return buckets.filter((bucket) => bucket.data.length > 0);
}

function buildFilterCounts(items: ActivityNotification[], tab: ActivityTab): Record<FilterKey, number> {
  const counts = filters.reduce(
    (acc, filter) => ({ ...acc, [filter.key]: 0 }),
    {} as Record<FilterKey, number>,
  );
  items.filter((item) => item.tab === tab).forEach((item) => {
    counts.all += 1;
    counts[item.filterKey] = (counts[item.filterKey] ?? 0) + 1;
  });
  return counts;
}

function bucketIndex(isoDate: string): number {
  const createdAt = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (createdAt.toDateString() === now.toDateString()) {
    return 0;
  }
  if (diffMs < 7 * dayMs) {
    return 1;
  }
  if (diffMs < 31 * dayMs) {
    return 2;
  }
  return 3;
}

function notificationIcon(type: ActivityNotification["type"]) {
  switch (type) {
    case "like":
      return Heart;
    case "comment":
      return MessageCircle;
    case "save":
      return Bookmark;
    case "share":
      return Repeat2;
    case "follow":
    case "follow_request":
    case "suggestion":
      return UserPlus;
    case "mention":
    case "tag":
      return AtSign;
    case "live":
      return Radio;
    case "shopping":
      return ShoppingBag;
    default:
      return Grid2X2;
  }
}

function actorAvatar(user?: User): string {
  return user?.avatarUrl || `https://api.dicebear.com/8.x/avataaars/png?seed=${encodeURIComponent(user?.id ?? "dressme")}`;
}

function displayName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username || user.email.split("@")[0] || "DressMe";
}

function username(user: User): string {
  return user.username ? `@${user.username}` : `@${user.email.split("@")[0] || user.id}`;
}

function profileActionLabel(profile: Profile): string {
  if (profile.followStatus === "following") {
    return "Abonne";
  }
  if (profile.followStatus === "requested") {
    return "Demande envoyee";
  }
  return profile.isPrivate ? "Demander" : "Suivre";
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffSeconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return "maintenant";
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} j`;
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 52,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.beige,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.burgundy,
  },
  tabText: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  filters: {
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterScroller: {
    flexGrow: 0,
    maxHeight: 58,
  },
  filterChip: {
    height: 36,
    borderRadius: 999,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.burgundy,
    borderColor: colors.burgundy,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  filterTextActive: {
    color: colors.white,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 28,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 8,
  },
  notificationRow: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreadRow: {
    backgroundColor: "#FFF8FA",
    borderColor: "rgba(123,30,49,0.22)",
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.beige,
  },
  typeBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 23,
    height: 23,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.burgundy,
    borderWidth: 2,
    borderColor: colors.white,
  },
  notificationBody: {
    flex: 1,
    gap: 3,
  },
  notificationTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  notificationText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  timeText: {
    color: colors.burgundy,
    fontSize: 11,
    fontWeight: "900",
  },
  thumbnail: {
    width: 50,
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: colors.beige,
  },
  inlineAction: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.black,
  },
  followAction: {
    backgroundColor: colors.burgundy,
  },
  inlineActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
  },
  doneAction: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.burgundy,
  },
  doneActionText: {
    color: colors.burgundy,
    fontSize: 12,
    fontWeight: "900",
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.burgundy,
  },
  state: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  stateText: {
    color: colors.muted,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 20,
  },
  profileBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  profileSheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    ...shadow.card,
  },
  profileSheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  profileUsername: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  profileClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  profileSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.beige,
  },
  profileIdentity: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  profileBio: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 18,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  profileAction: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.burgundy,
    marginBottom: 16,
  },
  profileActionSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.burgundy,
  },
  profileActionText: {
    color: colors.white,
    fontWeight: "900",
  },
  profileActionTextSecondary: {
    color: colors.burgundy,
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  profileTile: {
    width: "32.8%",
    aspectRatio: 1,
    backgroundColor: colors.beige,
  },
  profileTileImage: {
    width: "100%",
    height: "100%",
  },
  privateState: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  privateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  privateText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
