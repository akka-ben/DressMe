import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { Audio } from "expo-av";
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

const RINGTONE_URI =
  "data:audio/wav;base64,UklGRkQcAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSAcAAAAAI4cASxCJ34QKPIt2o7TVeEw/VUaZCuJKBMT3PTC20rTWN9j+gEYmyqnKZUVm/d73TTTe92b95UVpymbKgEYY/pY30rTwtvc9BMTiShkK1UaMP1V4Y7TLdoo8n4QQicBLI4cAABy4//TvtiC79gN0yVyLKse0AKr5ZzUd9ft7CQLPiS2LKggnQX/52XVWdZr6mUIhSLMLIUiZQhr6lnWZdX/550FqCC2LD4kJAvt7HfXnNSr5dACqx5yLNMl2A2C777Y/9Ny4wAAjhwBLEInfhAo8i3ajtNV4TD9VRpkK4koExPc9MLbStNY32P6ARibKqcplRWb93vdNNN73Zv3lRWnKZsqARhj+ljfStPC29z0ExOJKGQrVRow/VXhjtMt2ijyfhBCJwEsjhwAAHLj/9O+2ILv2A3TJXIsqx7QAqvlnNR31+3sJAs+JLYsqCCdBf/nZdVZ1mvqZQiFIswshSJlCGvqWdZl1f/nnQWoILYsPiQkC+3sd9ec1Kvl0AKrHnIs0yXYDYLvvtj/03LjAACOHAEsQid+ECjyLdqO01XhMP1VGmQriSgTE9z0wttK01jfY/oBGJsqpymVFZv3e90003vdm/eVFacpmyoBGGP6WN9K08Lb3PQTE4koZCtVGjD9VeGO0y3aKPJ+EEInASyOHAAAcuP/077Ygu/YDdMlciyrHtACq+Wc1HfX7ewkCz4ktiyoIJ0F/+dl1VnWa+plCIUizCyFImUIa+pZ1mXV/+edBaggtiw+JCQL7ex315zUq+XQAqsecizTJdgNgu++2P/TcuM=";

export function IncomingCallScreen({ mode, peer, peerName, onAccept, onReject }: Props) {
  useEffect(() => {
    Vibration.vibrate([0, 900, 500], true);
    let ringtone: Audio.Sound | null = null;
    let stopped = false;

    const startRingtone = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
      const created = await Audio.Sound.createAsync(
        { uri: RINGTONE_URI },
        { isLooping: true, shouldPlay: true, volume: 1 },
      );
      if (stopped) {
        await created.sound.unloadAsync();
        return;
      }
      ringtone = created.sound;
    };

    void startRingtone().catch(() => undefined);

    return () => {
      stopped = true;
      Vibration.cancel();
      void ringtone?.stopAsync().catch(() => undefined);
      void ringtone?.unloadAsync().catch(() => undefined);
    };
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
