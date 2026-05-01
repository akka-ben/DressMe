import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { client } from "../services";
import type { AIRecommendation, Post } from "../types/contracts";

export function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AIRecommendation[]>>({});
  const [status, setStatus] = useState("Try the feed actions below.");

  useEffect(() => {
    client
      .getFeed()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Feed</Text>
      {loading ? (
        <ActivityIndicator color="#8f4d32" />
      ) : (
        posts.map((post) => (
          <View key={post.id} style={styles.post}>
            <Image source={{ uri: post.imageUrls[0] }} style={styles.image} />
            <Text style={styles.caption}>{post.caption}</Text>
            <Text style={styles.meta}>
              {(post.likeCount + (likedPosts[post.id] ? 1 : 0))} likes · {post.commentCount} comments
            </Text>
            <Text style={styles.tags}>{post.hashtags.join(" ")}</Text>
            <View style={styles.actions}>
              <PrimaryButton
                label={likedPosts[post.id] ? "Liked" : "Like"}
                onPress={() => {
                  setLikedPosts((current) => ({ ...current, [post.id]: !current[post.id] }));
                  setStatus(likedPosts[post.id] ? "Like removed." : "Post liked.");
                }}
              />
              <PrimaryButton
                label="Help Me Choose"
                onPress={async () => {
                  setStatus("Loading mock AI suggestions...");
                  const looks = await client.helpMeChoose({
                    imageUrl: post.imageUrls[0],
                    occasion: "soirée",
                  });
                  setAiSuggestions((current) => ({ ...current, [post.id]: looks }));
                  setStatus("AI suggestions loaded.");
                }}
              />
            </View>
            {aiSuggestions[post.id]?.map((look) => (
              <View key={look.id} style={styles.aiCard}>
                <Text style={styles.aiTitle}>{look.title}</Text>
                <Text style={styles.aiText}>{look.rationale}</Text>
              </View>
            ))}
          </View>
        ))
      )}
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#eadfd5",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1a17",
  },
  post: {
    gap: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#e8ddd3",
  },
  caption: {
    fontSize: 15,
    color: "#1f1a17",
  },
  meta: {
    fontSize: 13,
    color: "#6d635c",
  },
  tags: {
    fontSize: 13,
    color: "#8f4d32",
  },
  aiCard: {
    backgroundColor: "#fffaf5",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f1a17",
  },
  aiText: {
    fontSize: 13,
    color: "#5f554d",
  },
  status: {
    fontSize: 13,
    color: "#8f4d32",
  },
});
