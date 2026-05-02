import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Mic, Phone, Speaker, UserRound, Video, VideoOff } from "lucide-react-native";

import type { User } from "../types/contracts";
import { colors, fonts } from "../theme/dressme";

export type CallMode = "audio" | "video";
export type CallStatus = "connecting" | "ongoing";

type Props = {
  mode: CallMode;
  peer?: User;
  peerName: string;
  onEndCall: () => void;
};

export function CallScreen({ mode, peer, peerName, onEndCall }: Props) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(mode === "video");
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStatus("ongoing"), 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mode === "video" && !cameraPermission?.granted) {
      void requestCameraPermission();
    }
  }, [cameraPermission?.granted, mode, requestCameraPermission]);

  const cameraReady = mode === "video" && !cameraOff && cameraPermission?.granted;

  return (
    <View style={styles.screen}>
      {cameraReady ? (
        <CameraView style={styles.cameraPreview} facing="front" mode="video">
          <View style={styles.cameraScrim} />
          <Text style={styles.cameraLabel}>Votre camera</Text>
        </CameraView>
      ) : mode === "video" && !cameraOff ? (
        <View style={styles.cameraPermissionState}>
          <VideoOff size={48} color={colors.gold} />
          <Text style={styles.permissionTitle}>Camera indisponible</Text>
          <Text style={styles.permissionText}>Autorisez la camera pour l'appel video.</Text>
          <Pressable style={styles.permissionButton} onPress={() => void requestCameraPermission()}>
            <Text style={styles.permissionButtonText}>Autoriser</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.avatarStage}>
          {peer?.avatarUrl ? (
            <Image source={{ uri: peer.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <UserRound size={52} color={colors.gold} />
            </View>
          )}
        </View>
      )}

      <View style={styles.topInfo}>
        <Text style={styles.peerName}>{peerName}</Text>
        <Text style={styles.status}>{status === "connecting" ? "Connecting peer-to-peer..." : "Ongoing call"}</Text>
      </View>

      {mode === "video" ? (
        <View style={styles.localPreview}>
          {cameraOff ? (
            <Text style={styles.localPreviewText}>Camera off</Text>
          ) : peer?.avatarUrl ? (
            <Image source={{ uri: peer.avatarUrl }} style={styles.peerPreviewImage} />
          ) : (
            <Text style={styles.localPreviewText}>{peerName}</Text>
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

        <Pressable style={[styles.controlButton, styles.hangup]} onPress={onEndCall}>
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
  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "rgba(255,255,255,0.12)",
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
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#151015",
  },
  cameraScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cameraLabel: {
    position: "absolute",
    bottom: 170,
    alignSelf: "center",
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
  },
  cameraPermissionState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 34,
  },
  permissionTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "900",
  },
  permissionText: {
    color: "#eadfd5",
    textAlign: "center",
    lineHeight: 19,
  },
  permissionButton: {
    marginTop: 6,
    backgroundColor: colors.gold,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: colors.burgundyDark,
    fontWeight: "900",
  },
  topInfo: {
    position: "absolute",
    top: 72,
    alignItems: "center",
    gap: 6,
  },
  peerName: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 31,
    fontWeight: "700",
  },
  status: {
    color: "#eadfd5",
    fontSize: 13,
    fontWeight: "700",
  },
  localPreview: {
    position: "absolute",
    top: 84,
    right: 18,
    width: 100,
    height: 132,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  localPreviewText: {
    color: colors.white,
    fontWeight: "900",
    textAlign: "center",
  },
  peerPreviewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
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
