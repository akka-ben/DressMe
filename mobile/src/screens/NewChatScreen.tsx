import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search, UserRound, X } from "lucide-react-native";

import { client } from "../services";
import { useAuth } from "../context/AuthContext";
import type { Conversation, User } from "../types/contracts";
import { colors, fonts, radius, shadow } from "../theme/dressme";

type Props = {
  onBack: () => void;
  onConversationCreated: (conversation: Conversation) => void;
};

export function NewChatScreen({ onBack, onConversationCreated }: Props) {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await client.getChatUsers(token ?? undefined);
      setUsers(data);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Impossible de charger les utilisateurs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return users;
    }

    return users.filter((user) =>
      `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(value),
    );
  }, [query, users]);

  const startChat = async (userId: string) => {
    try {
      setCreatingUserId(userId);
      const conversation = await client.startConversation(userId, token ?? undefined);
      onConversationCreated(conversation);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Impossible de creer la conversation.";
      setError(message);
    } finally {
      setCreatingUserId(null);
    }
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text style={styles.title}>Nouveau chat</Text>
        <Pressable style={styles.closeButton} onPress={onBack}>
          <X size={20} color={colors.burgundy} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.burgundy} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un utilisateur..."
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      {error ? (
        <Pressable style={styles.errorBox} onPress={() => void loadUsers()}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText}>Toucher pour reessayer</Text>
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.burgundy} />
          <Text style={styles.stateText}>Chargement des utilisateurs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              loading={creatingUserId === item.id}
              onPress={() => void startChat(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>Aucun utilisateur</Text>
              <Text style={styles.stateText}>Essayez une autre recherche.</Text>
            </View>
          }
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

function UserRow({
  user,
  loading,
  onPress,
}: {
  user: User;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.userRow} onPress={onPress} disabled={loading}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <UserRound size={24} color={colors.burgundy} />
        </View>
      )}
      <View style={styles.userText}>
        <Text numberOfLines={1} style={styles.name}>
          {`${user.firstName} ${user.lastName}`.trim() || "Utilisateur"}
        </Text>
        <Text numberOfLines={1} style={styles.email}>{user.email}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.burgundy} />
      ) : (
        <Text style={styles.action}>Message</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
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
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.beige,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  userText: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  email: {
    color: colors.muted,
    fontSize: 12,
  },
  action: {
    color: colors.burgundy,
    fontSize: 12,
    fontWeight: "900",
  },
  separator: {
    height: 10,
  },
  centerState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  stateText: {
    color: colors.muted,
    fontSize: 13,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  errorBox: {
    backgroundColor: "#FFF5F5",
    borderColor: "#F0C4C4",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    gap: 3,
  },
  errorText: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: 13,
  },
  retryText: {
    color: colors.burgundy,
    fontSize: 12,
    fontWeight: "900",
  },
});
