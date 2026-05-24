export type User = {
  id: string;
  username?: string;
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
  isPrivate: boolean;
  followStatus: "self" | "not_following" | "following" | "requested";
  canViewPosts: boolean;
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

export type SearchHashtag = {
  tag: string;
  postCount: number;
  latestPost?: Post;
};

export type SearchPlace = {
  id: string;
  name: string;
  subtitle?: string;
  postCount: number;
  latestPost?: Post;
};

export type SearchResults = {
  query: string;
  users: User[];
  hashtags: SearchHashtag[];
  videos: Post[];
  places: SearchPlace[];
  topPosts: Post[];
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

export type LiveSession = {
  id: string;
  host: User;
  title?: string;
  status: "live" | "ended";
  viewerCount: number;
  startedAt: string;
  endedAt?: string;
};

export type ActivityNotification = {
  id: string;
  tab: "you" | "following";
  type:
    | "like"
    | "comment"
    | "save"
    | "share"
    | "follow"
    | "follow_request"
    | "mention"
    | "tag"
    | "live"
    | "story"
    | "suggestion"
    | "shopping"
    | "post";
  filterKey:
    | "all"
    | "requests"
    | "likes"
    | "comments"
    | "mentions"
    | "follows"
    | "live"
    | "stories"
    | "shopping"
    | "suggestions"
    | "shares"
    | "saves";
  actors: User[];
  actorCount: number;
  title: string;
  body?: string;
  targetType: "post" | "profile" | "live" | "story" | "shopping" | "none";
  targetId?: string;
  targetPost?: Post;
  thumbnailUrl?: string;
  action: "follow_back" | "view_request" | "open" | "none";
  actionLabel?: string;
  createdAt: string;
  read: boolean;
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
  kind: "text" | "image" | "audio" | "shared_post" | "shared_ai_look";
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
};

export type CallSession = {
  id: string;
  kind: "audio" | "video";
  state: "ringing" | "connecting" | "in_call" | "ended";
  peer: User;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  callerCandidates: RTCIceCandidateInit[];
  receiverCandidates: RTCIceCandidateInit[];
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

export type ReportPostInput = {
  reasonKey: string;
  reasonLabel: string;
};

export type ReportPostResult = {
  message: string;
};

export type PostStats = {
  postId: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
};
