export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
};

export type Profile = User & {
  followerCount: number;
  followingCount: number;
  postCount: number;
  lastSeen?: string;
};

export type PollOption = {
  id: string;
  label: string;
  imageUrl: string;
  votes: number;
};

export type Poll = {
  id: string;
  options: PollOption[];
  totalVotes: number;
};

export type Post = {
  id: string;
  author: User;
  caption: string;
  mediaType: "image" | "video";
  hashtags: string[];
  garmentTags: string[];
  imageUrls: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  createdAt: string;
  poll?: Poll;
};

export type MediaUpload = {
  url: string;
  filename: string;
  contentType: string;
  mediaType: "image" | "video";
};

export type Story = {
  id: string;
  author: User;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  viewerCount: number;
  viewedByMe: boolean;
  createdAt: string;
  expiresAt: string;
};

export type Comment = {
  id: string;
  author: User;
  content: string;
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: User;
  kind: "text" | "image" | "shared_post" | "shared_ai_look";
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  participants: User[];
  lastMessage?: Message;
};

export type CallSession = {
  id: string;
  kind: "audio" | "video";
  state: "ringing" | "connecting" | "in_call" | "ended";
  peer: User;
};

export type AIRecommendationItem = {
  category: string;
  description: string;
  color?: string;
};

export type AIRecommendation = {
  id: string;
  title: string;
  rationale: string;
  items: AIRecommendationItem[];
  previewImageUrl: string;
};

export type AuthSession = {
  accessToken: string;
  tokenType: "bearer";
  expiresAt?: string;
  expiresIn?: number;
  refreshToken?: string;
  user: User;
};

export type AuthMessage = {
  message: string;
};
