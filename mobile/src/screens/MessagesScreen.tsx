import Constants from "expo-constants";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";
import { IncomingCallScreen } from "./IncomingCallScreen";
import { NewChatScreen } from "./NewChatScreen";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts } from "../theme/dressme";
import type { CallMode } from "../types/calls";
import type { Conversation, User } from "../types/contracts";

type ActiveCall = {
  id?: string;
  mode: CallMode;
  direction: "outgoing" | "incoming";
  peer?: User;
  peerName: string;
};

const IS_EXPO_GO = Constants.appOwnership === "expo";
const LazyCallScreen = React.lazy(() =>
  import("./CallScreen").then((module) => ({
    default: module.CallScreen,
  })),
);

export function MessagesScreen() {
  const { token } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);

  const pollIncomingCalls = useCallback(async () => {
    if (!token || activeCall || incomingCall) {
      return;
    }

    const calls = await client.getIncomingCalls(token);
    const firstCall = calls[0];
    if (firstCall) {
      setIncomingCall({
        id: firstCall.id,
        mode: firstCall.kind,
        direction: "incoming",
        peer: firstCall.peer,
        peerName: `${firstCall.peer.firstName} ${firstCall.peer.lastName}`.trim() || firstCall.peer.email,
      });
    }
  }, [activeCall, incomingCall, token]);

  useEffect(() => {
    void pollIncomingCalls();
    const interval = setInterval(() => void pollIncomingCalls(), 2500);
    return () => clearInterval(interval);
  }, [pollIncomingCalls]);

  const startOutgoingCall = (mode: CallMode, peer?: User, peerName?: string) => {
    setActiveCall({
      mode,
      direction: "outgoing",
      peer,
      peerName: peerName ?? conversation?.title ?? "Contact",
    });
  };

  const renderCallModal = () => (
    <Modal visible={Boolean(activeCall)} animationType="fade">
      {activeCall ? (
        <CallModalContent
          activeCall={activeCall}
          token={token}
          onCallStarted={(callId) =>
            setActiveCall((current) => current ? { ...current, id: callId } : current)
          }
          onEndCall={() => setActiveCall(null)}
        />
      ) : null}
    </Modal>
  );

  const renderIncomingCallModal = () => (
    <Modal visible={Boolean(incomingCall)} animationType="fade">
      {incomingCall ? (
        <IncomingCallScreen
          mode={incomingCall.mode}
          peer={incomingCall.peer}
          peerName={incomingCall.peerName}
          onAccept={async () => {
            setActiveCall(incomingCall);
            setIncomingCall(null);
          }}
          onReject={async () => {
            if (incomingCall.id && token) {
              await client.rejectCall(incomingCall.id, token);
            }
            setIncomingCall(null);
          }}
        />
      ) : null}
    </Modal>
  );

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
          onStartCall={(mode, peer, peerName) => void startOutgoingCall(mode, peer, peerName)}
        />
        {renderCallModal()}
        {renderIncomingCallModal()}
      </>
    );
  }

  return (
    <>
      <ChatListScreen
        onOpenConversation={setConversation}
        onCreateConversation={() => setCreatingChat(true)}
      />
      {renderIncomingCallModal()}
      {renderCallModal()}
    </>
  );
}

function CallModalContent({
  activeCall,
  token,
  onCallStarted,
  onEndCall,
}: {
  activeCall: ActiveCall;
  token?: string | null;
  onCallStarted: (callId: string) => void;
  onEndCall: () => void;
}) {
  if (IS_EXPO_GO) {
    return <CallUnavailableScreen onClose={onEndCall} />;
  }

  return (
    <Suspense fallback={<CallLoadingState />}>
      <LazyCallScreen
        mode={activeCall.mode}
        direction={activeCall.direction}
        token={token}
        callId={activeCall.id}
        peer={activeCall.peer}
        peerName={activeCall.peerName}
        onCallStarted={onCallStarted}
        onEndCall={onEndCall}
      />
    </Suspense>
  );
}

function CallLoadingState() {
  return (
    <View style={styles.callFallback}>
      <ActivityIndicator color={colors.burgundy} />
      <Text style={styles.callFallbackText}>Chargement de l'appel...</Text>
    </View>
  );
}

function CallUnavailableScreen({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.callFallback}>
      <Text style={styles.callFallbackTitle}>Appels indisponibles dans Expo Go</Text>
      <Text style={styles.callFallbackText}>
        Les appels utilisent WebRTC natif. Utilise le dev build sur telephone reel pour tester
        l'audio/video.
      </Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.callFallbackButton}>
        <Text style={styles.callFallbackButtonText}>Retour aux messages</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  callFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
    backgroundColor: colors.cream,
  },
  callFallbackTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  callFallbackText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
  },
  callFallbackButton: {
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.burgundy,
  },
  callFallbackButtonText: {
    color: colors.white,
    fontWeight: "900",
  },
});
