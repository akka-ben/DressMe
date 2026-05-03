import { mockComments, mockPosts, mockProfile, mockRecommendations } from "./mockData";
import type { DressMeClient } from "../types";
import type { AuthMessage, AuthSession, Comment, MediaUpload, Post, Story, User } from "../../types/contracts";


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

  async getProfile() {
    await delay();
    return mockProfile;
  }

  async helpMeChoose() {
    await delay(600);
    return mockRecommendations;
  }
}
