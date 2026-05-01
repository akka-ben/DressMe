import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";


export type AppTab = "feed" | "create" | "profile";


type Props = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};


const tabs: Array<{ key: AppTab; label: string }> = [
  { key: "feed", label: "Feed" },
  { key: "create", label: "Create" },
  { key: "profile", label: "Profile" },
];


export function TabBar({ activeTab, onChange }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, active && styles.activeTab]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eadfd5",
    backgroundColor: "#fffaf5",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#efe6dc",
  },
  activeTab: {
    backgroundColor: "#8f4d32",
  },
  label: {
    color: "#6d635c",
    fontWeight: "700",
    fontSize: 13,
  },
  activeLabel: {
    color: "#fffaf5",
  },
});
