import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from "react-native-webrtc";
import { ChevronLeft, Radio, Send, Users } from "lucide-react-native";

import { useAuth } from "../../context/AuthContext";
import { buildLiveWebSocketUrl } from "../../services/live/liveClient";
import { colors, fonts } from "../../theme/dressme";
import type { LiveSession } from "../../types/contracts";

type SignalMessage = {
  type: string;
  live_id?: string;
  from_id?: string;
  payload?: Record<string, unknown>;
};

type Props = {
  liveSession: LiveSession;
  onClose: () => void;
};

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function LiveViewerScreen({ liveSession, onClose }: Props) {
  const { token } = useAuth();
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [statusText, setStatusText] = useState("Connexion au live...");
  const [chatText, setChatText] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!token) {
      setStatusText("Session utilisateur requise.");
      return undefined;
    }

    const peer = new RTCPeerConnection(peerConfig);
    peerRef.current = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });

    (peer as any).addEventListener("track", (event: any) => {
      const stream = event.streams?.[0];
      if (stream) {
        setRemoteStream(stream);
        setStatusText("Live connecte.");
      }
    });

    (peer as any).addEventListener("icecandidate", (event: any) => {
      if (event.candidate) {
        sendSignal({
          type: "ice_candidate",
          payload: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    });

    const socket = new WebSocket(buildLiveWebSocketUrl(liveSession.id, token, "viewer"));
    socketRef.current = socket;

    socket.onopen = () => {
      setStatusText("En attente du flux video...");
    };

    socket.onmessage = (event) => {
      const message = parseSignal(event.data);
      if (message) {
        void handleSignalMessage(peer, message);
      }
    };

    socket.onerror = () => {
      setStatusText("Connexion live instable.");
    };

    socket.onclose = () => {
      setStatusText("Live termine.");
    };

    return () => {
      socket.close();
      peer.close();
      socketRef.current = null;
      peerRef.current = null;
      setRemoteStream(null);
    };
  }, [liveSession.id, token]);

  const handleSignalMessage = async (peer: RTCPeerConnection, message: SignalMessage) => {
    if (message.type === "offer" && message.payload) {
      await peer.setRemoteDescription(new RTCSessionDescription(message.payload as any));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal({
        type: "answer",
        payload: peer.localDescription?.toJSON ? peer.localDescription.toJSON() : answer,
      });
      return;
    }

    if (message.type === "ice_candidate" && message.payload) {
      await peer.addIceCandidate(new RTCIceCandidate(message.payload as any));
      return;
    }

    if (message.type === "live_ended") {
      setStatusText("Live termine.");
      onClose();
    }
  };

  const sendSignal = (message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const sendChat = () => {
    const text = chatText.trim();
    if (!text) {
      return;
    }
    sendSignal({
      type: "live_chat",
      payload: { text },
    });
    setChatText("");
  };

  const remoteStreamUrl = remoteStream?.toURL();

  return (
    <View style={styles.shell}>
      {remoteStreamUrl ? (
        <RTCView
          pointerEvents="none"
          streamURL={remoteStreamUrl}
          style={styles.video}
          objectFit="cover"
          zOrder={0}
        />
      ) : (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.white} />
          <Text style={styles.loadingText}>{statusText}</Text>
        </View>
      )}

      <View style={styles.topOverlay}>
        <Pressable accessibilityRole="button" hitSlop={12} style={styles.backButton} onPress={onClose}>
          <ChevronLeft size={28} color={colors.white} />
        </Pressable>
        <View>
          <Text style={styles.hostName}>{displayName(liveSession.host)}</Text>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        <View style={styles.liveBadge}>
          <Radio size={13} color={colors.white} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.viewerPill}>
        <Users size={16} color={colors.white} />
        <Text style={styles.viewerText}>{liveSession.viewerCount}+</Text>
      </View>

      <View style={styles.chatComposer}>
        <TextInput
          value={chatText}
          onChangeText={setChatText}
          placeholder="Commenter le live..."
          placeholderTextColor="rgba(255,255,255,0.62)"
          style={styles.chatInput}
        />
        <Pressable accessibilityRole="button" hitSlop={8} style={styles.sendButton} onPress={sendChat}>
          <Send size={19} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

function parseSignal(data: string): SignalMessage | null {
  try {
    return JSON.parse(data) as SignalMessage;
  } catch {
    return null;
  }
}

function displayName(user: LiveSession["host"]): string {
  return `${user.firstName} ${user.lastName}`.trim() || "DressMe Live";
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.black,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.white,
    fontWeight: "800",
  },
  topOverlay: {
    position: "absolute",
    top: 48,
    left: 14,
    right: 14,
    zIndex: 20,
    elevation: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  hostName: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "700",
  },
  statusText: {
    color: "rgba(255,255,255,0.76)",
    fontWeight: "700",
    fontSize: 12,
  },
  liveBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#E53935",
  },
  liveBadgeText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12,
  },
  viewerPill: {
    position: "absolute",
    top: 104,
    right: 16,
    zIndex: 20,
    elevation: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  viewerText: {
    color: colors.white,
    fontWeight: "900",
  },
  chatComposer: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 34,
    zIndex: 20,
    elevation: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    color: colors.white,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.burgundy,
  },
});
