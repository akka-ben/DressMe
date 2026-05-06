import { useEvent } from "expo";
import React, { useEffect, useMemo, useState } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import {
  VideoView,
  useVideoPlayer,
  type VideoContentFit,
  type VideoSource,
} from "expo-video";

import { colors } from "../theme/dressme";

type DressMeVideoPlayerProps = {
  uri: string;
  style: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  nativeControls?: boolean;
  contentFit?: VideoContentFit;
};

export function DressMeVideoPlayer({
  uri,
  style,
  autoPlay = false,
  loop = false,
  muted = false,
  nativeControls = true,
  contentFit = "cover",
}: DressMeVideoPlayerProps) {
  const source = useMemo<VideoSource>(() => buildVideoSource(uri), [uri]);
  const [loadError, setLoadError] = useState("");

  const player = useVideoPlayer(source, (videoPlayer) => {
    safelyConfigurePlayer(videoPlayer, { autoPlay, loop, muted });
  });
  const statusChange = useEvent(player, "statusChange", {
    status: player.status,
    oldStatus: undefined,
    error: undefined,
  });

  useEffect(() => {
    safelyConfigurePlayer(player, { autoPlay, loop, muted });
  }, [autoPlay, loop, muted, player]);

  useEffect(() => {
    if (statusChange.status === "error") {
      setLoadError(statusChange.error?.message ?? "Video indisponible");
      return;
    }

    if (statusChange.status === "readyToPlay" || statusChange.status === "loading") {
      setLoadError("");
    }
  }, [statusChange.error?.message, statusChange.status]);

  useEffect(() => {
    if (autoPlay && statusChange.status === "readyToPlay") {
      safelyConfigurePlayer(player, { autoPlay, loop, muted });
    }
  }, [autoPlay, loop, muted, player, statusChange.status]);

  if (!uri.trim() || loadError) {
    return (
      <View style={[style, styles.fallback]}>
        <Text style={styles.fallbackTitle}>Video indisponible</Text>
        {loadError ? <Text style={styles.fallbackText} numberOfLines={3}>{loadError}</Text> : null}
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls={nativeControls}
      contentFit={contentFit}
      allowsVideoFrameAnalysis={false}
      playsInline
      onFirstFrameRender={() => setLoadError("")}
      fullscreenOptions={{ enable: true }}
    />
  );
}

function buildVideoSource(uri: string): VideoSource {
  const trimmedUri = uri.trim();
  if (!trimmedUri) {
    return null;
  }

  const contentType = inferContentType(trimmedUri);
  return {
    uri: trimmedUri,
    contentType,
    useCaching: false,
  };
}

function inferContentType(uri: string): NonNullable<Extract<VideoSource, { uri?: string }>["contentType"]> {
  const cleanUri = uri.toLowerCase().split("?")[0];
  if (cleanUri.endsWith(".m3u8")) {
    return "hls";
  }
  if (cleanUri.endsWith(".mpd")) {
    return "dash";
  }
  return "progressive";
}

function safelyConfigurePlayer(
  player: ReturnType<typeof useVideoPlayer>,
  {
    autoPlay,
    loop,
    muted,
  }: {
    autoPlay: boolean;
    loop: boolean;
    muted: boolean;
  },
) {
  try {
    player.loop = loop;
    player.muted = muted;

    if (autoPlay) {
      player.play();
    } else {
      player.pause();
    }
  } catch {
    // Expo can release the native shared object before React finishes a fast screen switch.
    // Ignoring that stale player prevents the redbox; the next mounted VideoView owns playback.
  }
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    backgroundColor: colors.black,
  },
  fallbackTitle: {
    color: colors.white,
    fontWeight: "900",
    textAlign: "center",
  },
  fallbackText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
  },
});
