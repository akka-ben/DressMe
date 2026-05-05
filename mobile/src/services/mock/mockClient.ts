import {
  mockComments,
  mockConversations,
  mockMessages,
  mockPosts,
  mockProfile,
  mockRecommendations,
} from "./mockData";
import type { DressMeClient } from "../types";
import type { AuthMessage, AuthSession, CallSession, User } from "../../types/contracts";


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

  async startCall(): Promise<CallSession> {
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

  async helpMeChoose() {
    await delay(600);
    return mockRecommendations;
  }
}
