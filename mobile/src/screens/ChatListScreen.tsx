import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MessageCircle, Plus, UserRound } from "lucide-react-native";

import { client } from "../services";
import { ApiError } from "../services/api/apiClient";
import { useAuth } from "../context/AuthContext";
import type { Conversation, User } from "../types/contracts";
import { colors, fonts, radius, shadow } from "../theme/dressme";

type Props = {
  onOpenConversation: (conversation: Conversation) => void;
  onCreateConversation: () => void;
};

export function ChatListScreen({ onOpenConversation, onCreateConversation }: Props) {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await client.getConversations(token ?? undefined);
      setConversations(data);
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : requestError instanceof Error
            ? requestError.message
            : "Impossible de charger les discussions.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.burgundy} />
        <Text style={styles.stateText}>Chargement des discussions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          <View style={styles.headerIcon}>
            <MessageCircle size={20} color={colors.burgundy} />
          </View>
          <Pressable style={styles.headerIcon} onPress={onCreateConversation}>
            <Plus size={20} color={colors.burgundy} />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Pressable style={styles.errorBox} onPress={() => void loadConversations()}>
          <Text style={styles.errorTitle}>Connexion impossible</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText}>Toucher pour reessayer</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            currentUserId={user?.id}
            onPress={() => onOpenConversation(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucune discussion</Text>
            <Text style={styles.stateText}>Vos prochaines conversations apparaitront ici.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.burgundy}
            onRefresh={() => void loadConversations(true)}
          />
        }
        scrollEnabled={false}
      />
    </View>
  );
}

function ConversationRow({
  conversation,
  currentUserId,
  onPress,
}: {
  conversation: Conversation;
  currentUserId?: string;
  onPress: () => void;
}) {
  const peer = getConversationPeer(conversation, currentUserId);
  const lastMessage = conversation.lastMessage?.body ?? "Aucun message pour le moment";
  const time = conversation.lastMessage ? formatConversationTime(conversation.lastMessage.createdAt) : "";

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {peer?.avatarUrl ? (
        <Image source={{ uri: peer.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <UserRound size={24} color={colors.burgundy} />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.contactName}>
            {conversation.title || getUserName(peer)}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text numberOfLines={1} style={styles.lastMessage}>
            {lastMessage}
          </Text>
          {conversation.unreadCount > 0 ? (
            <Text style={styles.badge}>{conversation.unreadCount}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function getConversationPeer(conversation: Conversation, currentUserId?: string): User | undefined {
  return (
    conversation.participants.find((participant) => participant.id !== currentUserId) ??
    conversation.participants[0]
  );
}

function getUserName(user?: User): string {
  if (!user) {
    return "Contact";
  }
  return `${user.firstName} ${user.lastName}`.trim() || user.email || "Contact";
}

function formatConversationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  row: {
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
  content: {
    flex: 1,
    gap: 5,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  time: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: colors.burgundy,
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
    paddingTop: 3,
    paddingHorizontal: 6,
    textAlign: "center",
  },
  separator: {
    height: 10,
  },
  centerState: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  stateText: {
    color: colors.muted,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: "#FFF5F5",
    borderColor: "#F0C4C4",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  errorTitle: {
    color: colors.danger,
    fontWeight: "900",
  },
  errorText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  retryText: {
    color: colors.burgundy,
    fontSize: 12,
    fontWeight: "900",
  },
});
