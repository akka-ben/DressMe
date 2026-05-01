import type {
  AIRecommendation,
  AuthMessage,
  AuthSession,
  Comment,
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
  getFeed(input?: { token?: string; limit?: number; offset?: number }): Promise<Post[]>;
  createPost(
    input: {
      caption: string;
      imageUrls: string[];
      hashtags: string[];
      garmentTags?: string[];
    },
    token: string,
  ): Promise<Post>;
  togglePostLike(postId: string, token: string): Promise<Post>;
  getPostComments(postId: string): Promise<Comment[]>;
  getProfile(userId: string): Promise<Profile>;
  helpMeChoose(input: {
    imageUrl: string;
    occasion?: string;
    userPrompt?: string;
  }): Promise<AIRecommendation[]>;
}
