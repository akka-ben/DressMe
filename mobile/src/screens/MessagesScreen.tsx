import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Mic, Phone, UserRound, Video, VideoOff, X } from "lucide-react-native";

import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";
import { NewChatScreen } from "./NewChatScreen";
import type { Conversation } from "../types/contracts";
import { colors, fonts, radius } from "../theme/dressme";

export function MessagesScreen() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [showCall, setShowCall] = useState<"audio" | "video" | null>(null);

  if (creatingChat) {
    return (
      <NewChatScreen
        onBack={() => setCreatingChat(false)}
        onConversationCreated={(createdConversation) => {
          setCreatingChat(false);
          setConversation(createdConversation);
        }}
      />
    );
  }

  if (conversation) {
    return (
      <>
      <ChatConversationScreen
        conversation={conversation}
        onBack={() => setConversation(null)}
        onStartCall={setShowCall}
      />
      <CallModal
        visible={Boolean(showCall)}
        callMode={showCall}
        onEndCall={() => setShowCall(null)}
        peerName={conversation.title}
      />
      </>
    );
  }

  return (
    <ChatListScreen
      onOpenConversation={setConversation}
      onCreateConversation={() => setCreatingChat(true)}
    />
  );
}

function CallModal({
  visible,
  callMode,
  peerName,
  onEndCall,
}: {
  visible: boolean;
  callMode: "audio" | "video" | null;
  peerName: string;
  onEndCall: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const mode = callMode ?? "audio";

  return (
    <Modal visible={visible} animationType="fade">
      <View style={styles.callScreen}>
        <Pressable onPress={onEndCall} style={styles.callClose}>
          <X size={24} color={colors.white} />
        </Pressable>
        <View style={styles.callAvatarFallback}>
          <UserRound size={44} color={colors.gold} />
        </View>
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
          <Pressable style={[styles.callButton, styles.hangup]} onPress={onEndCall}>
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
  callAvatarFallback: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
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
