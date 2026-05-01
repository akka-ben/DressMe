import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Search } from "lucide-react-native";

import { posts, getUser } from "../data/fashionData";
import { colors, fonts, radius, shadow } from "../theme/dressme";

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return posts;
    }
    return posts.filter((post) => {
      const user = getUser(post.userId);
      return `${post.description} ${post.hashtags.join(" ")} ${user.name}`.toLowerCase().includes(value);
    });
  }, [query]);

  return (
    <View style={styles.shell}>
      <Text style={styles.title}>Recherche</Text>
      <View style={styles.searchBox}>
        <Search size={18} color={colors.burgundy} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher des tenues, styles, utilisateurs..."
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      <View style={styles.grid}>
        {filtered.map((post) => (
          <Pressable key={post.id} style={styles.tile}>
            <Image source={{ uri: post.image }} style={styles.image} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 14,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  searchBox: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    ...shadow.card,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  tile: {
    width: "32.9%",
    aspectRatio: 1,
    backgroundColor: colors.beige,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
