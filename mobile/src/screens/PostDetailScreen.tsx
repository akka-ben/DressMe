import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";
import { client } from "../services";
import type { Comment } from "../types/contracts";


export function PostDetailScreen() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteMessage, setVoteMessage] = useState("Vote between two looks in the mock poll.");

  useEffect(() => {
    client
      .getPostComments("p-1")
      .then(setComments)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SectionCard title="Post Detail" subtitle="Comments and votes can already be consumed through the typed service layer.">
      <View style={styles.actions}>
        <PrimaryButton label="Vote Look A" onPress={() => setVoteMessage("You voted for Tenue A.")} />
        <PrimaryButton label="Vote Look B" onPress={() => setVoteMessage("You voted for Tenue B.")} />
      </View>
      <Text style={styles.status}>{voteMessage}</Text>
      {loading ? (
        <ActivityIndicator color="#8f4d32" />
      ) : (
        comments.map((comment) => (
          <View key={comment.id} style={styles.comment}>
            <Text style={styles.author}>
              {comment.author.firstName} {comment.author.lastName}
            </Text>
            <Text style={styles.body}>{comment.content}</Text>
          </View>
        ))
      )}
    </SectionCard>
  );
}


const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  status: {
    fontSize: 13,
    color: "#8f4d32",
  },
  comment: {
    backgroundColor: "#fffaf5",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  author: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f1a17",
  },
  body: {
    fontSize: 13,
    color: "#5f554d",
  },
});
