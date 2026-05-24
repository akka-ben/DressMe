import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Home, Search, Send, User, Video } from "lucide-react-native";

import { colors, fonts } from "../theme/dressme";
import { touchHitSlop, touchRetentionOffset } from "../utils/touchTargets";

export type AppTab = "feed" | "search" | "reels" | "messages" | "profile";


type Props = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  messageBadgeCount?: number;
};


const tabs: Array<{ key: AppTab; label: string; Icon: typeof Home }> = [
  { key: "feed", label: "Feed", Icon: Home },
  { key: "search", label: "Recherche", Icon: Search },
  { key: "reels", label: "Reels", Icon: Video },
  { key: "messages", label: "Messages", Icon: Send },
  { key: "profile", label: "Profil", Icon: User },
];


export function TabBar({ activeTab, onChange, messageBadgeCount = 0 }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        const Icon = tab.Icon;

        return (
          <Pressable
            key={tab.key}
            hitSlop={touchHitSlop}
            onPress={() => onChange(tab.key)}
            pressRetentionOffset={touchRetentionOffset}
            style={[styles.tab, active && styles.activeTab]}
          >
            <View>
              <Icon size={21} strokeWidth={2.1} color={active ? colors.burgundy : colors.muted} />
              {tab.key === "messages" && messageBadgeCount > 0 ? (
                <Text style={styles.badge}>{messageBadgeCount > 99 ? "99+" : messageBadgeCount}</Text>
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 18,
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 3,
  },
  activeTab: {
    backgroundColor: colors.cream,
    borderRadius: 12,
  },
  label: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 10,
    fontFamily: fonts.body,
  },
  activeLabel: {
    color: colors.burgundy,
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -13,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.burgundy,
    borderWidth: 1,
    borderColor: colors.white,
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 4,
    paddingTop: 1,
    textAlign: "center",
  },
});
