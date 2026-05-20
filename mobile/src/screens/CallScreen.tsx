import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  type MediaStream,
} from "react-native-webrtc";
import { Mic, Phone, Speaker, UserRound, Video, VideoOff } from "lucide-react-native";

import { client } from "../services";
import type { CallSession, User } from "../types/contracts";
import type { CallDirection, CallMode, CallStatus } from "../types/calls";
import { colors, fonts } from "../theme/dressme";

type Props = {
  mode: CallMode;
  direction: CallDirection;
  token?: string | null;
  callId?: string;
  peer?: User;
  peerName: string;
  onEndCall: () => void;
  onCallStarted?: (callId: string) => void;
};

type WebRtcDescription = {
  type: "offer" | "answer";
  sdp: string;
};

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function toPlainDescription(description: unknown): WebRtcDescription {
  const raw =
    description &&
    typeof description === "object" &&
    "toJSON" in description &&
    typeof (description as { toJSON?: unknown }).toJSON === "function"
      ? (description as { toJSON: () => unknown }).toJSON()
      : description;
  const candidate = raw as { type?: unknown; sdp?: unknown; _type?: unknown; _sdp?: unknown };
  const type = candidate.type ?? candidate._type;
  const sdp = candidate.sdp ?? candidate._sdp;

  if ((type !== "offer" && type !== "answer") || typeof sdp !== "string" || !sdp.trim()) {
    throw new Error("Signal WebRTC invalide.");
  }

  return { type, sdp };
}

function toPlainCandidate(candidate: unknown): RTCIceCandidateInit | null {
  const raw =
    candidate &&
    typeof candidate === "object" &&
    "toJSON" in candidate &&
    typeof (candidate as { toJSON?: unknown }).toJSON === "function"
      ? (candidate as { toJSON: () => unknown }).toJSON()
      : candidate;
  const value = raw as {
    candidate?: unknown;
    sdpMid?: unknown;
    sdpMLineIndex?: unknown;
    usernameFragment?: unknown;
  };

  if (typeof value.candidate !== "string" || !value.candidate.trim()) {
    return null;
  }

  return {
    candidate: value.candidate,
    sdpMid: typeof value.sdpMid === "string" ? value.sdpMid : undefined,
    sdpMLineIndex: typeof value.sdpMLineIndex === "number" ? value.sdpMLineIndex : undefined,
    usernameFragment: typeof value.usernameFragment === "string" ? value.usernameFragment : undefined,
  };
}

export function CallScreen({
  mode,
  direction,
  token,
  callId,
  peer,
  peerName,
  onEndCall,
  onCallStarted,
}: Props) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | undefined>(callId);
  const seenCandidatesRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CallStatus>("connecting");
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(mode === "video");
  const [cameraOff, setCameraOff] = useState(mode === "audio");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendCandidate = useCallback(async (candidate: unknown) => {
    const cleanCandidate = toPlainCandidate(candidate);
    if (!cleanCandidate) {
      return;
    }

    if (!token || !callIdRef.current) {
      pendingCandidatesRef.current.push(cleanCandidate);
      return;
    }

    await client.addIceCandidate(callIdRef.current, cleanCandidate, token);
  }, [token]);

  const flushPendingCandidates = useCallback(async () => {
    if (!token || !callIdRef.current || pendingCandidatesRef.current.length === 0) {
      return;
    }

    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    await Promise.all(candidates.map((candidate) => client.addIceCandidate(callIdRef.current!, candidate, token)));
  }, [token]);

  const addRemoteCandidates = useCallback(async (session: CallSession) => {
    const remoteCandidates = direction === "outgoing"
      ? session.receiverCandidates
      : session.callerCandidates;

    for (const candidate of remoteCandidates) {
      const cleanCandidate = toPlainCandidate(candidate);
      if (!cleanCandidate) {
        continue;
      }

      const key = JSON.stringify(cleanCandidate);
      if (seenCandidatesRef.current.has(key)) {
        continue;
      }
      seenCandidatesRef.current.add(key);
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(cleanCandidate)).catch(() => undefined);
    }
  }, [direction]);

  const pollCall = useCallback(async () => {
    if (!token || !callIdRef.current || !pcRef.current) {
      return;
    }

    const session = await client.getCall(callIdRef.current, token);
    if (session.state === "ended") {
      onEndCall();
      return;
    }

    if (direction === "outgoing" && session.answer && !remoteDescriptionSetRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(toPlainDescription(session.answer)));
      remoteDescriptionSetRef.current = true;
      setStatus("ongoing");
    }

    if (remoteDescriptionSetRef.current) {
      await addRemoteCandidates(session);
    }
  }, [addRemoteCandidates, direction, onEndCall, token]);

  const startWebRtc = useCallback(async () => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;
      if (!mountedRef.current) {
        pc.close();
        return;
      }

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const handleTrack = (event: any) => {
        const [streamFromPeer] = event.streams;
        if (streamFromPeer) {
          remoteStreamRef.current = streamFromPeer;
          setRemoteStream(streamFromPeer);
          setStatus("ongoing");
        }
      };

      const handleIceCandidate = (event: any) => {
        if (event.candidate) {
          void sendCandidate(event.candidate.toJSON()).catch(() => undefined);
        }
      };

      const nativePeerConnection = pc as any;
      if (typeof nativePeerConnection.addEventListener === "function") {
        nativePeerConnection.addEventListener("track", handleTrack);
        nativePeerConnection.addEventListener("icecandidate", handleIceCandidate);
      } else {
        nativePeerConnection.ontrack = handleTrack;
        nativePeerConnection.onicecandidate = handleIceCandidate;
      }

      if (direction === "outgoing") {
        if (!peer?.id || !token) {
          throw new Error("Impossible de demarrer l'appel sans contact connecte.");
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const session = await client.startCall(peer.id, mode, token, toPlainDescription(offer));
        callIdRef.current = session.id;
        onCallStarted?.(session.id);
        await flushPendingCandidates();
      } else {
        if (!callId || !token) {
          throw new Error("Appel entrant invalide.");
        }

        callIdRef.current = callId;
        const session = await client.getCall(callId, token);
        if (!session.offer) {
          throw new Error("Signal d'appel manquant.");
        }

        await pc.setRemoteDescription(new RTCSessionDescription(toPlainDescription(session.offer)));
        remoteDescriptionSetRef.current = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await client.answerCall(callId, token, toPlainDescription(answer));
        await flushPendingCandidates();
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Impossible d'etablir l'appel.";
      setError(message);
    }
  }, [callId, direction, flushPendingCandidates, mode, onCallStarted, peer?.id, sendCandidate, token]);

  useEffect(() => {
    void startWebRtc();
  }, [startWebRtc]);

  useEffect(() => {
    const interval = setInterval(() => void pollCall().catch(() => undefined), 1200);
    return () => clearInterval(interval);
  }, [pollCall]);

  useEffect(() => {
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, [localStream, muted]);

  useEffect(() => {
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
  }, [cameraOff, localStream]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close();
    };
  }, []);

  const endCall = async () => {
    if (token && callIdRef.current) {
      await client.endCall(callIdRef.current, token).catch(() => undefined);
    }
    onEndCall();
  };

  const localUrl = localStream?.toURL();
  const remoteUrl = remoteStream?.toURL();

  return (
    <View style={styles.screen}>
      {mode === "video" && remoteUrl ? (
        <RTCView streamURL={remoteUrl} style={styles.remoteVideo} objectFit="cover" mirror={false} />
      ) : mode === "video" ? (
        <View style={styles.waitingVideo}>
          <UserRound size={52} color={colors.gold} />
          <Text style={styles.waitingText}>En attente de la video distante...</Text>
        </View>
      ) : (
        <View style={styles.avatarStage}>
          <View style={styles.avatarFallback}>
            <UserRound size={52} color={colors.gold} />
          </View>
        </View>
      )}

      <View style={styles.topInfo}>
        <Text style={styles.peerName}>{peerName}</Text>
        <Text style={styles.status}>{error ?? (status === "connecting" ? "Connecting peer-to-peer..." : "Ongoing call")}</Text>
      </View>

      {mode === "video" ? (
        <View style={styles.localPreview}>
          {localUrl && !cameraOff ? (
            <RTCView streamURL={localUrl} style={styles.localVideo} objectFit="cover" mirror />
          ) : (
            <Text style={styles.localPreviewText}>Camera off</Text>
          )}
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          style={[styles.controlButton, muted && styles.controlButtonActive]}
          onPress={() => setMuted((value) => !value)}
        >
          <Mic size={24} color={colors.white} />
          <Text style={styles.controlLabel}>{muted ? "Muted" : "Mute"}</Text>
        </Pressable>

        <Pressable style={[styles.controlButton, styles.hangup]} onPress={() => void endCall()}>
          <Phone size={26} color={colors.white} />
          <Text style={styles.controlLabel}>End</Text>
        </Pressable>

        <Pressable
          style={[styles.controlButton, speakerOn && styles.controlButtonActive]}
          onPress={() => setSpeakerOn((value) => !value)}
        >
          <Speaker size={24} color={colors.white} />
          <Text style={styles.controlLabel}>Speaker</Text>
        </Pressable>

        {mode === "video" ? (
          <Pressable
            style={[styles.controlButton, cameraOff && styles.controlButtonActive]}
            onPress={() => setCameraOff((value) => !value)}
          >
            {cameraOff ? <VideoOff size={24} color={colors.white} /> : <Video size={24} color={colors.white} />}
            <Text style={styles.controlLabel}>Camera</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.burgundyDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarStage: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallback: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#151015",
  },
  waitingVideo: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 34,
  },
  waitingText: {
    color: "#eadfd5",
    textAlign: "center",
    fontWeight: "800",
  },
  topInfo: {
    position: "absolute",
    top: 72,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 22,
  },
  peerName: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 31,
    fontWeight: "700",
    textAlign: "center",
  },
  status: {
    color: "#eadfd5",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  localPreview: {
    position: "absolute",
    top: 84,
    right: 18,
    width: 104,
    height: 138,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  localPreviewText: {
    color: colors.white,
    fontWeight: "900",
    textAlign: "center",
  },
  controls: {
    position: "absolute",
    bottom: 48,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  controlButtonActive: {
    backgroundColor: "rgba(201,169,97,0.42)",
  },
  hangup: {
    backgroundColor: colors.danger,
    transform: [{ rotate: "135deg" }],
  },
  controlLabel: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
  },
});
