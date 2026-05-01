import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { client } from "../services";
import type { AIRecommendation, Profile } from "../types/contracts";

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [message, setMessage] = useState("Profile actions are mocked for now.");

  useEffect(() => {
    Promise.all([
      client.getProfile("u-1"),
      client.helpMeChoose({
        imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
        occasion: "soirée",
      }),
    ])
      .then(([profileResult, recommendationResult]) => {
        setProfile(profileResult);
        setRecommendations(recommendationResult);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Profile + AI Preview</Text>
      {loading ? (
        <ActivityIndicator color="#8f4d32" />
      ) : (
        <>
          <Text style={styles.name}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text style={styles.bio}>{profile?.bio}</Text>
          <Text style={styles.stats}>
            {profile?.followerCount} followers · {profile?.followingCount} following · {profile?.postCount} posts
          </Text>
          <View style={styles.actions}>
            <PrimaryButton
              label={following ? "Following" : "Follow"}
              onPress={() => {
                setFollowing((current) => !current);
                setMessage(following ? "Unfollowed profile." : "Profile followed.");
              }}
            />
            <PrimaryButton
              label="Share AI Look"
              onPress={() => setMessage("Selected AI look shared to chat mock.")}
            />
          </View>
          <Text style={styles.note}>{message}</Text>
          {recommendations.map((look) => (
            <View key={look.id} style={styles.lookCard}>
              <Text style={styles.lookTitle}>{look.title}</Text>
              <Text style={styles.lookText}>{look.rationale}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffaf5",
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
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f1a17",
  },
  bio: {
    fontSize: 14,
    color: "#5f554d",
  },
  stats: {
    fontSize: 13,
    color: "#8f4d32",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  note: {
    fontSize: 13,
    color: "#5f554d",
  },
  lookCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  lookTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f1a17",
  },
  lookText: {
    fontSize: 13,
    color: "#5f554d",
  },
});
