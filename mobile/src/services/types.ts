import type {
  AIRecommendation,
  AuthMessage,
  AuthSession,
  CallSession,
  Comment,
  Conversation,
  Message,
  Post,
  Profile,
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
  getFeed(): Promise<Post[]>;
  getPostComments(postId: string): Promise<Comment[]>;
  getProfile(userId: string): Promise<Profile>;
  getChatUsers(token?: string): Promise<User[]>;
  getConversations(token?: string): Promise<Conversation[]>;
  startConversation(userId: string, token?: string): Promise<Conversation>;
  getConversationMessages(conversationId: string, token?: string): Promise<Message[]>;
  sendConversationMessage(
    conversationId: string,
    input: { body: string; kind?: "text" | "image" | "audio" },
    token?: string,
  ): Promise<Message>;
  startCall(peerId: string, kind: "audio" | "video", token?: string): Promise<CallSession>;
  getIncomingCalls(token?: string): Promise<CallSession[]>;
  answerCall(callId: string, token?: string): Promise<CallSession>;
  rejectCall(callId: string, token?: string): Promise<CallSession>;
  helpMeChoose(input: {
    imageUrl: string;
    occasion?: string;
    userPrompt?: string;
  }): Promise<AIRecommendation[]>;
}
