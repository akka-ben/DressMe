import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "react-native";

import { CallScreen, type CallMode } from "./CallScreen";
import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";
import { IncomingCallScreen } from "./IncomingCallScreen";
import { NewChatScreen } from "./NewChatScreen";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import type { Conversation, User } from "../types/contracts";

type ActiveCall = {
  id?: string;
  mode: CallMode;
  peer?: User;
  peerName: string;
};

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

  const startOutgoingCall = async (mode: CallMode, peer?: User, peerName?: string) => {
    if (!peer || !token) {
      setActiveCall({ mode, peer, peerName: peerName ?? conversation?.title ?? "Contact" });
      return;
    }

    const session = await client.startCall(peer.id, mode, token);
    setActiveCall({
      id: session.id,
      mode: session.kind,
      peer: session.peer,
      peerName: `${session.peer.firstName} ${session.peer.lastName}`.trim() || session.peer.email,
    });
  };

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
        <Modal visible={Boolean(activeCall)} animationType="fade">
          {activeCall ? (
            <CallScreen
              mode={activeCall.mode}
              peer={activeCall.peer}
              peerName={activeCall.peerName}
              onEndCall={() => setActiveCall(null)}
            />
          ) : null}
        </Modal>
        <Modal visible={Boolean(incomingCall)} animationType="fade">
          {incomingCall ? (
            <IncomingCallScreen
              mode={incomingCall.mode}
              peer={incomingCall.peer}
              peerName={incomingCall.peerName}
              onAccept={async () => {
                if (incomingCall.id && token) {
                  const session = await client.answerCall(incomingCall.id, token);
                  setActiveCall({
                    id: session.id,
                    mode: session.kind,
                    peer: session.peer,
                    peerName: `${session.peer.firstName} ${session.peer.lastName}`.trim() || session.peer.email,
                  });
                } else {
                  setActiveCall(incomingCall);
                }
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
      </>
    );
  }

  return (
    <>
      <ChatListScreen
        onOpenConversation={setConversation}
        onCreateConversation={() => setCreatingChat(true)}
      />
      <Modal visible={Boolean(incomingCall)} animationType="fade">
        {incomingCall ? (
          <IncomingCallScreen
            mode={incomingCall.mode}
            peer={incomingCall.peer}
            peerName={incomingCall.peerName}
            onAccept={async () => {
              if (incomingCall.id && token) {
                const session = await client.answerCall(incomingCall.id, token);
                setActiveCall({
                  id: session.id,
                  mode: session.kind,
                  peer: session.peer,
                  peerName: `${session.peer.firstName} ${session.peer.lastName}`.trim() || session.peer.email,
                });
              } else {
                setActiveCall(incomingCall);
              }
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
      <Modal visible={Boolean(activeCall)} animationType="fade">
        {activeCall ? (
          <CallScreen
            mode={activeCall.mode}
            peer={activeCall.peer}
            peerName={activeCall.peerName}
            onEndCall={() => setActiveCall(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
