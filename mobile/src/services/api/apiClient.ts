import type { DressMeClient } from "../types";
import type {
  AIRecommendation,
  AIRecommendationItem,
  ActivityNotification,
  AuthMessage,
  AuthSession,
  Comment,
  LiveSession,
  MediaUpload,
  Poll,
  PollOption,
  Post,
  Profile,
  SearchHashtag,
  SearchPlace,
  SearchResults,
  Story,
  User,
} from "../../types/contracts";

type Json = Record<string, unknown>;

declare const process:
  | {
      env?: {
        EXPO_PUBLIC_API_URL?: string;
      };
    }
  | undefined;

const DEFAULT_API_URL = "http://127.0.0.1:8000/api/v1";
const REQUEST_TIMEOUT_MS = 15000;
const MEDIA_UPLOAD_TIMEOUT_MS = 120000;

export const API_URL =
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL
    : DEFAULT_API_URL;
const API_ORIGIN = getUrlOrigin(API_URL);

type BackendUser = {
  id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

type BackendAuthSession = {
  access_token: string;
  token_type: "bearer";
  expires_at?: string;
  expires_in?: number;
  user: BackendUser;
};

type BackendMessage = {
  message: string;
};

type BackendProfile = BackendUser & {
  follower_count?: number;
  following_count?: number;
  post_count?: number;
  is_private?: boolean;
  follow_status?: "self" | "not_following" | "following" | "requested";
  can_view_posts?: boolean;
};

type BackendPollOption = {
  id: string;
  label: string;
  image_url: string;
  votes: number;
};

type BackendPoll = {
  id: string;
  options: BackendPollOption[];
  total_votes: number;
};

type BackendPost = {
  id: string;
  author: BackendUser;
  caption: string;
  media_type?: "image" | "video";
  hashtags: string[];
  garment_tags: string[];
  image_urls: string[];
  like_count: number;
  comment_count: number;
  share_count?: number;
  liked_by_me: boolean;
  saved_by_me?: boolean;
  created_at: string;
  poll?: BackendPoll | null;
};

type BackendComment = {
  id: string;
  author: BackendUser;
  content: string;
  created_at: string;
};

type BackendMediaUpload = {
  url: string;
  filename: string;
  content_type: string;
  media_type: "image" | "video";
};

type BackendStory = {
  id: string;
  author: BackendUser;
  media_url: string;
  media_type: "image" | "video";
  caption?: string | null;
  viewer_count?: number;
  viewed_by_me: boolean;
  created_at: string;
  expires_at: string;
};

type BackendLiveSession = {
  id: string;
  host: BackendUser;
  title?: string | null;
  status: "live" | "ended";
  viewer_count?: number;
  started_at: string;
  ended_at?: string | null;
};

type BackendActivityNotification = {
  id: string;
  tab: "you" | "following";
  type: ActivityNotification["type"];
  filter_key: ActivityNotification["filterKey"];
  actors: BackendUser[];
  actor_count: number;
  title: string;
  body?: string | null;
  target_type: ActivityNotification["targetType"];
  target_id?: string | null;
  target_post?: BackendPost | null;
  thumbnail_url?: string | null;
  action: ActivityNotification["action"];
  action_label?: string | null;
  created_at: string;
  read: boolean;
};

type BackendAIRecommendationItem = {
  category: string;
  description: string;
  color?: string | null;
};

type BackendAIRecommendation = {
  id: string;
  title: string;
  rationale: string;
  items: BackendAIRecommendationItem[];
  preview_image_url: string;
};

type BackendSearchHashtag = {
  tag: string;
  post_count: number;
  latest_post?: BackendPost | null;
};

type BackendSearchPlace = {
  id: string;
  name: string;
  subtitle?: string | null;
  post_count: number;
  latest_post?: BackendPost | null;
};

type BackendSearchResults = {
  query: string;
  users: BackendUser[];
  hashtags: BackendSearchHashtag[];
  videos: BackendPost[];
  places: BackendSearchPlace[];
  top_posts: BackendPost[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class ApiDressMeClient implements DressMeClient {
  constructor(private readonly baseUrl: string) {}

  private async fetchWithTimeout(
    path: string,
    init?: RequestInit,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(
          `La requete reseau a expire apres ${timeoutMs / 1000}s. Verifie que FastAPI est lance et que EXPO_PUBLIC_API_URL pointe vers le backend accessible.`,
          undefined,
          { path, timeoutMs },
        );
      }

      throw new ApiError(
        "Erreur reseau. Verifie que FastAPI est lance et que EXPO_PUBLIC_API_URL pointe vers le backend accessible.",
        undefined,
        error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    token?: string,
  ): Promise<T> {
    const response = await this.fetchWithTimeout(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = undefined;
      }

      const message =
        typeof details === "object" &&
        details !== null &&
        "detail" in details &&
        typeof details.detail === "string"
          ? details.detail
          : `Request failed for ${path}`;

      throw new ApiError(message, response.status, details);
    }

    return (await response.json()) as T;
  }

  private async requestFormData<T>(
    path: string,
    body: FormData,
    token: string,
  ): Promise<T> {
    const response = await this.fetchWithTimeout(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body,
    }, MEDIA_UPLOAD_TIMEOUT_MS);

    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = undefined;
      }

      const message =
        typeof details === "object" &&
        details !== null &&
        "detail" in details &&
        typeof details.detail === "string"
          ? details.detail
          : `Request failed for ${path}`;

      throw new ApiError(message, response.status, details);
    }

    return (await response.json()) as T;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const session = await this.request<BackendAuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    return mapAuthSession(session);
  }

  async register(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<AuthMessage> {
    const response = await this.request<BackendMessage>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        password: input.password,
      }),
    });

    return response;
  }

  async forgotPassword(email: string): Promise<AuthMessage> {
    return this.request<BackendMessage>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthMessage> {
    return this.request<BackendMessage>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  }

  async getMe(token: string): Promise<User> {
    const user = await this.request<BackendUser>("/auth/me", undefined, token);
    return mapUser(user);
  }

  async search(input?: { query?: string; token?: string; limit?: number }): Promise<SearchResults> {
    const params = new URLSearchParams();
    if (input?.query) {
      params.set("q", input.query);
    }
    if (input?.limit) {
      params.set("limit", String(input.limit));
    }

    const query = params.toString();
    const results = await this.request<BackendSearchResults>(
      query ? `/search?${query}` : "/search",
      undefined,
      input?.token,
    );
    return mapSearchResults(results);
  }

  async getFeed(input?: { token?: string; limit?: number; offset?: number }): Promise<Post[]> {
    const params = new URLSearchParams();
    if (input?.limit) {
      params.set("limit", String(input.limit));
    }
    if (input?.offset) {
      params.set("offset", String(input.offset));
    }

    const query = params.toString();
    const posts = await this.request<BackendPost[]>(
      query ? `/feed?${query}` : "/feed",
      undefined,
      input?.token,
    );
    return posts.map(mapPost);
  }

  async getReels(input?: { token?: string; limit?: number; offset?: number }): Promise<Post[]> {
    const params = new URLSearchParams();
    if (input?.limit) {
      params.set("limit", String(input.limit));
    }
    if (input?.offset) {
      params.set("offset", String(input.offset));
    }

    const query = params.toString();
    const posts = await this.request<BackendPost[]>(
      query ? `/reels?${query}` : "/reels",
      undefined,
      input?.token,
    );
    return posts.map(mapPost);
  }

  async uploadMedia(input: { uri: string; name: string; type: string }, token: string): Promise<MediaUpload> {
    const formData = new FormData();
    formData.append(
      "file",
      {
        uri: input.uri,
        name: input.name,
        type: input.type,
      } as unknown as Blob,
    );

    const upload = await this.requestFormData<BackendMediaUpload>("/media/upload", formData, token);
    return mapMediaUpload(upload);
  }

  async getStories(input?: { token?: string; limit?: number }): Promise<Story[]> {
    const params = new URLSearchParams();
    if (input?.limit) {
      params.set("limit", String(input.limit));
    }

    const query = params.toString();
    const stories = await this.request<BackendStory[]>(
      query ? `/stories?${query}` : "/stories",
      undefined,
      input?.token,
    );
    return stories.map(mapStory);
  }

  async getStoryViewers(storyId: string, token: string): Promise<User[]> {
    const users = await this.request<BackendUser[]>(
      `/stories/${storyId}/viewers`,
      undefined,
      token,
    );
    return users.map(mapUser);
  }

  async createStory(
    input: {
      mediaUrl: string;
      mediaType?: "image" | "video";
      caption?: string;
    },
    token: string,
  ): Promise<Story> {
    const story = await this.request<BackendStory>(
      "/stories",
      {
        method: "POST",
        body: JSON.stringify({
          media_url: input.mediaUrl,
          media_type: input.mediaType ?? "image",
          caption: input.caption,
        }),
      },
      token,
    );
    return mapStory(story);
  }

  async markStoryViewed(storyId: string, token: string): Promise<Story> {
    const story = await this.request<BackendStory>(
      `/stories/${storyId}/view`,
      { method: "POST" },
      token,
    );
    return mapStory(story);
  }

  async getFollowers(token: string): Promise<User[]> {
    const users = await this.request<BackendUser[]>("/users/me/followers", undefined, token);
    return users.map(mapUser);
  }

  async getPost(postId: string, input?: { token?: string }): Promise<Post> {
    const post = await this.request<BackendPost>(
      `/posts/${postId}`,
      undefined,
      input?.token,
    );
    return mapPost(post);
  }

  async createPost(
    input: {
      caption: string;
      mediaType?: "image" | "video";
      imageUrls: string[];
      hashtags: string[];
      garmentTags?: string[];
    },
    token: string,
  ): Promise<Post> {
    const post = await this.request<BackendPost>(
      "/posts",
      {
        method: "POST",
        body: JSON.stringify({
          caption: input.caption,
          media_type: input.mediaType ?? "image",
          image_urls: input.imageUrls,
          hashtags: input.hashtags,
          garment_tags: input.garmentTags ?? [],
        }),
      },
      token,
    );
    return mapPost(post);
  }

  async togglePostLike(postId: string, token: string): Promise<Post> {
    const post = await this.request<BackendPost>(
      `/posts/${postId}/like`,
      { method: "POST" },
      token,
    );
    return mapPost(post);
  }

  async sharePost(postId: string, token: string): Promise<Post> {
    const post = await this.request<BackendPost>(
      `/posts/${postId}/share`,
      { method: "POST" },
      token,
    );
    return mapPost(post);
  }

  async togglePostSave(postId: string, token: string): Promise<Post> {
    const post = await this.request<BackendPost>(
      `/posts/${postId}/save`,
      { method: "POST" },
      token,
    );
    return mapPost(post);
  }

  async getPostComments(postId: string, input?: { limit?: number; offset?: number }): Promise<Comment[]> {
    const params = new URLSearchParams();
    if (input?.limit) {
      params.set("limit", String(input.limit));
    }
    if (input?.offset) {
      params.set("offset", String(input.offset));
    }

    const query = params.toString();
    const comments = await this.request<BackendComment[]>(
      query ? `/posts/${postId}/comments?${query}` : `/posts/${postId}/comments`,
    );
    return comments.map(mapComment);
  }

  async addPostComment(postId: string, content: string, token: string): Promise<Comment> {
    const comment = await this.request<BackendComment>(
      `/posts/${postId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
      token,
    );
    return mapComment(comment);
  }

  async getSavedPosts(input: {
    token: string;
    mediaType?: "image" | "video";
    limit?: number;
    offset?: number;
  }): Promise<Post[]> {
    const params = new URLSearchParams();
    if (input.mediaType) {
      params.set("media_type", input.mediaType);
    }
    if (input.limit) {
      params.set("limit", String(input.limit));
    }
    if (input.offset) {
      params.set("offset", String(input.offset));
    }

    const query = params.toString();
    const posts = await this.request<BackendPost[]>(
      query ? `/users/me/saved-posts?${query}` : "/users/me/saved-posts",
      undefined,
      input.token,
    );
    return posts.map(mapPost);
  }

  async getNotifications(input: { token: string; limit?: number }): Promise<ActivityNotification[]> {
    const params = new URLSearchParams();
    if (input.limit) {
      params.set("limit", String(input.limit));
    }

    const query = params.toString();
    const notifications = await this.request<BackendActivityNotification[]>(
      query ? `/notifications/activity?${query}` : "/notifications/activity",
      undefined,
      input.token,
    );
    return notifications.map(mapActivityNotification);
  }

  async markNotificationsRead(input: { token: string; notificationIds?: string[] }): Promise<void> {
    await this.request<{ marked: number }>(
      "/notifications/activity/read",
      {
        method: "POST",
        body: JSON.stringify({ notification_ids: input.notificationIds ?? [] }),
      },
      input.token,
    );
  }

  async getLiveSessions(input: { token: string; limit?: number }): Promise<LiveSession[]> {
    const params = new URLSearchParams();
    if (input.limit) {
      params.set("limit", String(input.limit));
    }

    const query = params.toString();
    const sessions = await this.request<BackendLiveSession[]>(
      query ? `/live/sessions?${query}` : "/live/sessions",
      undefined,
      input.token,
    );
    return sessions.map(mapLiveSession);
  }

  async createLiveSession(input: { token: string; title?: string }): Promise<LiveSession> {
    const session = await this.request<BackendLiveSession>(
      "/live/sessions",
      {
        method: "POST",
        body: JSON.stringify({ title: input.title }),
      },
      input.token,
    );
    return mapLiveSession(session);
  }

  async endLiveSession(input: { token: string; liveId: string }): Promise<LiveSession> {
    const session = await this.request<BackendLiveSession>(
      `/live/sessions/${input.liveId}/end`,
      { method: "POST" },
      input.token,
    );
    return mapLiveSession(session);
  }

  async getProfile(userId: string, input?: { token?: string }): Promise<Profile> {
    const profile = await this.request<BackendProfile>(`/users/${userId}`, undefined, input?.token);
    return mapProfile(profile);
  }

  async getProfilePosts(input: { userId: string; token?: string; limit?: number; offset?: number }): Promise<Post[]> {
    const params = new URLSearchParams();
    if (input.limit) {
      params.set("limit", String(input.limit));
    }
    if (input.offset) {
      params.set("offset", String(input.offset));
    }

    const query = params.toString();
    const posts = await this.request<BackendPost[]>(
      query ? `/users/${input.userId}/posts?${query}` : `/users/${input.userId}/posts`,
      undefined,
      input.token,
    );
    return posts.map(mapPost);
  }

  async followUser(userId: string, token: string): Promise<Profile> {
    const profile = await this.request<BackendProfile>(
      `/users/${userId}/follow`,
      { method: "POST" },
      token,
    );
    return mapProfile(profile);
  }

  async unfollowUser(userId: string, token: string): Promise<Profile> {
    const profile = await this.request<BackendProfile>(
      `/users/${userId}/follow`,
      { method: "DELETE" },
      token,
    );
    return mapProfile(profile);
  }

  async helpMeChoose(input: {
    imageUrl: string;
    occasion?: string;
    userPrompt?: string;
  }): Promise<AIRecommendation[]> {
    const payload: Json = {
      image_url: input.imageUrl,
    };

    if (input.occasion) {
      payload.occasion = input.occasion;
    }

    if (input.userPrompt) {
      payload.user_prompt = input.userPrompt;
    }

    const recommendations = await this.request<BackendAIRecommendation[]>("/ai/help-me-choose", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return recommendations.map(mapAIRecommendation);
  }
}

function mapAuthSession(session: BackendAuthSession): AuthSession {
  return {
    accessToken: session.access_token,
    tokenType: session.token_type,
    expiresAt: session.expires_at,
    expiresIn: session.expires_in,
    user: mapUser(session.user),
  };
}

function mapUser(user: BackendUser): User {
  return {
    id: user.id,
    username: user.username ?? undefined,
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    email: user.email ?? "",
    avatarUrl: user.avatar_url ?? undefined,
    bio: user.bio ?? undefined,
  };
}

function mapSearchResults(results: BackendSearchResults): SearchResults {
  return {
    query: results.query,
    users: results.users.map(mapUser),
    hashtags: results.hashtags.map(mapSearchHashtag),
    videos: results.videos.map(mapPost),
    places: results.places.map(mapSearchPlace),
    topPosts: results.top_posts.map(mapPost),
  };
}

function mapSearchHashtag(hashtag: BackendSearchHashtag): SearchHashtag {
  return {
    tag: hashtag.tag,
    postCount: hashtag.post_count,
    latestPost: hashtag.latest_post ? mapPost(hashtag.latest_post) : undefined,
  };
}

function mapSearchPlace(place: BackendSearchPlace): SearchPlace {
  return {
    id: place.id,
    name: place.name,
    subtitle: place.subtitle ?? undefined,
    postCount: place.post_count,
    latestPost: place.latest_post ? mapPost(place.latest_post) : undefined,
  };
}

function mapActivityNotification(notification: BackendActivityNotification): ActivityNotification {
  return {
    id: notification.id,
    tab: notification.tab,
    type: notification.type,
    filterKey: notification.filter_key,
    actors: notification.actors.map(mapUser),
    actorCount: notification.actor_count,
    title: notification.title,
    body: notification.body ?? undefined,
    targetType: notification.target_type,
    targetId: notification.target_id ?? undefined,
    targetPost: notification.target_post ? mapPost(notification.target_post) : undefined,
    thumbnailUrl: notification.thumbnail_url ? normalizeMediaUrl(notification.thumbnail_url) : undefined,
    action: notification.action,
    actionLabel: notification.action_label ?? undefined,
    createdAt: notification.created_at,
    read: notification.read,
  };
}

function mapProfile(profile: BackendProfile): Profile {
  const isPrivate = profile.is_private ?? false;
  return {
    ...mapUser(profile),
    followerCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    postCount: profile.post_count ?? 0,
    isPrivate,
    followStatus: profile.follow_status ?? "not_following",
    canViewPosts: profile.can_view_posts ?? !isPrivate,
  };
}

function mapMediaUpload(upload: BackendMediaUpload): MediaUpload {
  return {
    url: normalizeMediaUrl(upload.url),
    filename: upload.filename,
    contentType: upload.content_type,
    mediaType: upload.media_type,
  };
}

function mapPost(post: BackendPost): Post {
  return {
    id: post.id,
    author: mapUser(post.author),
    caption: post.caption,
    mediaType: post.media_type ?? "image",
    hashtags: post.hashtags,
    garmentTags: post.garment_tags,
    imageUrls: post.image_urls.map(normalizeMediaUrl).filter(Boolean),
    likeCount: post.like_count,
    commentCount: post.comment_count,
    shareCount: post.share_count ?? 0,
    likedByMe: post.liked_by_me,
    savedByMe: post.saved_by_me ?? false,
    createdAt: post.created_at,
    poll: post.poll ? mapPoll(post.poll) : undefined,
  };
}

function mapStory(story: BackendStory): Story {
  return {
    id: story.id,
    author: mapUser(story.author),
    mediaUrl: normalizeMediaUrl(story.media_url),
    mediaType: story.media_type,
    caption: story.caption ?? undefined,
    viewerCount: story.viewer_count ?? 0,
    viewedByMe: story.viewed_by_me,
    createdAt: story.created_at,
    expiresAt: story.expires_at,
  };
}

function mapLiveSession(session: BackendLiveSession): LiveSession {
  return {
    id: session.id,
    host: mapUser(session.host),
    title: session.title ?? undefined,
    status: session.status,
    viewerCount: session.viewer_count ?? 0,
    startedAt: session.started_at,
    endedAt: session.ended_at ?? undefined,
  };
}

function mapPoll(poll: BackendPoll): Poll {
  return {
    id: poll.id,
    options: poll.options.map(mapPollOption),
    totalVotes: poll.total_votes,
  };
}

function mapPollOption(option: BackendPollOption): PollOption {
  return {
    id: option.id,
    label: option.label,
    imageUrl: normalizeMediaUrl(option.image_url),
    votes: option.votes,
  };
}

function normalizeMediaUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return "";
  }

  if (trimmedUrl.startsWith("/")) {
    return `${API_ORIGIN}${trimmedUrl}`;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const apiOrigin = new URL(API_ORIGIN);
    const isBackendUpload = parsedUrl.pathname.startsWith("/uploads/");

    if (isBackendUpload && isPrivateOrLocalHost(parsedUrl.hostname)) {
      parsedUrl.protocol = apiOrigin.protocol;
      parsedUrl.host = apiOrigin.host;
      return parsedUrl.toString();
    }

    return parsedUrl.toString();
  } catch {
    return trimmedUrl;
  }
}

function getUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "http://127.0.0.1:8000";
  }
}

function isPrivateOrLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

function mapComment(comment: BackendComment): Comment {
  return {
    id: comment.id,
    author: mapUser(comment.author),
    content: comment.content,
    createdAt: comment.created_at,
  };
}

function mapAIRecommendation(recommendation: BackendAIRecommendation): AIRecommendation {
  return {
    id: recommendation.id,
    title: recommendation.title,
    rationale: recommendation.rationale,
    items: recommendation.items.map(mapAIRecommendationItem),
    previewImageUrl: recommendation.preview_image_url,
  };
}

function mapAIRecommendationItem(item: BackendAIRecommendationItem): AIRecommendationItem {
  return {
    category: item.category,
    description: item.description,
    color: item.color ?? undefined,
  };
}
