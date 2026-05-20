import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { Phone, PhoneOff, UserRound, Video } from "lucide-react-native";

import type { User } from "../types/contracts";
import type { CallMode } from "../types/calls";
import { colors, fonts } from "../theme/dressme";

type Props = {
  mode: CallMode;
  peer?: User;
  peerName: string;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallScreen({ mode, peer, peerName, onAccept, onReject }: Props) {
  useEffect(() => {
    Vibration.vibrate([0, 900, 500], true);
    return () => Vibration.cancel();
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.ring} />
      {peer?.avatarUrl ? (
        <Image source={{ uri: peer.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <UserRound size={54} color={colors.gold} />
        </View>
      )}

      <Text style={styles.label}>{mode === "video" ? "Appel video entrant" : "Appel vocal entrant"}</Text>
      <Text style={styles.name}>{peerName}</Text>
      <Text style={styles.status}>Notification en temps reel</Text>

      <View style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.reject]} onPress={onReject}>
          <PhoneOff size={28} color={colors.white} />
          <Text style={styles.actionText}>Refuser</Text>
        </Pressable>

        <Pressable style={[styles.actionButton, styles.accept]} onPress={onAccept}>
          {mode === "video" ? <Video size={28} color={colors.white} /> : <Phone size={28} color={colors.white} />}
          <Text style={styles.actionText}>Accepter</Text>
        </Pressable>
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
    paddingHorizontal: 26,
  },
  ring: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(201,169,97,0.42)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  avatarFallback: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#eadfd5",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 26,
    textTransform: "uppercase",
  },
  name: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  status: {
    color: "#eadfd5",
    marginTop: 8,
    fontSize: 13,
  },
  actions: {
    position: "absolute",
    bottom: 64,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  reject: {
    backgroundColor: colors.danger,
  },
  accept: {
    backgroundColor: "#1F9D55",
  },
  actionText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
  },
});
