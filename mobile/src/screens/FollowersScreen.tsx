import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ArrowLeft, Search, UserCheck, UserPlus } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import type { User } from "../types/contracts";

type Props = {
  userId: string;
  mode: "followers" | "following";
  onBack?: () => void;
  onOpenProfile?: (userId: string) => void;
};

export function FollowersScreen({ userId, mode, onBack, onOpenProfile }: Props) {
  const { token, user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data =
        mode === "followers"
          ? await client.getUserFollowers(userId, token ?? undefined)
          : await client.getFollowing(userId, token ?? undefined);
      setUsers(data);

      // Charger qui je suis déjà en train de suivre
      if (token && me?.id) {
        const myFollowing = await client.getFollowing(me.id, token);
        setFollowingIds(new Set(myFollowing.map((u) => u.id)));
      }
    } catch (e) {
      console.warn("Erreur chargement liste:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, mode, token, me?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async (targetId: string) => {
    if (!token) return;
    setLoadingId(targetId);
    try {
      if (followingIds.has(targetId)) {
        await client.unfollowUser(targetId, token);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      } else {
        await client.followUser(targetId, token);
        setFollowingIds((prev) => new Set(prev).add(targetId));
      }
    } catch (e) {
      console.warn("Erreur follow/unfollow:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const title = mode === "followers" ? "Abonnés" : "Abonnements";
  const filteredUsers = users.filter((u) => {
  const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
  const username = (u.email?.split("@")[0] ?? "").toLowerCase();
  const q = search.toLowerCase();
  return fullName.includes(q) || username.includes(q);
});
  return (
    <View style={styles.shell}>
      <View style={styles.searchBar}>
        <Search size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={colors.burgundy} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.burgundy} size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            {mode === "followers" ? "Aucun abonné" : "Aucun abonnement"}
          </Text>
          <Text style={styles.emptyText}>
            {mode === "followers"
              ? "Personne ne suit encore ce compte."
              : "Ce compte ne suit encore personne."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredUsers.map((u) => {
            const isMe = u.id === me?.id;
            const isFollowing = followingIds.has(u.id);
            const fullName = `${u.firstName} ${u.lastName}`.trim() || "—";
            const username = u.email?.split("@")[0] ?? "utilisateur";

            return (
              <Pressable
                key={u.id}
                style={styles.row}
                onPress={() => onOpenProfile?.(u.id)}
              >
                {/* Avatar */}
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitials}>
                      {(u.firstName || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Infos */}
                <View style={styles.info}>
                  <Text style={styles.name}>{fullName}</Text>
                  <Text style={styles.username}>@{username}</Text>
                </View>

                {/* Bouton follow — masqué si c'est moi */}
                {!isMe && (
                  <Pressable
                    style={[
                      styles.followBtn,
                      isFollowing && styles.followBtnActive,
                    ]}
                    onPress={() => void toggleFollow(u.id)}
                    disabled={loadingId === u.id}
                  >
                    {loadingId === u.id ? (
                      <ActivityIndicator
                        size="small"
                        color={isFollowing ? colors.burgundy : colors.white}
                      />
                    ) : isFollowing ? (
                      <>
                        <UserCheck size={14} color={colors.burgundy} />
                        <Text style={[styles.followBtnText, { color: colors.burgundy }]}>
                          Abonné
                        </Text>
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} color={colors.white} />
                        <Text style={styles.followBtnText}>Suivre</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 13 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },
  loadingBox: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: colors.muted, fontSize: 14 },
  emptyBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 20,
    gap: 6,
    alignItems: "center",
  },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 15 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  list: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.beige,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.burgundy,
  },
  avatarInitials: { color: colors.white, fontWeight: "900", fontSize: 18 },
  info: { flex: 1, gap: 2 },
  name: { color: colors.text, fontWeight: "900", fontSize: 14 },
  username: { color: colors.muted, fontSize: 12 },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 80,
    justifyContent: "center",
  },
  followBtnActive: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.burgundy,
  },
  followBtnText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
});