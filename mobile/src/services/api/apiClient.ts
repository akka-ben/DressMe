import type { DressMeClient } from "../types";
import type {
  AIRecommendation,
  AIRecommendationItem,
  AuthMessage,
  AuthSession,
  Comment,
  Poll,
  PollOption,
  Post,
  Profile,
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

const DEFAULT_API_URL = "http://192.168.0.197:8000/api/v1";

export const API_URL =
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL
    : DEFAULT_API_URL;

type BackendUser = {
  id: string;
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
  hashtags: string[];
  garment_tags: string[];
  image_urls: string[];
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  created_at: string;
  poll?: BackendPoll | null;
};

type BackendComment = {
  id: string;
  author: BackendUser;
  content: string;
  created_at: string;
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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiDressMeClient implements DressMeClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    init?: RequestInit,
    token?: string,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
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

  async getMe(token: string): Promise<User> {
    const user = await this.request<BackendUser>("/auth/me", undefined, token);
    return mapUser(user);
  }

  async getFeed(): Promise<Post[]> {
    const posts = await this.request<BackendPost[]>("/feed");
    return posts.map(mapPost);
  }

  async getPostComments(postId: string): Promise<Comment[]> {
    const comments = await this.request<BackendComment[]>(`/posts/${postId}/comments`);
    return comments.map(mapComment);
  }

  async getProfile(userId: string): Promise<Profile> {
    const profile = await this.request<BackendProfile>(`/users/${userId}`);
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
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    email: user.email ?? "",
    avatarUrl: user.avatar_url ?? undefined,
    bio: user.bio ?? undefined,
  };
}

function mapProfile(profile: BackendProfile): Profile {
  return {
    ...mapUser(profile),
    followerCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    postCount: profile.post_count ?? 0,
  };
}

function mapPost(post: BackendPost): Post {
  return {
    id: post.id,
    author: mapUser(post.author),
    caption: post.caption,
    hashtags: post.hashtags,
    garmentTags: post.garment_tags,
    imageUrls: post.image_urls,
    likeCount: post.like_count,
    commentCount: post.comment_count,
    likedByMe: post.liked_by_me,
    createdAt: post.created_at,
    poll: post.poll ? mapPoll(post.poll) : undefined,
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
    imageUrl: option.image_url,
    votes: option.votes,
  };
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
