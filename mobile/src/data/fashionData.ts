export type FashionUser = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  city: string;
  followers: number;
  following: number;
  verified?: boolean;
};

export type FashionPost = {
  id: string;
  userId: string;
  image: string;
  description: string;
  hashtags: string[];
  likes: number;
  comments: number;
  timestamp: string;
  isLiked: boolean;
  isSaved: boolean;
  isPoll?: boolean;
  pollQuestion?: string;
  pollOptions?: Array<{ id: string; image: string; label: string; votes: number }>;
};

export type FashionStory = {
  id: string;
  userId: string;
  image: string;
  timestamp: string;
  viewed: boolean;
};

export type FashionMessage = {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
};

export type FashionConversation = {
  id: string;
  title: string;
  participants: string[];
  messages: FashionMessage[];
  unread: number;
  isGroup: boolean;
};

export type FashionNotification = {
  id: string;
  type: "like" | "comment" | "follow" | "poll" | "ai";
  userId: string;
  text: string;
  timestamp: string;
  read: boolean;
};

export type AISuggestion = {
  id: string;
  image: string;
  title: string;
  description: string;
};

export const currentUser: FashionUser = {
  id: "me",
  name: "Mohammed Ben Akka",
  username: "mohammed.fit",
  avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Mohammed",
  bio: "Streetwear, minimalisme et silhouettes propres.",
  city: "Casablanca",
  followers: 1240,
  following: 312,
  verified: true,
};

export const users: FashionUser[] = [
  currentUser,
  {
    id: "u1",
    name: "Amina Benjelloun",
    username: "amina_style",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Amina",
    bio: "Casablanca fits, brunch looks, textures chaudes.",
    city: "Casablanca",
    followers: 1240,
    following: 431,
    verified: true,
  },
  {
    id: "u2",
    name: "Karim Alaoui",
    username: "karim_looks",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Karim",
    bio: "Streetwear daily rotation.",
    city: "Rabat",
    followers: 892,
    following: 208,
  },
  {
    id: "u3",
    name: "Sophia Laurent",
    username: "sophialaurent",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Sophia",
    bio: "Paris stylist. Editorial silhouettes.",
    city: "Paris",
    followers: 2340,
    following: 499,
    verified: true,
  },
  {
    id: "u4",
    name: "Youssef Tazi",
    username: "youssef_fit",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Youssef",
    bio: "Minimal menswear and clean layers.",
    city: "Casablanca",
    followers: 567,
    following: 140,
  },
  {
    id: "u5",
    name: "Leila Mansouri",
    username: "leila_chic",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Leila",
    bio: "Marrakech vintage, silk scarves, muted palettes.",
    city: "Marrakech",
    followers: 1890,
    following: 287,
    verified: true,
  },
  {
    id: "u6",
    name: "Omar Chraibi",
    username: "omar_urban",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Omar",
    bio: "Urban explorer.",
    city: "Tangier",
    followers: 445,
    following: 192,
  },
  {
    id: "u7",
    name: "Nadia Berrada",
    username: "nadia_glam",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Nadia",
    bio: "Glam and glow.",
    city: "Paris",
    followers: 3120,
    following: 612,
    verified: true,
  },
  {
    id: "u8",
    name: "Mehdi Ziani",
    username: "mehdi_style",
    avatar: "https://api.dicebear.com/8.x/avataaars/png?seed=Mehdi",
    bio: "Classic menswear, loafers, tailoring.",
    city: "Casablanca",
    followers: 723,
    following: 221,
  },
];

export const posts: FashionPost[] = [
  {
    id: "p1",
    userId: "u1",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900",
    description: "Brunch casual avec blazer oversized et denim clair.",
    hashtags: ["#casual", "#weekend", "#chic"],
    likes: 234,
    comments: 18,
    timestamp: "12 min",
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p2",
    userId: "u3",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900",
    description: "Gala ce soir. J'hesite entre satin noir et tailleur creme.",
    hashtags: ["#soirée", "#gala", "#helpmechoose"],
    likes: 456,
    comments: 42,
    timestamp: "35 min",
    isLiked: true,
    isSaved: false,
    isPoll: true,
    pollQuestion: "Quelle tenue preferez-vous ?",
    pollOptions: [
      {
        id: "a",
        image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600",
        label: "Satin noir",
        votes: 72,
      },
      {
        id: "b",
        image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600",
        label: "Tailleur creme",
        votes: 58,
      },
    ],
  },
  {
    id: "p3",
    userId: "u5",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900",
    description: "Vintage boheme depuis Marrakech, foulard soie et bottes camel.",
    hashtags: ["#boheme", "#vintage", "#marrakech"],
    likes: 892,
    comments: 51,
    timestamp: "1 h",
    isLiked: false,
    isSaved: true,
  },
  {
    id: "p4",
    userId: "u7",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900",
    description: "Shooting glam, burgundy lips et robe texturee.",
    hashtags: ["#glam", "#fashion", "#editorial"],
    likes: 1240,
    comments: 89,
    timestamp: "2 h",
    isLiked: true,
    isSaved: true,
  },
  {
    id: "p5",
    userId: "u2",
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900",
    description: "Streetwear essentials: hoodie lourd, cargo, sneakers blanches.",
    hashtags: ["#streetwear", "#urban"],
    likes: 567,
    comments: 27,
    timestamp: "3 h",
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p6",
    userId: "u4",
    image: "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=900",
    description: "Minimalisme: maille fine, pantalon droit, palette sable.",
    hashtags: ["#minimal", "#menswear"],
    likes: 423,
    comments: 12,
    timestamp: "4 h",
    isLiked: false,
    isSaved: false,
  },
];

export const stories: FashionStory[] = [
  { id: "s1", userId: "me", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900", timestamp: "Now", viewed: false },
  { id: "s2", userId: "u1", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900", timestamp: "9 min", viewed: false },
  { id: "s3", userId: "u2", image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900", timestamp: "18 min", viewed: false },
  { id: "s4", userId: "u3", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900", timestamp: "22 min", viewed: false },
  { id: "s5", userId: "u4", image: "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=900", timestamp: "1 h", viewed: true },
  { id: "s6", userId: "u5", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900", timestamp: "1 h", viewed: false },
  { id: "s7", userId: "u7", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900", timestamp: "2 h", viewed: false },
  { id: "s8", userId: "u8", image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=900", timestamp: "2 h", viewed: true },
];

export const conversations: FashionConversation[] = [
  {
    id: "c1",
    title: "Amina Benjelloun",
    participants: ["me", "u1"],
    unread: 2,
    isGroup: false,
    messages: [
      { id: "m1", senderId: "u1", text: "Le blazer camel marche mieux avec ton jean clair.", timestamp: "14:20" },
      { id: "m2", senderId: "me", text: "Je t'envoie la tenue finale avant de poster.", timestamp: "14:22" },
      { id: "m3", senderId: "u1", text: "Oui, ajoute des loafers marron.", timestamp: "14:23" },
    ],
  },
  {
    id: "c2",
    title: "Groupe Mode",
    participants: ["me", "u3", "u5", "u7"],
    unread: 5,
    isGroup: true,
    messages: [
      { id: "m4", senderId: "u3", text: "Qui vote pour la tenue B ?", timestamp: "13:02" },
      { id: "m5", senderId: "u7", text: "B sans hesitation, plus editorial.", timestamp: "13:05" },
    ],
  },
  {
    id: "c3",
    title: "Karim Alaoui",
    participants: ["me", "u2"],
    unread: 0,
    isGroup: false,
    messages: [
      { id: "m6", senderId: "u2", text: "Tu as le lien des sneakers ?", timestamp: "Hier" },
    ],
  },
  {
    id: "c4",
    title: "Leila Mansouri",
    participants: ["me", "u5"],
    unread: 1,
    isGroup: false,
    messages: [
      { id: "m7", senderId: "u5", text: "Ce foulard vintage vient de Gueliz.", timestamp: "Hier" },
    ],
  },
];

export const notifications: FashionNotification[] = [
  { id: "n1", type: "like", userId: "u7", text: "a aime votre publication", timestamp: "2 min", read: false },
  { id: "n2", type: "comment", userId: "u1", text: "a commente: Le blazer est parfait", timestamp: "8 min", read: false },
  { id: "n3", type: "follow", userId: "u3", text: "s'est abonnee a vous", timestamp: "21 min", read: false },
  { id: "n4", type: "poll", userId: "u5", text: "Votre sondage a 58 votes", timestamp: "1 h", read: true },
  { id: "n5", type: "ai", userId: "me", text: "Vos suggestions de style sont pretes", timestamp: "2 h", read: true },
  { id: "n6", type: "like", userId: "u2", text: "a aime votre look minimal", timestamp: "3 h", read: true },
];

export const aiSuggestions: AISuggestion[] = [
  {
    id: "ai1",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900",
    title: "Look Casual Chic",
    description: "Chemise blanche structuree, blazer camel, jean droit et loafers marron pour un brunch elegant.",
  },
  {
    id: "ai2",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900",
    title: "Business Elegant",
    description: "Tailleur creme, top noir minimal, sac compact et bijoux dores discrets.",
  },
  {
    id: "ai3",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900",
    title: "Soiree Glamour",
    description: "Robe satin burgundy, escarpins noirs et pochette doree pour un effet editorial.",
  },
];

export function getUser(userId: string): FashionUser {
  return users.find((user) => user.id === userId) ?? currentUser;
}
