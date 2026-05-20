import type { AIRecommendation, Comment, Conversation, Message, Post, Profile, User } from "../../types/contracts";

const demoUser: User = {
  id: "u-1",
  firstName: "Mohammed",
  lastName: "Ben Akka Ouayad",
  email: "mohammed@example.com",
  bio: "Streetwear, casual and event looks.",
  avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
};

export const mockProfile: Profile = {
  ...demoUser,
  followerCount: 241,
  followingCount: 132,
  postCount: 29,
  isPrivate: false,
  followStatus: "not_following",
  canViewPosts: true,
};

export const mockPosts: Post[] = [
  {
    id: "p-1",
    author: demoUser,
    caption: "Which one works best for dinner tonight?",
    mediaType: "image",
    hashtags: ["#casual", "#nightout"],
    garmentTags: ["blazer", "white-shirt", "brown-loafers"],
    imageUrls: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b"
    ],
    likeCount: 42,
    commentCount: 6,
    shareCount: 0,
    likedByMe: true,
    savedByMe: false,
    createdAt: new Date().toISOString(),
    poll: {
      id: "poll-1",
      totalVotes: 53,
      options: [
        {
          id: "opt-1",
          label: "Tenue A",
          imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
          votes: 24,
        },
        {
          id: "opt-2",
          label: "Tenue B",
          imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b",
          votes: 29,
        },
      ],
    },
  },
];

export const mockComments: Comment[] = [
  {
    id: "c-1",
    author: {
      id: "u-2",
      firstName: "Amine",
      lastName: "El Meskini",
      email: "amine@example.com",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    },
    content: "Tenue B is cleaner. Keep the shoes from look A.",
    createdAt: new Date().toISOString(),
  },
];

export const mockMessages: Message[] = [
  {
    id: "m-1",
    conversationId: "conv-1",
    sender: {
      id: "u-2",
      firstName: "Amine",
      lastName: "El Meskini",
      email: "amine@example.com",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    },
    kind: "text",
    body: "Send me the final look before you post it.",
    createdAt: new Date().toISOString(),
  },
];

export const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    title: "Amine",
    participants: [demoUser, mockMessages[0].sender],
    lastMessage: mockMessages[0],
    unreadCount: 3,
  },
];

export const mockRecommendations: AIRecommendation[] = [
  {
    id: "ai-1",
    title: "Smart Casual Contrast",
    rationale: "Adds structure and keeps the palette elegant for an evening setting.",
    previewImageUrl: mockPosts[0].imageUrls[0],
    items: [
      { category: "Top", description: "White oxford shirt", color: "white" },
      { category: "Outerwear", description: "Camel blazer", color: "camel" },
      { category: "Shoes", description: "Dark brown loafers", color: "brown" },
    ],
  },
  {
    id: "ai-2",
    title: "Minimal Modern",
    rationale: "Uses a sharper silhouette with fewer competing pieces.",
    previewImageUrl: mockPosts[0].imageUrls[0],
    items: [
      { category: "Top", description: "Black fitted tee", color: "black" },
      { category: "Bottom", description: "Charcoal trousers", color: "charcoal" },
      { category: "Shoes", description: "White sneakers", color: "white" },
    ],
  },
  {
    id: "ai-3",
    title: "Relaxed Weekend Layers",
    rationale: "Keeps the outfit comfortable and stylish with softer tones.",
    previewImageUrl: mockPosts[0].imageUrls[1],
    items: [
      { category: "Top", description: "Cream knit polo", color: "cream" },
      { category: "Bottom", description: "Light blue jeans", color: "light blue" },
      { category: "Accessory", description: "Tan crossbody bag", color: "tan" },
    ],
  },
];
