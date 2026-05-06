import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from "react-native-webrtc";
import { Mic, MicOff, PhoneOff, Radio, Users } from "lucide-react-native";

import { useAuth } from "../../context/AuthContext";
import { client } from "../../services";
import { buildLiveWebSocketUrl } from "../../services/live/liveClient";
import { colors, fonts } from "../../theme/dressme";
import type { LiveSession, User } from "../../types/contracts";

type SignalMessage = {
  type: string;
  live_id?: string;
  viewer_id?: string;
  from_id?: string;
  payload?: Record<string, unknown>;
  viewer?: User;
};

type Props = {
  onClose: () => void;
};

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function LiveHostScreen({ onClose }: Props) {
  const { token } = useAuth();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [statusText, setStatusText] = useState("Preparation du live...");
  const [viewerCount, setViewerCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; username: string; text: string }>>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  useEffect(() => {
    let mounted = true;

    const startLive = async () => {
      if (!token) {
        setStatusText("Session utilisateur requise.");
        return;
      }

      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: 720,
            height: 1280,
            frameRate: 30,
          },
        });
        if (!mounted) {
          stopStream(stream);
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        const createdSession = await client.createLiveSession({
          token,
          title: "Live DressMe",
        });
        if (!mounted) {
          return;
        }

        sessionRef.current = createdSession;
        setSession(createdSession);
        connectSocket(createdSession.id, token, stream);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Impossible de demarrer le live.";
        setStatusText(message);
        Alert.alert("Live indisponible", message);
      }
    };

    void startLive();

    return () => {
      mounted = false;
      void cleanupLive();
    };
  }, [token]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      setSeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const connectSocket = (liveId: string, accessToken: string, stream: MediaStream) => {
    const socket = new WebSocket(buildLiveWebSocketUrl(liveId, accessToken, "host"));
    socketRef.current = socket;

    socket.onopen = () => {
      setStatusText("Live en direct.");
    };

    socket.onmessage = (event) => {
      const message = parseSignal(event.data);
      if (!message) {
        return;
      }
      void handleSignalMessage(message, stream);
    };

    socket.onerror = () => {
      setStatusText("Connexion live instable.");
    };

    socket.onclose = () => {
      setStatusText("Live termine.");
    };
  };

  const handleSignalMessage = async (message: SignalMessage, stream: MediaStream) => {
    if (message.type === "viewer_joined" && message.viewer_id) {
      setViewerCount((count) => count + 1);
      await createOfferForViewer(message.viewer_id, stream);
      return;
    }

    if (message.type === "viewer_left" && message.viewer_id) {
      closePeer(message.viewer_id);
      setViewerCount((count) => Math.max(0, count - 1));
      return;
    }

    if (message.type === "answer" && message.from_id && message.payload) {
      const peer = peersRef.current[message.from_id];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(message.payload as any));
      }
      return;
    }

    if (message.type === "ice_candidate" && message.from_id && message.payload) {
      const peer = peersRef.current[message.from_id];
      if (peer) {
        await peer.addIceCandidate(new RTCIceCandidate(message.payload as any));
      }
      return;
    }

    if (message.type === "live_chat" && message.from_id) {
      const senderId = message.from_id;
      const text = String(message.payload?.text ?? "").trim();
      if (text) {
        setChatMessages((current) => [
          ...current.slice(-3),
          { id: `${senderId}-${Date.now()}`, username: senderId.slice(0, 6), text },
        ]);
      }
    }
  };

  const createOfferForViewer = async (viewerId: string, stream: MediaStream) => {
    closePeer(viewerId);

    const peer = new RTCPeerConnection(peerConfig);
    peersRef.current[viewerId] = peer;

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    (peer as any).addEventListener("icecandidate", (event: any) => {
      if (event.candidate) {
        sendSignal({
          type: "ice_candidate",
          target_id: viewerId,
          payload: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal({
      type: "offer",
      target_id: viewerId,
      payload: peer.localDescription?.toJSON ? peer.localDescription.toJSON() : offer,
    });
  };

  const sendSignal = (message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const closePeer = (viewerId: string) => {
    const peer = peersRef.current[viewerId];
    peer?.close();
    delete peersRef.current[viewerId];
  };

  const cleanupLive = async () => {
    const currentSession = sessionRef.current;
    if (currentSession && token) {
      try {
        await client.endLiveSession({ token, liveId: currentSession.id });
      } catch {
        // Best effort: the WebSocket disconnect also ends the live server-side.
      }
    }

    sendSignal({ type: "live_ended" });
    socketRef.current?.close();
    socketRef.current = null;
    Object.keys(peersRef.current).forEach(closePeer);
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    sessionRef.current = null;
  };

  const endLive = async () => {
    await cleanupLive();
    onClose();
  };

  const toggleMic = () => {
    const nextEnabled = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setMicEnabled(nextEnabled);
  };

  const localStreamUrl = localStream?.toURL();

  return (
    <View style={styles.shell}>
      {localStreamUrl ? (
        <RTCView
          pointerEvents="none"
          streamURL={localStreamUrl}
          style={styles.video}
          objectFit="cover"
          mirror
          zOrder={0}
        />
      ) : (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.white} />
          <Text style={styles.loadingText}>{statusText}</Text>
        </View>
      )}

      <View style={styles.topOverlay}>
        <View style={styles.liveBadge}>
          <Radio size={14} color={colors.white} />
          <Text style={styles.liveBadgeText}>EN DIRECT</Text>
        </View>
        <Text style={styles.timer}>{formatDuration(seconds)}</Text>
        <View style={styles.viewerPill}>
          <Users size={16} color={colors.white} />
          <Text style={styles.viewerText}>{viewerCount}</Text>
        </View>
      </View>

      <View style={styles.statusPanel}>
        <Text style={styles.statusText}>{statusText}</Text>
        {session ? <Text style={styles.sessionText}>Live ID: {session.id.slice(0, 8)}</Text> : null}
      </View>

      <View style={styles.chatStack}>
        {chatMessages.map((message) => (
          <Text key={message.id} style={styles.chatBubble}>
            <Text style={styles.chatUser}>@{message.username} </Text>
            {message.text}
          </Text>
        ))}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={toggleMic}
          style={[styles.roundButton, !micEnabled && styles.roundButtonOff]}
        >
          {micEnabled ? <Mic size={24} color={colors.white} /> : <MicOff size={24} color={colors.white} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          style={styles.endButton}
          onPress={() => void endLive()}
        >
          <PhoneOff size={28} color={colors.white} />
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

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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
    top: 52,
    left: 16,
    right: 16,
    zIndex: 10,
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  timer: {
    color: colors.white,
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  viewerPill: {
    marginLeft: "auto",
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
  statusPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 98,
    zIndex: 10,
    elevation: 10,
  },
  statusText: {
    color: colors.white,
    fontWeight: "800",
  },
  sessionText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    marginTop: 2,
  },
  chatStack: {
    position: "absolute",
    left: 16,
    right: 90,
    bottom: 118,
    zIndex: 10,
    elevation: 10,
    gap: 7,
  },
  chatBubble: {
    alignSelf: "flex-start",
    color: colors.white,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.46)",
  },
  chatUser: {
    fontWeight: "900",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 34,
    zIndex: 20,
    elevation: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  roundButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  roundButtonOff: {
    backgroundColor: "rgba(229,57,53,0.78)",
  },
  endButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935",
  },
});
