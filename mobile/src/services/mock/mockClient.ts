import {
  mockComments,
  mockConversations,
  mockMessages,
  mockPosts,
  mockProfile,
  mockRecommendations,
} from "./mockData";
import type { DressMeClient } from "../types";
import type {
  ActivityNotification,
  AuthMessage,
  AuthSession,
  CallSession,
  Comment,
  LiveSession,
  MediaUpload,
  Post,
  PostStats,
  Profile,
  SearchResults,
  Story,
  User,
} from "../../types/contracts";


const delay = async (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));


export class MockDressMeClient implements DressMeClient {
  async login(): Promise<AuthSession> {
    throw new Error("Mock authentication is disabled. Use ApiDressMeClient.");
  }

  async register(): Promise<AuthMessage> {
    throw new Error("Mock authentication is disabled. Use ApiDressMeClient.");
  }

  async forgotPassword(): Promise<AuthMessage> {
    throw new Error("Mock authentication is disabled. Use ApiDressMeClient.");
  }

  async resetPassword(): Promise<AuthMessage> {
    throw new Error("Mock authentication is disabled. Use ApiDressMeClient.");
  }

  async getMe(): Promise<User> {
    throw new Error("Mock authentication is disabled. Use ApiDressMeClient.");
  }

  async search(): Promise<SearchResults> {
    await delay();
    return {
      query: "",
      users: [],
      hashtags: [],
      videos: [],
      places: [],
      topPosts: mockPosts,
    };
  }

  async getFeed() {
    await delay();
    return mockPosts;
  }

  async getReels() {
    await delay();
    return mockPosts.filter((post) => post.mediaType === "video");
  }

  async uploadMedia(): Promise<MediaUpload> {
    throw new Error("Mock uploadMedia is disabled. Use ApiDressMeClient.");
  }

  async getStories(): Promise<Story[]> {
    await delay();
    return [];
  }

  async getStoryViewers(): Promise<User[]> {
    await delay();
    return [];
  }

  async createStory(): Promise<Story> {
    throw new Error("Mock createStory is disabled. Use ApiDressMeClient.");
  }

  async markStoryViewed(): Promise<Story> {
    throw new Error("Mock markStoryViewed is disabled. Use ApiDressMeClient.");
  }

  async getFollowers(): Promise<User[]> {
    await delay();
    return [];
  }

  async getPost(): Promise<Post> {
    await delay();
    return mockPosts[0];
  }

  async createPost(): Promise<Post> {
    throw new Error("Mock createPost is disabled. Use ApiDressMeClient.");
  }

  async togglePostLike(): Promise<Post> {
    throw new Error("Mock togglePostLike is disabled. Use ApiDressMeClient.");
  }

  async sharePost(): Promise<Post> {
    throw new Error("Mock sharePost is disabled. Use ApiDressMeClient.");
  }

  async togglePostSave(): Promise<Post> {
    throw new Error("Mock togglePostSave is disabled. Use ApiDressMeClient.");
  }

  async getPostComments() {
    await delay();
    return mockComments;
  }

  async addPostComment(): Promise<Comment> {
    throw new Error("Mock addPostComment is disabled. Use ApiDressMeClient.");
  }

  async getSavedPosts() {
    await delay();
    return mockPosts.filter((post) => post.savedByMe);
  }

  async getNotifications(): Promise<ActivityNotification[]> {
    await delay();
    return [];
  }

  async markNotificationsRead(): Promise<void> {
    await delay();
  }

  async getLiveSessions(): Promise<LiveSession[]> {
    await delay();
    return [];
  }

  async createLiveSession(): Promise<LiveSession> {
    throw new Error("Mock createLiveSession is disabled. Use ApiDressMeClient.");
  }

  async endLiveSession(): Promise<LiveSession> {
    throw new Error("Mock endLiveSession is disabled. Use ApiDressMeClient.");
  }

  async getProfile() {
    await delay();
    return mockProfile;
  }

  async getProfilePosts() {
    await delay();
    return mockPosts;
  }

  async followUser() {
    await delay();
    return { ...mockProfile, followStatus: mockProfile.isPrivate ? "requested" : "following" } as const;
  }

  async unfollowUser() {
    await delay();
    return { ...mockProfile, followStatus: "not_following" } as const;
  }

  async getChatUsers() {
    await delay();
    return mockConversations[0].participants;
  }

  async getConversations() {
    await delay();
    return mockConversations;
  }

  async startConversation() {
    await delay();
    return mockConversations[0];
  }

  async getConversationMessages() {
    await delay();
    return mockMessages;
  }

  async sendConversationMessage(
    conversationId: string,
    input: { body: string; kind?: "text" | "image" | "audio" },
    _token?: string,
  ) {
    await delay();
    return {
      id: `mock-${Date.now()}`,
      conversationId,
      sender: mockConversations[0].participants[0],
      kind: input.kind ?? "text",
      body: input.body,
      createdAt: new Date().toISOString(),
    };
  }

  async deleteConversationMessage(): Promise<void> {
    await delay();
  }

  async startCall(): Promise<CallSession> {
    throw new Error("Mock calls are disabled. Use ApiDressMeClient.");
  }

  async getCall(): Promise<CallSession> {
    throw new Error("Mock calls are disabled. Use ApiDressMeClient.");
  }

  async getIncomingCalls() {
    return [];
  }

  async answerCall(): Promise<CallSession> {
    throw new Error("Mock calls are disabled. Use ApiDressMeClient.");
  }

  async rejectCall(): Promise<CallSession> {
    throw new Error("Mock calls are disabled. Use ApiDressMeClient.");
  }

  async endCall(): Promise<CallSession> {
    throw new Error("Mock calls are disabled. Use ApiDressMeClient.");
  }

  async addIceCandidate(): Promise<CallSession> {
    throw new Error("Mock calls are disabled. Use ApiDressMeClient.");
  }

  async helpMeChoose() {
    await delay(600);
    return mockRecommendations;
  }

  async getMyPosts(): Promise<Post[]> {
    await delay();
    return mockPosts;
  }

  async updateProfile(): Promise<Profile> {
    throw new Error("Mock updateProfile is disabled. Use ApiDressMeClient.");
  }

  async getUserPosts(): Promise<Post[]> {
    await delay();
    return mockPosts;
  }

  async getUserFollowers(): Promise<User[]> {
    await delay();
    return [];
  }

  async getFollowing(): Promise<User[]> {
    await delay();
    return [];
  }

  async changePassword(): Promise<{ message: string }> {
    throw new Error("Mock changePassword is disabled. Use ApiDressMeClient.");
  }

  async pingOnline(): Promise<void> {
    return;
  }

  async getSuggestions(): Promise<User[]> {
    await delay();
    return [];
  }

  async blockUser(): Promise<void> {
    return;
  }

  async unblockUser(): Promise<void> {
    return;
  }

  async getPostStats(): Promise<PostStats> {
    await delay();
    return { postId: "", likeCount: 0, commentCount: 0, shareCount: 0, saveCount: 0 };
  }
}
