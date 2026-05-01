import React, { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Mic, Phone, Send, UserRound, Video, VideoOff, X } from "lucide-react-native";

import { conversations, FashionConversation, getUser } from "../data/fashionData";
import { colors, fonts, radius, shadow } from "../theme/dressme";

export function MessagesScreen() {
  const [conversation, setConversation] = useState<FashionConversation | null>(null);
  const [showCall, setShowCall] = useState<"audio" | "video" | null>(null);

  if (conversation) {
    return (
      <ConversationView
        conversation={conversation}
        onBack={() => setConversation(null)}
        onStartCall={setShowCall}
        callMode={showCall}
        onEndCall={() => setShowCall(null)}
      />
    );
  }

  return (
    <View style={styles.shell}>
      <Text style={styles.title}>Messages</Text>
      {conversations.map((item) => {
        const peer = getUser(item.participants.find((id) => id !== "me") ?? "me");
        const last = item.messages[item.messages.length - 1];
        return (
          <Pressable key={item.id} style={styles.conversationCard} onPress={() => setConversation(item)}>
            {item.isGroup ? (
              <View style={styles.groupAvatar}>
                <UserRound size={23} color={colors.burgundy} />
              </View>
            ) : (
              <Image source={{ uri: peer.avatar }} style={styles.avatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.conversationTitle}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.lastMessage}>{last?.text}</Text>
            </View>
            <View style={styles.rightMeta}>
              <Text style={styles.time}>{last?.timestamp}</Text>
              {item.unread ? <Text style={styles.unread}>{item.unread}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function ConversationView({
  conversation,
  onBack,
  onStartCall,
  callMode,
  onEndCall,
}: {
  conversation: FashionConversation;
  onBack: () => void;
  onStartCall: (mode: "audio" | "video") => void;
  callMode: "audio" | "video" | null;
  onEndCall: () => void;
}) {
  const peer = getUser(conversation.participants.find((id) => id !== "me") ?? "me");
  return (
    <View style={styles.shell}>
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Image source={{ uri: peer.avatar }} style={styles.chatAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.chatName}>{conversation.title}</Text>
          <Text style={styles.online}>En ligne</Text>
        </View>
        <Pressable onPress={() => onStartCall("audio")} style={styles.callIcon}>
          <Phone size={19} color={colors.burgundy} />
        </Pressable>
        <Pressable onPress={() => onStartCall("video")} style={styles.callIcon}>
          <Video size={19} color={colors.burgundy} />
        </Pressable>
      </View>
      <View style={styles.messages}>
        {conversation.messages.map((message) => {
          const mine = message.senderId === "me";
          return (
            <View key={message.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
              <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{message.timestamp}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.messageInputRow}>
        <TextInput placeholder="Message..." placeholderTextColor={colors.muted} style={styles.messageInput} />
        <Pressable style={styles.sendButton}>
          <Send size={19} color={colors.white} />
        </Pressable>
      </View>
      <CallModal visible={Boolean(callMode)} mode={callMode ?? "audio"} peerName={conversation.title} avatar={peer.avatar} onClose={onEndCall} />
    </View>
  );
}

function CallModal({
  visible,
  mode,
  peerName,
  avatar,
  onClose,
}: {
  visible: boolean;
  mode: "audio" | "video";
  peerName: string;
  avatar: string;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  return (
    <Modal visible={visible} animationType="fade">
      <View style={styles.callScreen}>
        <Pressable onPress={onClose} style={styles.callClose}>
          <X size={24} color={colors.white} />
        </Pressable>
        <Image source={{ uri: avatar }} style={styles.callAvatar} />
        <Text style={styles.callName}>{peerName}</Text>
        <Text style={styles.callState}>{mode === "video" ? "En appel video..." : "En appel vocal..."}</Text>
        {mode === "video" ? (
          <View style={styles.localVideo}>
            <Text style={styles.localVideoText}>Vous</Text>
          </View>
        ) : null}
        <View style={styles.callControls}>
          <Pressable style={[styles.callButton, muted && styles.callButtonOff]} onPress={() => setMuted((value) => !value)}>
            <Mic size={23} color={colors.white} />
          </Pressable>
          <Pressable style={[styles.callButton, styles.hangup]} onPress={onClose}>
            <Phone size={24} color={colors.white} />
          </Pressable>
          <Pressable style={[styles.callButton, cameraOff && styles.callButtonOff]} onPress={() => setCameraOff((value) => !value)}>
            {cameraOff ? <VideoOff size={23} color={colors.white} /> : <Video size={23} color={colors.white} />}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
  },
  conversationCard: {
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.beige,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
  },
  lastMessage: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  rightMeta: {
    alignItems: "flex-end",
    gap: 6,
  },
  time: {
    color: colors.muted,
    fontSize: 11,
  },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.burgundy,
    color: colors.white,
    textAlign: "center",
    overflow: "hidden",
    paddingTop: 3,
    fontWeight: "800",
    fontSize: 12,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  back: {
    fontSize: 32,
    color: colors.burgundy,
    lineHeight: 34,
  },
  chatAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  chatName: {
    color: colors.text,
    fontWeight: "800",
  },
  online: {
    color: colors.burgundy,
    fontSize: 12,
  },
  callIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  messages: {
    minHeight: 420,
    gap: 9,
    paddingVertical: 8,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.burgundy,
    borderBottomRightRadius: 5,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    color: colors.text,
    lineHeight: 19,
  },
  bubbleTextMine: {
    color: colors.white,
  },
  bubbleTime: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 5,
  },
  bubbleTimeMine: {
    color: "#f1dce2",
  },
  messageInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  messageInput: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.burgundy,
    alignItems: "center",
    justifyContent: "center",
  },
  callScreen: {
    flex: 1,
    backgroundColor: colors.burgundyDark,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  callClose: {
    position: "absolute",
    top: 54,
    left: 22,
  },
  callAvatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    borderColor: colors.gold,
  },
  callName: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "700",
  },
  callState: {
    color: "#eadfd5",
  },
  localVideo: {
    position: "absolute",
    top: 82,
    right: 18,
    width: 96,
    height: 128,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  localVideoText: {
    color: colors.white,
    fontWeight: "800",
  },
  callControls: {
    position: "absolute",
    bottom: 56,
    flexDirection: "row",
    gap: 18,
  },
  callButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  callButtonOff: {
    backgroundColor: colors.danger,
  },
  hangup: {
    backgroundColor: colors.danger,
    transform: [{ rotate: "135deg" }],
  },
});
