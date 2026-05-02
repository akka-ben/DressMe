import React, { useEffect, useState } from "react";
import { Modal } from "react-native";

import { CallScreen, type CallMode } from "./CallScreen";
import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";
import { IncomingCallScreen } from "./IncomingCallScreen";
import { NewChatScreen } from "./NewChatScreen";
import type { Conversation, User } from "../types/contracts";

type ActiveCall = {
  mode: CallMode;
  peer?: User;
  peerName: string;
};

export function MessagesScreen() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);

  useEffect(() => {
    if (activeCall || incomingCall) {
      return;
    }

    const timer = setTimeout(() => {
      setIncomingCall({
        mode: "video",
        peer: {
          id: "amine",
          firstName: "Amine",
          lastName: "El Meskini",
          email: "amine@example.com",
        },
        peerName: "Amine",
      });
    }, 9000);

    return () => clearTimeout(timer);
  }, [activeCall, incomingCall]);

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
          onStartCall={(mode, peer, peerName) =>
            setActiveCall({
              mode,
              peer,
              peerName: peerName ?? conversation.title,
            })
          }
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
              onAccept={() => {
                setActiveCall(incomingCall);
                setIncomingCall(null);
              }}
              onReject={() => setIncomingCall(null)}
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
            onAccept={() => {
              setActiveCall(incomingCall);
              setIncomingCall(null);
            }}
            onReject={() => setIncomingCall(null)}
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
