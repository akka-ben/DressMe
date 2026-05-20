import React, { useEffect, useState } from "react";

import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";
import { NewChatScreen } from "./NewChatScreen";
import type { CallMode } from "../types/calls";
import type { Conversation, User } from "../types/contracts";

type Props = {
  onStartCall: (mode: CallMode, peer?: User, peerName?: string) => void;
  onConversationRead?: () => void;
  onConversationStateChange?: (isOpen: boolean) => void;
};

export function MessagesScreen({ onStartCall, onConversationRead, onConversationStateChange }: Props) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);

  useEffect(() => {
    onConversationStateChange?.(Boolean(conversation));
    return () => onConversationStateChange?.(false);
  }, [conversation, onConversationStateChange]);

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
      <ChatConversationScreen
        conversation={conversation}
        onBack={() => {
          onConversationRead?.();
          setConversation(null);
        }}
        onLoaded={onConversationRead}
        onStartCall={onStartCall}
      />
    );
  }

  return (
    <>
      <ChatListScreen
        onOpenConversation={(selectedConversation) => {
          setConversation(selectedConversation);
          onConversationRead?.();
        }}
        onCreateConversation={() => setCreatingChat(true)}
      />
    </>
  );
}
