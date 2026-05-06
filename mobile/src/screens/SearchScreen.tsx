import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Grid3X3, Hash, Lock, MapPin, MoreHorizontal, Play, Search, UserRound, Video, X } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { API_URL } from "../services/api/apiClient";
import { colors, fonts, radius } from "../theme/dressme";
import type { Post, Profile, SearchHashtag, SearchPlace, SearchResults, User } from "../types/contracts";

type SearchTab = "top" | "users" | "hashtags" | "videos" | "places";
type SearchHistoryKind = "query" | "user" | "hashtag" | "place" | "post" | "video";

type SearchHistoryItem = {
  id: string;
  kind: SearchHistoryKind;
  title: string;
  subtitle?: string;
  value: string;
  targetId?: string;
  imageUrl?: string;
  createdAt: number;
};

type Props = {
  onOpenPost?: (postId: string) => void;
};

const tabs: Array<{ key: SearchTab; label: string }> = [
  { key: "top", label: "Top" },
  { key: "users", label: "Comptes" },
  { key: "hashtags", label: "Hashtags" },
  { key: "videos", label: "Videos" },
  { key: "places", label: "Lieux" },
];

const API_ROOT = API_URL.replace(/\/api\/v1\/?$/, "");
const SEARCH_HISTORY_LIMIT = 24;
const SEARCH_HISTORY_KEY_PREFIX = "dressme.searchHistory";

export function SearchScreen({ onOpenPost }: Props) {
  const { token, user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("top");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(true);
  const [exploreError, setExploreError] = useState("");
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingProfilePosts, setLoadingProfilePosts] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const requestIdRef = useRef(0);
  const historyKey = useMemo(
    () => `${SEARCH_HISTORY_KEY_PREFIX}.${currentUser?.id ?? "guest"}`,
    [currentUser?.id],
  );
  const hasSearchQuery = query.trim().length > 0;
  const inSearchMode = isSearchFocused || hasSearchQuery;

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(historyKey)
      .then((stored) => {
        if (!mounted || !stored) {
          if (mounted) {
            setHistory([]);
          }
          return;
        }
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, SEARCH_HISTORY_LIMIT));
        }
      })
      .catch(() => {
        if (mounted) {
          setHistory([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [historyKey]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError("");

    if (!debouncedQuery) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    client
      .search({ query: debouncedQuery, token: token ?? undefined, limit: 18 })
      .then((response) => {
        if (requestIdRef.current === requestId) {
          setResults(response);
        }
      })
      .catch((searchError: unknown) => {
        if (requestIdRef.current === requestId) {
          setError(searchError instanceof Error ? searchError.message : "Recherche indisponible.");
          setResults(null);
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      });
  }, [debouncedQuery, token]);

  useEffect(() => {
    let mounted = true;
    setLoadingExplore(true);
    setExploreError("");

    Promise.all([
      client.getFeed({ token: token ?? undefined, limit: 30 }),
      client.getReels({ token: token ?? undefined, limit: 20 }),
    ])
      .then(([feedPosts, reelPosts]) => {
        if (!mounted) {
          return;
        }
        setExplorePosts(mergeExplorePosts(feedPosts, reelPosts));
      })
      .catch((exploreLoadError) => {
        if (!mounted) {
          return;
        }
        setExplorePosts([]);
        setExploreError(
          exploreLoadError instanceof Error ? exploreLoadError.message : "Explore indisponible.",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoadingExplore(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const saveHistoryItem = useCallback(
    async (item: Omit<SearchHistoryItem, "id" | "createdAt">) => {
      const normalizedValue = item.value.trim();
      if (!normalizedValue) {
        return;
      }

      const dedupeKey = `${item.kind}:${item.targetId ?? normalizedValue.toLowerCase()}`;
      const nextItem: SearchHistoryItem = {
        ...item,
        value: normalizedValue,
        id: `${dedupeKey}:${Date.now()}`,
        createdAt: Date.now(),
      };

      setHistory((current) => {
        const next = [
          nextItem,
          ...current.filter((existing) => {
            const existingKey = `${existing.kind}:${existing.targetId ?? existing.value.toLowerCase()}`;
            return existingKey !== dedupeKey;
          }),
        ].slice(0, SEARCH_HISTORY_LIMIT);

        void AsyncStorage.setItem(historyKey, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    },
    [historyKey],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    void AsyncStorage.removeItem(historyKey).catch(() => undefined);
  }, [historyKey]);

  const removeHistoryItem = useCallback(
    (itemId: string) => {
      setHistory((current) => {
        const next = current.filter((item) => item.id !== itemId);
        void AsyncStorage.setItem(historyKey, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    },
    [historyKey],
  );

  const commitQuery = useCallback(() => {
    const value = query.trim();
    if (!value) {
      return;
    }
    void saveHistoryItem({
      kind: "query",
      title: value,
      subtitle: "Recherche",
      value,
    });
  }, [query, saveHistoryItem]);

  const loadProfilePosts = useCallback(
    async (profile: Profile) => {
      if (!profile.canViewPosts) {
        setProfilePosts([]);
        return;
      }

      setLoadingProfilePosts(true);
      try {
        const posts = await client.getProfilePosts({
          userId: profile.id,
          token: token ?? undefined,
          limit: 30,
        });
        setProfilePosts(posts);
      } catch {
        setProfilePosts([]);
      } finally {
        setLoadingProfilePosts(false);
      }
    },
    [token],
  );

  const openProfileById = useCallback(async (userId: string) => {
    setSelectedProfile(null);
    setProfilePosts([]);
    setProfileError("");
    setLoadingProfile(true);
    try {
      const profile = await client.getProfile(userId, { token: token ?? undefined });
      setSelectedProfile(profile);
      void loadProfilePosts(profile);
    } catch (profileLoadError) {
      setProfileError(
        profileLoadError instanceof Error ? profileLoadError.message : "Profil indisponible.",
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [loadProfilePosts, token]);

  const handleSelectUser = useCallback(
    (selectedUser: User) => {
      void saveHistoryItem({
        kind: "user",
        title: displayName(selectedUser),
        subtitle: `@${selectedUser.username || usernameFromUser(selectedUser)}`,
        value: selectedUser.username || usernameFromUser(selectedUser),
        targetId: selectedUser.id,
        imageUrl: selectedUser.avatarUrl,
      });
      void openProfileById(selectedUser.id);
    },
    [openProfileById, saveHistoryItem],
  );

  const handleSelectHashtag = useCallback(
    (hashtag: SearchHashtag) => {
      void saveHistoryItem({
        kind: "hashtag",
        title: hashtag.tag,
        subtitle: `${hashtag.postCount} publications`,
        value: hashtag.tag,
        imageUrl: hashtag.latestPost?.imageUrls[0],
      });
      setQuery(hashtag.tag);
      setActiveTab("top");
    },
    [saveHistoryItem],
  );

  const handleSelectPlace = useCallback(
    (place: SearchPlace) => {
      void saveHistoryItem({
        kind: "place",
        title: place.name,
        subtitle: place.subtitle || `${place.postCount} publications`,
        value: place.name,
        targetId: place.id,
        imageUrl: place.latestPost?.imageUrls[0],
      });
      setQuery(place.name);
      setActiveTab("top");
    },
    [saveHistoryItem],
  );

  const handleSelectPost = useCallback(
    (post: Post) => {
      void saveHistoryItem({
        kind: post.mediaType === "video" ? "video" : "post",
        title: post.caption.trim() || (post.mediaType === "video" ? "Video" : "Publication"),
        subtitle: displayName(post.author),
        value: post.id,
        targetId: post.id,
        imageUrl: post.imageUrls[0],
      });
      onOpenPost?.(post.id);
    },
    [onOpenPost, saveHistoryItem],
  );

  const handleProfileFollowPress = useCallback(async () => {
    if (!selectedProfile || selectedProfile.followStatus === "self") {
      return;
    }
    if (!token) {
      setProfileError("Connectez-vous pour vous abonner a ce profil.");
      return;
    }

    setFollowBusy(true);
    setProfileError("");
    try {
      const shouldCancel =
        selectedProfile.followStatus === "following" || selectedProfile.followStatus === "requested";
      const updatedProfile = shouldCancel
        ? await client.unfollowUser(selectedProfile.id, token)
        : await client.followUser(selectedProfile.id, token);
      setSelectedProfile(updatedProfile);
      void loadProfilePosts(updatedProfile);
    } catch (followError) {
      setProfileError(followError instanceof Error ? followError.message : "Action impossible.");
    } finally {
      setFollowBusy(false);
    }
  }, [loadProfilePosts, selectedProfile, token]);

  const handleHistoryPress = useCallback(
    (item: SearchHistoryItem) => {
      void saveHistoryItem({
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        value: item.value,
        targetId: item.targetId,
        imageUrl: item.imageUrl,
      });

      if (item.kind === "user" && item.targetId) {
        void openProfileById(item.targetId);
        return;
      }

      if ((item.kind === "post" || item.kind === "video") && item.targetId) {
        onOpenPost?.(item.targetId);
        return;
      }

      setQuery(item.value);
      setActiveTab("top");
    },
    [onOpenPost, openProfileById, saveHistoryItem],
  );

  const counts = useMemo(
    () => ({
      top: results
        ? results.users.length +
          results.hashtags.length +
          results.videos.length +
          results.places.length +
          results.topPosts.length
        : 0,
      users: results?.users.length ?? 0,
      hashtags: results?.hashtags.length ?? 0,
      videos: results?.videos.length ?? 0,
      places: results?.places.length ?? 0,
    }),
    [results],
  );

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.burgundy} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onBlur={() => {
              if (!query.trim()) {
                setIsSearchFocused(false);
              }
            }}
            onChangeText={(value) => {
              setQuery(value);
              if (!value.trim()) {
                setActiveTab("top");
              }
            }}
            onFocus={() => setIsSearchFocused(true)}
            onSubmitEditing={commitQuery}
            placeholder="Rechercher"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.input}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                setQuery("");
                setActiveTab("top");
              }}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {hasSearchQuery ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {tabs.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {tab.label}
                    {counts[tab.key] ? ` ${counts[tab.key]}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={inSearchMode ? styles.content : styles.exploreContent}
      >
        {!inSearchMode ? (
          <ExploreMediaGrid
            error={exploreError}
            loading={loadingExplore}
            posts={explorePosts}
            onSelectPost={handleSelectPost}
          />
        ) : null}
        {inSearchMode && !hasSearchQuery ? (
          <SearchHistory
            history={history}
            onClear={clearHistory}
            onPressItem={handleHistoryPress}
            onRemoveItem={removeHistoryItem}
          />
        ) : null}
        {hasSearchQuery && loading ? <SearchState label="Recherche en cours..." loading /> : null}
        {hasSearchQuery && !loading && error ? <SearchState label={error} /> : null}
        {hasSearchQuery && !loading && !error && results ? (
          <>
            {activeTab === "top" ? (
              <TopResults
                results={results}
                onSelectPost={handleSelectPost}
                onSelectUser={handleSelectUser}
                onSelectHashtag={handleSelectHashtag}
                onSelectPlace={handleSelectPlace}
              />
            ) : null}
            {activeTab === "users" ? <UserResults users={results.users} onSelectUser={handleSelectUser} /> : null}
            {activeTab === "hashtags" ? (
              <HashtagResults hashtags={results.hashtags} onSelect={handleSelectHashtag} />
            ) : null}
            {activeTab === "videos" ? <PostGrid posts={results.videos} onSelectPost={handleSelectPost} videoOnly /> : null}
            {activeTab === "places" ? (
              <PlaceResults places={results.places} onSelect={handleSelectPlace} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <ProfilePreviewModal
        error={profileError}
        followBusy={followBusy}
        loading={loadingProfile}
        loadingPosts={loadingProfilePosts}
        profile={selectedProfile}
        posts={profilePosts}
        onClose={() => {
          setSelectedProfile(null);
          setProfilePosts([]);
          setProfileError("");
          setLoadingProfile(false);
          setLoadingProfilePosts(false);
        }}
        onFollowPress={handleProfileFollowPress}
        onOpenPost={(postId) => {
          setSelectedProfile(null);
          setProfilePosts([]);
          onOpenPost?.(postId);
        }}
      />
    </View>
  );
}

function ExploreMediaGrid({
  posts,
  loading,
  error,
  onSelectPost,
}: {
  posts: Post[];
  loading: boolean;
  error: string;
  onSelectPost: (post: Post) => void;
}) {
  if (loading) {
    return <SearchState label="Chargement Explore..." loading />;
  }

  if (error) {
    return <SearchState label={error} />;
  }

  if (!posts.length) {
    return <SearchState label="Aucune publication a explorer pour le moment." />;
  }

  return (
    <View style={styles.exploreGrid}>
      {posts.map((post, index) => {
        const large = index % 11 === 2 || index % 11 === 8;
        return (
          <Pressable
            accessibilityRole="button"
            key={post.id}
            onPress={() => onSelectPost(post)}
            style={[styles.exploreTile, large && styles.exploreTileLarge]}
          >
            <PostThumb post={post} fill />
          </Pressable>
        );
      })}
    </View>
  );
}

function TopResults({
  results,
  onSelectPost,
  onSelectUser,
  onSelectHashtag,
  onSelectPlace,
}: {
  results: SearchResults;
  onSelectPost: (post: Post) => void;
  onSelectUser: (user: User) => void;
  onSelectHashtag: (hashtag: SearchHashtag) => void;
  onSelectPlace: (place: SearchPlace) => void;
}) {
  const hasResults =
    results.users.length ||
    results.hashtags.length ||
    results.videos.length ||
    results.places.length ||
    results.topPosts.length;

  if (!hasResults) {
    return <SearchState label="Aucun resultat dynamique trouve." />;
  }

  return (
    <View style={styles.sections}>
      <UserResults users={results.users.slice(0, 5)} onSelectUser={onSelectUser} compact />
      <HashtagResults hashtags={results.hashtags.slice(0, 5)} onSelect={onSelectHashtag} compact />
      <PlaceResults places={results.places.slice(0, 5)} onSelect={onSelectPlace} compact />
      <SectionTitle icon={<Grid3X3 size={18} color={colors.burgundy} />} title="Publications" />
      <PostGrid posts={results.topPosts} onSelectPost={onSelectPost} />
      {results.videos.length ? (
        <>
          <SectionTitle icon={<Video size={18} color={colors.burgundy} />} title="Videos" />
          <PostGrid posts={results.videos.slice(0, 6)} onSelectPost={onSelectPost} videoOnly />
        </>
      ) : null}
    </View>
  );
}

function UserResults({
  users,
  onSelectUser,
  compact = false,
}: {
  users: User[];
  onSelectUser: (user: User) => void;
  compact?: boolean;
}) {
  if (!users.length) {
    return compact ? null : <SearchState label="Aucun compte trouve." />;
  }

  return (
    <View style={styles.section}>
      <SectionTitle icon={<UserRound size={18} color={colors.burgundy} />} title="Comptes" />
      {users.map((user) => (
        <Pressable
          accessibilityRole="button"
          key={user.id}
          onPress={() => onSelectUser(user)}
          style={styles.resultRow}
        >
          {user.avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(user.avatarUrl) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <UserRound size={20} color={colors.burgundy} />
            </View>
          )}
          <View style={styles.resultText}>
            <Text numberOfLines={1} style={styles.resultTitle}>
              {displayName(user)}
            </Text>
            <Text numberOfLines={1} style={styles.resultSubtitle}>
              @{user.username || usernameFromUser(user)}
              {user.bio ? ` · ${user.bio}` : ""}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function HashtagResults({
  hashtags,
  onSelect,
  compact = false,
}: {
  hashtags: SearchHashtag[];
  onSelect: (hashtag: SearchHashtag) => void;
  compact?: boolean;
}) {
  if (!hashtags.length) {
    return compact ? null : <SearchState label="Aucun hashtag trouve." />;
  }

  return (
    <View style={styles.section}>
      <SectionTitle icon={<Hash size={18} color={colors.burgundy} />} title="Hashtags" />
      {hashtags.map((hashtag) => (
        <Pressable
          accessibilityRole="button"
          key={hashtag.tag}
          onPress={() => onSelect(hashtag)}
          style={styles.resultRow}
        >
          <View style={styles.roundIcon}>
            <Hash size={20} color={colors.burgundy} />
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultTitle}>{hashtag.tag}</Text>
            <Text style={styles.resultSubtitle}>{hashtag.postCount} publications</Text>
          </View>
          {hashtag.latestPost ? <PostThumb post={hashtag.latestPost} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function PlaceResults({
  places,
  onSelect,
  compact = false,
}: {
  places: SearchPlace[];
  onSelect: (place: SearchPlace) => void;
  compact?: boolean;
}) {
  if (!places.length) {
    return compact ? null : <SearchState label="Aucun lieu trouve." />;
  }

  return (
    <View style={styles.section}>
      <SectionTitle icon={<MapPin size={18} color={colors.burgundy} />} title="Lieux" />
      {places.map((place) => (
        <Pressable
          accessibilityRole="button"
          key={place.id}
          onPress={() => onSelect(place)}
          style={styles.resultRow}
        >
          <View style={styles.roundIcon}>
            <MapPin size={20} color={colors.burgundy} />
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultTitle}>{place.name}</Text>
            <Text style={styles.resultSubtitle}>
              {place.postCount} publications
              {place.subtitle ? ` · ${place.subtitle}` : ""}
            </Text>
          </View>
          {place.latestPost ? <PostThumb post={place.latestPost} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function PostGrid({
  posts,
  onSelectPost,
  videoOnly = false,
}: {
  posts: Post[];
  onSelectPost: (post: Post) => void;
  videoOnly?: boolean;
}) {
  if (!posts.length) {
    return <SearchState label={videoOnly ? "Aucune video trouvee." : "Aucune publication trouvee."} />;
  }

  return (
    <View style={styles.grid}>
      {posts.map((post) => (
        <Pressable
          accessibilityRole="button"
          key={post.id}
          onPress={() => onSelectPost(post)}
          style={styles.tile}
        >
          <PostThumb post={post} fill />
        </Pressable>
      ))}
    </View>
  );
}

function SearchHistory({
  history,
  onClear,
  onPressItem,
  onRemoveItem,
}: {
  history: SearchHistoryItem[];
  onClear: () => void;
  onPressItem: (item: SearchHistoryItem) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  if (!history.length) {
    return (
      <SearchState label="Recherchez un compte, un hashtag, une video ou un lieu. Les resultats apparaitront ici." />
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Recent</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onClear}>
          <Text style={styles.historyClear}>Effacer tout</Text>
        </Pressable>
      </View>
      {history.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item.id}
          onPress={() => onPressItem(item)}
          style={styles.resultRow}
        >
          {item.imageUrl ? (
            <Image source={{ uri: resolveMediaUrl(item.imageUrl) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>{historyIcon(item.kind)}</View>
          )}
          <View style={styles.resultText}>
            <Text numberOfLines={1} style={styles.resultTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.resultSubtitle}>
              {item.subtitle || historyKindLabel(item.kind)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onRemoveItem(item.id);
            }}
          >
            <X size={17} color={colors.muted} />
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

function ProfilePreviewModal({
  profile,
  posts,
  loading,
  loadingPosts,
  followBusy,
  error,
  onClose,
  onFollowPress,
  onOpenPost,
}: {
  profile: Profile | null;
  posts: Post[];
  loading: boolean;
  loadingPosts: boolean;
  followBusy: boolean;
  error: string;
  onClose: () => void;
  onFollowPress: () => void;
  onOpenPost: (postId: string) => void;
}) {
  const visible = loading || Boolean(profile) || Boolean(error);
  const canUseFollowButton = Boolean(profile && profile.followStatus !== "self");

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.profileSheet}>
          <View style={styles.sheetHeader}>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.sheetIconButton}>
              <X size={24} color={colors.text} />
            </Pressable>
            <Text numberOfLines={1} style={styles.sheetTitle}>
              {profile ? profile.username || usernameFromUser(profile) : "Profil"}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose}>
              <MoreHorizontal size={24} color={colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.profileLoading}>
              <ActivityIndicator color={colors.burgundy} />
              <Text style={styles.stateText}>Chargement du profil...</Text>
            </View>
          ) : null}

          {!loading && error ? <SearchState label={error} /> : null}

          {!loading && profile ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent}>
              <View style={styles.profileTopRow}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: resolveMediaUrl(profile.avatarUrl) }} style={styles.profileAvatar} />
                ) : (
                  <View style={[styles.profileAvatar, styles.avatarFallback]}>
                    <UserRound size={34} color={colors.burgundy} />
                  </View>
                )}
                <View style={styles.profileStats}>
                  <ProfileStat label="posts" value={profile.postCount} />
                  <ProfileStat label="followers" value={profile.followerCount} />
                  <ProfileStat label="following" value={profile.followingCount} />
                </View>
              </View>

              <View style={styles.profileIdentity}>
                <Text numberOfLines={1} style={styles.profileName}>
                  {displayName(profile)}
                </Text>
                {profile.bio ? <Text style={styles.profileBio}>{profile.bio}</Text> : null}
              </View>

              {canUseFollowButton ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={followBusy}
                  onPress={onFollowPress}
                  style={[
                    styles.profileFollowButton,
                    profile.followStatus !== "not_following" && styles.profileFollowButtonSecondary,
                    followBusy && styles.profileFollowButtonDisabled,
                  ]}
                >
                  {followBusy ? <ActivityIndicator color={profile.followStatus === "not_following" ? colors.white : colors.burgundy} /> : null}
                  <Text
                    style={[
                      styles.profileFollowButtonText,
                      profile.followStatus !== "not_following" && styles.profileFollowButtonTextSecondary,
                    ]}
                  >
                    {followButtonLabel(profile)}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.profileTabs}>
                <View style={[styles.profileTabIcon, styles.profileTabIconActive]}>
                  <Grid3X3 size={22} color={colors.text} />
                </View>
                <View style={styles.profileTabIcon}>
                  <UserRound size={22} color={colors.muted} />
                </View>
              </View>

              {profile.canViewPosts ? (
                <ProfilePostGrid
                  loading={loadingPosts}
                  posts={posts}
                  onOpenPost={onOpenPost}
                />
              ) : (
                <PrivateProfileState />
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{formatCount(value)}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

function ProfilePostGrid({
  posts,
  loading,
  onOpenPost,
}: {
  posts: Post[];
  loading: boolean;
  onOpenPost: (postId: string) => void;
}) {
  if (loading) {
    return (
      <View style={styles.profilePostsState}>
        <ActivityIndicator color={colors.burgundy} />
        <Text style={styles.stateText}>Chargement des publications...</Text>
      </View>
    );
  }

  if (!posts.length) {
    return (
      <View style={styles.profilePostsState}>
        <Grid3X3 size={34} color={colors.text} />
        <Text style={styles.privateTitle}>Aucune publication</Text>
      </View>
    );
  }

  return (
    <View style={styles.profilePostGrid}>
      {posts.map((post) => (
        <Pressable
          accessibilityRole="button"
          key={post.id}
          onPress={() => onOpenPost(post.id)}
          style={styles.profilePostTile}
        >
          <PostThumb post={post} fill />
        </Pressable>
      ))}
    </View>
  );
}

function PrivateProfileState() {
  return (
    <View style={styles.privateState}>
      <View style={styles.privateLockCircle}>
        <Lock size={46} color={colors.text} />
      </View>
      <Text style={styles.privateTitle}>Ce profil est prive</Text>
      <Text style={styles.privateSubtitle}>
        Abonnez-vous a ce profil pour voir ses photos et videos.
      </Text>
    </View>
  );
}

function PostThumb({ post, fill = false }: { post: Post; fill?: boolean }) {
  const mediaUrl = resolveMediaUrl(post.imageUrls[0]);
  return (
    <View style={fill ? styles.thumbFill : styles.rowThumb}>
      {mediaUrl ? <Image source={{ uri: mediaUrl }} resizeMode="cover" style={styles.thumbImage} /> : null}
      {post.mediaType === "video" ? (
        <View style={styles.videoBadge}>
          <Play size={14} color={colors.white} fill={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

function historyIcon(kind: SearchHistoryKind) {
  if (kind === "user") {
    return <UserRound size={20} color={colors.burgundy} />;
  }
  if (kind === "hashtag") {
    return <Hash size={20} color={colors.burgundy} />;
  }
  if (kind === "place") {
    return <MapPin size={20} color={colors.burgundy} />;
  }
  if (kind === "post") {
    return <Grid3X3 size={20} color={colors.burgundy} />;
  }
  if (kind === "video") {
    return <Video size={20} color={colors.burgundy} />;
  }
  return <Search size={20} color={colors.burgundy} />;
}

function historyKindLabel(kind: SearchHistoryKind): string {
  if (kind === "user") {
    return "Compte";
  }
  if (kind === "hashtag") {
    return "Hashtag";
  }
  if (kind === "place") {
    return "Lieu";
  }
  if (kind === "post") {
    return "Publication";
  }
  if (kind === "video") {
    return "Video";
  }
  return "Recherche";
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

function followButtonLabel(profile: Profile): string {
  if (profile.followStatus === "following") {
    return "Abonne";
  }
  if (profile.followStatus === "requested") {
    return "Demande envoyee";
  }
  return profile.isPrivate ? "Demander l'abonnement" : "S'abonner";
}

function mergeExplorePosts(feedPosts: Post[], reelPosts: Post[]): Post[] {
  const postsById = new Map<string, Post>();
  for (const post of [...feedPosts, ...reelPosts]) {
    postsById.set(post.id, post);
  }

  return Array.from(postsById.values()).sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return rightTime - leftTime;
  });
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SearchState({ label, loading = false }: { label: string; loading?: boolean }) {
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator color={colors.burgundy} /> : null}
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

function displayName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username || "Utilisateur DressMe";
}

function usernameFromUser(user: User): string {
  return displayName(user).replace(/\s+/g, ".").toLowerCase() || "dressme.user";
}

function resolveMediaUrl(url?: string): string {
  if (!url) {
    return "";
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_ROOT}${url.startsWith("/") ? url : `/${url}`}`;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    backgroundColor: colors.white,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  searchBox: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#EEF1F4",
    borderWidth: 1,
    borderColor: "#EEF1F4",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  tabs: {
    gap: 8,
    paddingBottom: 2,
  },
  tab: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  tabActive: {
    backgroundColor: colors.burgundy,
    borderColor: colors.burgundy,
  },
  tabText: {
    color: colors.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.white,
  },
  content: {
    padding: 12,
    paddingBottom: 104,
    gap: 16,
  },
  exploreContent: {
    paddingBottom: 104,
  },
  exploreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.white,
  },
  exploreTile: {
    width: "33.333%",
    aspectRatio: 1,
    borderWidth: 0.5,
    borderColor: colors.white,
    backgroundColor: colors.beige,
  },
  exploreTileLarge: {
    width: "66.666%",
  },
  sections: {
    gap: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  resultRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 9,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.beige,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  roundIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.beige,
  },
  resultText: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 14,
  },
  resultSubtitle: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 12,
    marginTop: 3,
  },
  historyHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  historyClear: {
    color: colors.burgundy,
    fontWeight: "800",
    fontSize: 12,
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
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.beige,
  },
  thumbFill: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: colors.beige,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  state: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  stateText: {
    color: colors.muted,
    fontWeight: "700",
    textAlign: "center",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: colors.white,
  },
  profileSheet: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: 48,
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  sheetIconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    flex: 1,
    marginHorizontal: 12,
  },
  profileLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  profileScrollContent: {
    paddingBottom: 32,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  profileAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.beige,
  },
  profileIdentity: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  profileName: {
    maxWidth: "100%",
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  profileBio: {
    color: colors.text,
    fontWeight: "500",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  profileStats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  profileStat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileStatValue: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 20,
  },
  profileStatLabel: {
    color: colors.text,
    fontWeight: "500",
    fontSize: 13,
    marginTop: 1,
    textAlign: "center",
  },
  profileFollowButton: {
    minHeight: 46,
    marginHorizontal: 14,
    marginTop: 16,
    borderRadius: 9,
    backgroundColor: colors.burgundy,
    borderWidth: 1,
    borderColor: colors.burgundy,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  profileFollowButtonSecondary: {
    backgroundColor: colors.white,
  },
  profileFollowButtonDisabled: {
    opacity: 0.7,
  },
  profileFollowButtonText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16,
  },
  profileFollowButtonTextSecondary: {
    color: colors.burgundy,
  },
  profileTabs: {
    marginTop: 16,
    height: 48,
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#EFEFEF",
  },
  profileTabIcon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  profileTabIconActive: {
    borderBottomColor: colors.text,
  },
  profilePostGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    backgroundColor: colors.white,
  },
  profilePostTile: {
    width: "33%",
    aspectRatio: 1,
    backgroundColor: colors.beige,
  },
  profilePostsState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 30,
  },
  privateState: {
    minHeight: 390,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 38,
    gap: 14,
  },
  privateLockCircle: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  privateTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 22,
    textAlign: "center",
  },
  privateSubtitle: {
    color: colors.muted,
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
});
