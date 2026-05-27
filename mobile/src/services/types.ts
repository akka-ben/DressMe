import type {
  AIRecommendation,
  ActivityNotification,
  AuthMessage,
  AuthSession,
  CallSession,
  Comment,
  Conversation,
  LiveSession,
  MediaUpload,
  Message,
  Post,
  PostStats,
  Profile,
  ReportPostInput,
  ReportPostResult,
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
  reportPost(postId: string, input: ReportPostInput, token: string): Promise<ReportPostResult>;
  deletePost(postId: string, token: string): Promise<void>;
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
  getChatUsers(token?: string): Promise<User[]>;
  getConversations(token?: string): Promise<Conversation[]>;
  startConversation(userId: string, token?: string): Promise<Conversation>;
  getConversationMessages(conversationId: string, token?: string): Promise<Message[]>;
  sendConversationMessage(
    conversationId: string,
    input: { body: string; kind?: "text" | "image" | "audio" | "shared_post" | "shared_ai_look" },
    token?: string,
  ): Promise<Message>;
  deleteConversationMessage(conversationId: string, messageId: string, token?: string): Promise<void>;
  startCall(
    peerId: string,
    kind: "audio" | "video",
    token?: string,
    offer?: RTCSessionDescriptionInit,
  ): Promise<CallSession>;
  getCall(callId: string, token?: string): Promise<CallSession>;
  getIncomingCalls(token?: string): Promise<CallSession[]>;
  answerCall(callId: string, token?: string, answer?: RTCSessionDescriptionInit): Promise<CallSession>;
  rejectCall(callId: string, token?: string): Promise<CallSession>;
  endCall(callId: string, token?: string): Promise<CallSession>;
  addIceCandidate(callId: string, candidate: RTCIceCandidateInit, token?: string): Promise<CallSession>;
  helpMeChoose(input: {
    imageUrl: string;
    occasion?: string;
    userPrompt?: string;
  }): Promise<AIRecommendation[]>;
  getMyPosts(token: string): Promise<Post[]>;
  updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; bio?: string; avatarUrl?: string },
    token: string,
  ): Promise<Profile>;
  getUserPosts(userId: string, token?: string): Promise<Post[]>;
  getFollowing(userId: string, token?: string): Promise<User[]>;
  getUserFollowers(userId: string, token?: string): Promise<User[]>;
  getSuggestions(userId: string, token?: string): Promise<User[]>;
  changePassword(currentPassword: string, newPassword: string, token: string): Promise<{ message: string }>;
  pingOnline(token: string): Promise<void>;
  blockUser(userId: string, token: string): Promise<void>;
  unblockUser(userId: string, token: string): Promise<void>;
}
