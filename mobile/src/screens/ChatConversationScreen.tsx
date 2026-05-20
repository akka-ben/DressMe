import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import {
  Image as ImageIcon,
  Mic,
  Pause,
  Phone,
  Play,
  Send,
  UserRound,
  Video,
} from "lucide-react-native";

import { client } from "../services";
import { useAuth } from "../context/AuthContext";
import type { Conversation, Message, User } from "../types/contracts";
import type { CallMode } from "../types/calls";
import { colors, radius } from "../theme/dressme";

type Props = {
  conversation: Conversation;
  onBack: () => void;
  onStartCall: (mode: CallMode, peer?: User, peerName?: string) => void;
  onLoaded?: () => void;
};

const REALTIME_REFRESH_MS = 3000;
const MAX_VOICE_NOTE_MS = 60_000;

export function ChatConversationScreen({ conversation, onBack, onStartCall, onLoaded }: Props) {
  const { token, user } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const peer = getConversationPeer(conversation, user?.id);
  const peerName = conversation.title || getUserName(peer);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const loadMessages = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const data = await client.getConversationMessages(conversation.id, token ?? undefined);
      setMessages(data);
      setError(null);
      onLoaded?.();
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Impossible de charger les messages.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [conversation.id, onLoaded, token]);

  useEffect(() => {
    void loadMessages(true);
    const interval = setInterval(() => void loadMessages(), REALTIME_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    return () => {
      if (recording) {
        void recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (kind: "text" | "image" | "audio" = "text", mediaUri?: string) => {
    const body = mediaUri ?? input.trim();
    if (!body || sending) {
      return;
    }

    const optimisticMessage: Message = {
      id: `local-${Date.now()}`,
      conversationId: conversation.id,
      sender: user ?? {
        id: "local-user",
        firstName: "Moi",
        lastName: "",
        email: "",
      },
      kind,
      body,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);
    setInput("");
    setSending(true);

    try {
      const saved = await client.sendConversationMessage(
        conversation.id,
        { body, kind },
        token ?? undefined,
      );
      setMessages((current) =>
        current.map((message) => (message.id === optimisticMessage.id ? saved : message)),
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Impossible d'envoyer le message.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== optimisticMessage.id));
    } finally {
      setSending(false);
    }
  };

  const openImageOptions = () => {
    Alert.alert("Envoyer une photo", "Choisissez la source de l'image.", [
      { text: "Camera", onPress: () => void pickImage("camera") },
      { text: "Galerie", onPress: () => void pickImage("library") },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const pickImage = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l'acces pour envoyer une photo.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 5],
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.82,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [4, 5],
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.82,
          });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    await sendMessage("image", result.assets[0].uri);
  };

  const toggleRecording = async () => {
    if (recording) {
      await stopRecording();
      return;
    }
    await startRecording();
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission requise", "Autorisez le micro pour envoyer un vocal.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      const startedAt = Date.now();
      setRecording(created.recording);
      setRecordingStartedAt(startedAt);

      setTimeout(() => {
        setRecording((currentRecording) => {
          if (currentRecording === created.recording) {
            void stopRecording(currentRecording, startedAt, Date.now());
          }
          return currentRecording;
        });
      }, MAX_VOICE_NOTE_MS);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Impossible de demarrer l'enregistrement.";
      setError(message);
    }
  };

  const stopRecording = async (
    activeRecording = recording,
    startedAt = recordingStartedAt,
    stoppedAt = Date.now(),
  ) => {
    if (!activeRecording) {
      return;
    }

    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      const duration = startedAt
        ? Math.max(1, Math.round((stoppedAt - startedAt) / 1000))
        : 1;
      setRecording(null);
      setRecordingStartedAt(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) {
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await sendMessage("audio", `data:audio/m4a;base64,${base64Audio}|${duration}`);
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Impossible d'envoyer le vocal.";
      setError(message);
      setRecording(null);
      setRecordingStartedAt(null);
    }
  };

  const deleteMessage = async (message: Message) => {
    if (!isMine(message, user) || message.id.startsWith("local-")) {
      return;
    }

    Alert.alert("Supprimer le message", "Voulez-vous supprimer ce message ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          setMessages((current) => current.filter((item) => item.id !== message.id));
          void client
            .deleteConversationMessage(conversation.id, message.id, token ?? undefined)
            .catch((requestError) => {
              const messageText =
                requestError instanceof Error ? requestError.message : "Impossible de supprimer le message.";
              setError(messageText);
              void loadMessages(true);
            });
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        {peer?.avatarUrl ? (
          <Image source={{ uri: peer.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <UserRound size={21} color={colors.burgundy} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.name}>{peerName}</Text>
          <Text style={styles.presence}>{recording ? "Enregistrement vocal..." : "Temps reel actif"}</Text>
        </View>
        <Pressable onPress={() => onStartCall("audio", peer, peerName)} style={styles.headerButton}>
          <Phone size={19} color={colors.burgundy} />
        </Pressable>
        <Pressable onPress={() => onStartCall("video", peer, peerName)} style={styles.headerButton}>
          <Video size={19} color={colors.burgundy} />
        </Pressable>
      </View>

      {error ? (
        <Pressable style={styles.errorBox} onPress={() => void loadMessages(true)}>
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.messageArea}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.burgundy} />
          </View>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={isMine(message, user)}
              onDelete={() => deleteMessage(message)}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.composer}>
        <Pressable style={styles.toolButton} onPress={openImageOptions}>
          <ImageIcon size={19} color={colors.burgundy} />
        </Pressable>
        <Pressable
          style={[styles.toolButton, recording && styles.recordingButton]}
          onPress={() => void toggleRecording()}
        >
          {recording ? <Pause size={19} color={colors.white} /> : <Mic size={19} color={colors.burgundy} />}
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={recording ? "Touchez pause pour envoyer le vocal" : "Message..."}
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable
          disabled={sending || !input.trim()}
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={() => void sendMessage("text")}
        >
          <Send size={19} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  mine,
  onDelete,
}: {
  message: Message;
  mine: boolean;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onLongPress={mine ? onDelete : undefined}
      delayLongPress={350}
      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
    >
      {message.kind === "image" ? (
        <Image source={{ uri: message.body }} style={styles.messageImage} />
      ) : message.kind === "audio" ? (
        <AudioMessage body={message.body} mine={mine} />
      ) : (
        <Text style={[styles.messageText, mine && styles.textMine]}>{message.body}</Text>
      )}
      <Text style={[styles.time, mine && styles.timeMine]}>{formatMessageTime(message.createdAt)}</Text>
    </Pressable>
  );
}

function AudioMessage({ body, mine }: { body: string; mine: boolean }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [uri, duration] = parseAudioBody(body);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
    };
  }, []);

  const togglePlayback = async () => {
    if (playing) {
      await soundRef.current?.pauseAsync();
      setPlaying(false);
      return;
    }

    if (!soundRef.current) {
      const playableUri = await resolvePlayableAudioUri(uri);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
      const created = await Audio.Sound.createAsync({ uri: playableUri });
      soundRef.current = created.sound;
      created.sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          void soundRef.current?.setPositionAsync(0);
        }
      });
    }

    await soundRef.current.playAsync();
    setPlaying(true);
  };

  return (
    <Pressable style={styles.audioBubble} onPress={() => void togglePlayback()}>
      {playing ? (
        <Pause size={19} color={mine ? colors.white : colors.burgundy} />
      ) : (
        <Play size={19} color={mine ? colors.white : colors.burgundy} />
      )}
      <View style={[styles.audioTrack, mine && styles.audioTrackMine]} />
      <Text style={[styles.audioText, mine && styles.textMine]}>{duration}</Text>
    </Pressable>
  );
}

async function resolvePlayableAudioUri(uri: string): Promise<string> {
  if (!uri.startsWith("data:audio/")) {
    return uri;
  }

  const [, payload] = uri.split(",", 2);
  if (!payload) {
    return uri;
  }

  const extension = uri.includes("audio/wav") ? "wav" : "m4a";
  const fileUri = `${FileSystem.cacheDirectory ?? ""}dressme-audio-${hashString(uri)}.${extension}`;
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) {
    await FileSystem.writeAsStringAsync(fileUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return fileUri;
}

function parseAudioBody(body: string): [string, string] {
  const [uri, rawDuration] = body.split("|");
  const seconds = Number(rawDuration);
  if (!Number.isFinite(seconds)) {
    return [uri, "0:00"];
  }
  return [uri, `0:${String(seconds).padStart(2, "0")}`];
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function isMine(message: Message, user: User | null): boolean {
  if (!user) {
    return message.sender.id === "mohammed" || message.sender.id === "local-user";
  }
  return message.sender.id === user.id || message.sender.email === user.email;
}

function getConversationPeer(conversation: Conversation, currentUserId?: string): User | undefined {
  return (
    conversation.participants.find((participant) => participant.id !== currentUserId) ??
    conversation.participants[0]
  );
}

function getUserName(user?: User): string {
  if (!user) {
    return "Contact";
  }
  return `${user.firstName} ${user.lastName}`.trim() || user.email || "Contact";
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    gap: 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  back: {
    color: colors.burgundy,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.beige,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontWeight: "900",
  },
  presence: {
    color: colors.burgundy,
    fontSize: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  messageArea: {
    flex: 1,
    minHeight: 0,
  },
  messageContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    gap: 9,
    paddingTop: 8,
    paddingBottom: 10,
  },
  loadingState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.burgundy,
    borderBottomRightRadius: 5,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    color: colors.text,
    lineHeight: 19,
  },
  textMine: {
    color: colors.white,
  },
  messageImage: {
    width: 210,
    height: 260,
    borderRadius: radius.md,
    backgroundColor: colors.beige,
  },
  audioBubble: {
    minWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  audioTrackMine: {
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  audioText: {
    color: colors.text,
    fontWeight: "800",
  },
  time: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 5,
  },
  timeMine: {
    color: "#f1dce2",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 8,
    marginBottom: 0,
  },
  toolButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingButton: {
    backgroundColor: colors.danger,
  },
  input: {
    flex: 1,
    maxHeight: 128,
    minHeight: 38,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.burgundy,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  errorBox: {
    backgroundColor: "#FFF5F5",
    borderColor: "#F0C4C4",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },
});
