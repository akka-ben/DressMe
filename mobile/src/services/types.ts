import type {
  AIRecommendation,
  ActivityNotification,
  AuthMessage,
  AuthSession,
  Comment,
  LiveSession,
  MediaUpload,
  Post,
  Profile,
  SearchResults,
  Story,
  User,
} from "../types/contracts";

export interface DressMeClient {
  login(email: string, password: string): Promise<AuthSession>;
  register(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<AuthMessage>;
  forgotPassword(email: string): Promise<AuthMessage>;
  resetPassword(token: string, newPassword: string): Promise<AuthMessage>;
  getMe(token: string): Promise<User>;
  search(input?: { query?: string; token?: string; limit?: number }): Promise<SearchResults>;
  getFeed(input?: { token?: string; limit?: number; offset?: number }): Promise<Post[]>;
  getReels(input?: { token?: string; limit?: number; offset?: number }): Promise<Post[]>;
  uploadMedia(input: { uri: string; name: string; type: string }, token: string): Promise<MediaUpload>;
  getStories(input?: { token?: string; limit?: number }): Promise<Story[]>;
  getStoryViewers(storyId: string, token: string): Promise<User[]>;
  createStory(
    input: {
      mediaUrl: string;
      mediaType?: "image" | "video";
      caption?: string;
    },
    token: string,
  ): Promise<Story>;
  markStoryViewed(storyId: string, token: string): Promise<Story>;
  getFollowers(token: string): Promise<User[]>;
  getPost(postId: string, input?: { token?: string }): Promise<Post>;
  createPost(
    input: {
      caption: string;
      mediaType?: "image" | "video";
      imageUrls: string[];
      hashtags: string[];
      garmentTags?: string[];
    },
    token: string,
  ): Promise<Post>;
  togglePostLike(postId: string, token: string): Promise<Post>;
  sharePost(postId: string, token: string): Promise<Post>;
  togglePostSave(postId: string, token: string): Promise<Post>;
  getPostComments(postId: string, input?: { limit?: number; offset?: number }): Promise<Comment[]>;
  addPostComment(postId: string, content: string, token: string): Promise<Comment>;
  getSavedPosts(input: { token: string; mediaType?: "image" | "video"; limit?: number; offset?: number }): Promise<Post[]>;
  getNotifications(input: { token: string; limit?: number }): Promise<ActivityNotification[]>;
  markNotificationsRead(input: { token: string; notificationIds?: string[] }): Promise<void>;
  getLiveSessions(input: { token: string; limit?: number }): Promise<LiveSession[]>;
  createLiveSession(input: { token: string; title?: string }): Promise<LiveSession>;
  endLiveSession(input: { token: string; liveId: string }): Promise<LiveSession>;
  getProfile(userId: string, input?: { token?: string }): Promise<Profile>;
  getProfilePosts(input: { userId: string; token?: string; limit?: number; offset?: number }): Promise<Post[]>;
  followUser(userId: string, token: string): Promise<Profile>;
  unfollowUser(userId: string, token: string): Promise<Profile>;
  helpMeChoose(input: {
    imageUrl: string;
    occasion?: string;
    userPrompt?: string;
  }): Promise<AIRecommendation[]>;
}
