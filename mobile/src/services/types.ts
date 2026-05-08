import type {
  AIRecommendation,
  AuthMessage,
  AuthSession,
  Comment,
  MediaUpload,
  Post,
  PostStats,
  Profile,
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
  getFeed(input?: { token?: string; limit?: number; offset?: number }): Promise<Post[]>;
  getReels(input?: { token?: string; limit?: number; offset?: number }): Promise<Post[]>;
  uploadMedia(input: { uri: string; name: string; type: string }, token: string): Promise<MediaUpload>;
  getStories(input?: { token?: string; limit?: number }): Promise<Story[]>;
  getStoryViewers(storyId: string, token: string): Promise<User[]>;
  getPostStats(postId: string, token: string): Promise<PostStats>;

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
  getProfile(userId: string): Promise<Profile>;
  helpMeChoose(input: {
    imageUrl: string;
    occasion?: string;
    userPrompt?: string;
  }): Promise<AIRecommendation[]>;
  getMyPosts(token: string): Promise<Post[]>;
  updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; bio?: string; avatarUrl?: string },
    token: string
  ): Promise<Profile>;
  followUser(userId: string, token: string): Promise<{ following: boolean }>;
  unfollowUser(userId: string, token: string): Promise<{ following: boolean }>;
  getUserPosts(userId: string, token?: string): Promise<Post[]>;
  getFollowing(userId: string, token?: string): Promise<User[]>;
  getUserFollowers(userId: string, token?: string): Promise<User[]>;
  getSuggestions(userId: string, token?: string): Promise<User[]>;
  changePassword(currentPassword: string, newPassword: string, token: string): Promise<{ message: string }>;
  pingOnline(token: string): Promise<void>;
  blockUser(userId: string, token: string): Promise<void>;
  unblockUser(userId: string, token: string): Promise<void>;
}