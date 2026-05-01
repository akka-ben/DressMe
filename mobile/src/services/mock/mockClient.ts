import { mockComments, mockPosts, mockProfile, mockRecommendations } from "./mockData";
import type { DressMeClient } from "../types";
import type { AuthMessage, AuthSession, User } from "../../types/contracts";


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

  async getPostComments() {
    await delay();
    return mockComments;
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
