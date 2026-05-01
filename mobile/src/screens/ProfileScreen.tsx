import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Bookmark, CheckCircle2, Grid3X3, Settings, Tag } from "lucide-react-native";

import { currentUser, posts } from "../data/fashionData";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, fonts, radius, shadow } from "../theme/dressme";

type ProfileTab = "posts" | "saved" | "tagged";

export function ProfileScreen() {
  const [active, setActive] = useState<ProfileTab>("posts");
  const visiblePosts =
    active === "saved" ? posts.filter((post) => post.isSaved) : posts.slice(0, active === "tagged" ? 4 : 6);

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text style={styles.username}>@{currentUser.username}</Text>
        <Settings size={22} color={colors.burgundy} />
      </View>

      <View style={styles.card}>
        <View style={styles.profileTop}>
          <Image source={{ uri: currentUser.avatar }} style={styles.avatar} />
          <View style={styles.stats}>
            <Stat label="Publications" value="24" />
            <Stat label="Abonnés" value={formatNumber(currentUser.followers)} />
            <Stat label="Abonnements" value={String(currentUser.following)} />
          </View>
        </View>
        <View style={styles.nameLine}>
          <Text style={styles.name}>{currentUser.name}</Text>
          <CheckCircle2 size={17} color={colors.gold} fill={colors.gold} />
        </View>
        <Text style={styles.bio}>{currentUser.bio}</Text>
        <Text style={styles.city}>{currentUser.city} · Minimal & streetwear</Text>
        <PrimaryButton label="Modifier le profil" variant="secondary" onPress={() => undefined} />
      </View>

      <View style={styles.tabs}>
        <ProfileTabButton active={active === "posts"} label="Publications" Icon={Grid3X3} onPress={() => setActive("posts")} />
        <ProfileTabButton active={active === "saved"} label="Sauvegardés" Icon={Bookmark} onPress={() => setActive("saved")} />
        <ProfileTabButton active={active === "tagged"} label="Tagués" Icon={Tag} onPress={() => setActive("tagged")} />
      </View>

      <View style={styles.grid}>
        {visiblePosts.map((post) => (
          <Image key={post.id} source={{ uri: post.image }} style={styles.tile} />
        ))}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProfileTabButton({
  active,
  label,
  Icon,
  onPress,
}: {
  active: boolean;
  label: string;
  Icon: typeof Grid3X3;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Icon size={18} color={active ? colors.burgundy : colors.muted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

const styles = StyleSheet.create({
  shell: {
    gap: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  username: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.beige,
    borderWidth: 3,
    borderColor: colors.gold,
  },
  stats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 17,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  bio: {
    color: colors.text,
    lineHeight: 19,
  },
  city: {
    color: colors.muted,
    fontSize: 13,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.cream,
  },
  tabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.burgundy,
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
});
