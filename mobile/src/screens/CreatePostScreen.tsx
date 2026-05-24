import React, { useEffect, useMemo, useRef, useState } from "react";
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import {
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
import {
  Camera,
  ChevronLeft,
  Image as ImageIcon,
  Radio,
  RotateCcw,
  Settings,
  Video,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";

import { DressMeVideoPlayer } from "../components/DressMeVideoPlayer";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { client } from "../services";
import { colors, fonts, radius, shadow } from "../theme/dressme";
import { iconTouchHitSlop, touchHitSlop, touchRetentionOffset } from "../utils/touchTargets";

type ComposerMode = "post" | "story" | "reel" | "live";
type CameraTool = "normal" | "create" | "boomerang" | "layout" | "handsFree";

type SelectedMedia = {
  uri: string;
  name: string;
  type: string;
  mediaType: "image" | "video";
  source: "camera" | "gallery";
  layoutItems?: SelectedMedia[];
};

type CreatePostScreenProps = {
  onClose?: () => void;
  onCreated?: (createdType: "post" | "reel" | "story") => void;
  onOpenLive?: () => void;
};

const modeLabels: Record<ComposerMode, string> = {
  post: "POST",
  story: "STORY",
  reel: "REEL",
  live: "LIVE",
};

const defaultCaptionByMode: Record<ComposerMode, string> = {
  post: "Nouvelle tenue DressMe",
  story: "Story DressMe",
  reel: "Nouveau reel DressMe",
  live: "Live DressMe",
};

const liveCommentTimeline = [
  { at: 3, username: "amina_style", text: "Le look est canon." },
  { at: 7, username: "karim_looks", text: "Montre les chaussures." },
  { at: 12, username: "leila_chic", text: "La couleur burgundy va trop bien." },
  { at: 18, username: "nadia_glam", text: "Tu peux tourner la camera ?" },
  { at: 25, username: "sophialaurent", text: "Tres editorial." },
];

export function CreatePostScreen({ onClose, onCreated, onOpenLive }: CreatePostScreenProps) {
  const { token } = useAuth();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [activeMode, setActiveMode] = useState<ComposerMode>("post");
  const [activeTool, setActiveTool] = useState<CameraTool>("normal");
  const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [composerStep, setComposerStep] = useState<"camera" | "details">("camera");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [layoutCaptures, setLayoutCaptures] = useState<SelectedMedia[]>([]);
  const [createText, setCreateText] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [garmentTags, setGarmentTags] = useState("");
  const [message, setMessage] = useState("Ouvre la camera, capture une tenue ou choisis depuis la galerie.");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [liveViewerCount, setLiveViewerCount] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);

  const isToolVideoMode = activeTool === "boomerang" || activeTool === "handsFree";
  const isVideoMode = activeMode === "reel" || activeMode === "live" || isToolVideoMode;
  const needsMicrophone = activeMode === "reel" || activeMode === "live" || isToolVideoMode;
  const hasCameraAccess = Boolean(cameraPermission?.granted);
  const hasMicrophoneAccess = !needsMicrophone || Boolean(microphonePermission?.granted);

  useEffect(() => {
    if (!cameraPermission) {
      void requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    if (needsMicrophone && !microphonePermission?.granted) {
      void requestMicrophonePermission();
    }
  }, [microphonePermission?.granted, needsMicrophone, requestMicrophonePermission]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      setRecordingSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    }, 500);

    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (!isLive) {
      setLiveSeconds(0);
      setLiveViewerCount(0);
      return undefined;
    }

    const startedAt = Date.now();
    setLiveViewerCount(1);
    const interval = setInterval(() => {
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setLiveSeconds(elapsedSeconds);
      setLiveViewerCount(Math.min(42, 1 + Math.floor(elapsedSeconds / 4) * 2));
    }, 500);

    return () => clearInterval(interval);
  }, [isLive]);

  const visibleLiveComments = useMemo(
    () => liveCommentTimeline.filter((comment) => comment.at <= liveSeconds).slice(-3),
    [liveSeconds],
  );

  const parsedTags = useMemo(
    () =>
      hashtags
        .split(/[\s,]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        .slice(0, 8),
    [hashtags],
  );

  const parsedGarmentTags = useMemo(
    () =>
      garmentTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8),
    [garmentTags],
  );

  const publishableMode = activeMode === "post" || activeMode === "reel" || activeMode === "story";
  const selectMedia = (
    media: SelectedMedia,
    options?: {
      caption?: string;
      hashtags?: string;
      garmentTags?: string;
    },
  ) => {
    setSelectedMedia(media);
    setCaption(options?.caption ?? "");
    setHashtags(options?.hashtags ?? "");
    setGarmentTags(options?.garmentTags ?? "");
    setComposerStep("details");
    if (media.layoutItems?.length) {
      setLayoutCaptures(media.layoutItems);
    }
    setMessage(
      media.source === "camera"
        ? "Media capture. Ajoute une legende puis publie."
        : "Media choisi depuis la galerie. Ajoute une legende puis publie.",
    );
  };

  const handleClose = () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
    }
    if (isLive) {
      setIsLive(false);
    }
    onClose?.();
  };

  const switchMode = (mode: ComposerMode) => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
    }
    if (isLive) {
      setIsLive(false);
    }
    setActiveMode(mode);
    setActiveTool("normal");
    setLayoutCaptures([]);
    setMessage(getCameraMessage(mode));
  };

  const selectCameraTool = (tool: CameraTool) => {
    if (tool === "layout" && activeTool === "layout" && layoutCaptures.length) {
      finalizeLayout();
      return;
    }

    if (isRecording) {
      cameraRef.current?.stopRecording();
    }
    if (isLive) {
      setIsLive(false);
    }

    const nextTool = activeTool === tool ? "normal" : tool;
    setActiveTool(nextTool);
    setLayoutCaptures([]);

    if (nextTool === "normal") {
      setMessage(getCameraMessage(activeMode));
      return;
    }

    if (nextTool === "layout") {
      setActiveMode("post");
    }

    if ((nextTool === "create" || nextTool === "boomerang" || nextTool === "handsFree") && activeMode === "live") {
      setActiveMode("story");
    }

    if ((nextTool === "boomerang" || nextTool === "handsFree") && activeMode === "post") {
      setActiveMode("story");
    }

    setMessage(getToolMessage(nextTool));
  };

  const openGallery = async () => {
    if (activeMode === "live") {
      Alert.alert("Live", "Le live utilise la camera en direct. La galerie n'est pas utilisee pour ce mode.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorise l'acces a la galerie pour choisir une photo ou une video.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: activeTool === "layout" ? ["images"] : getGalleryMediaTypes(activeMode),
        allowsEditing: false,
        allowsMultipleSelection: activeTool === "layout",
        selectionLimit: activeTool === "layout" ? 4 : 1,
        quality: 0.9,
        videoMaxDuration: 90,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      if (activeTool === "layout" && result.assets.length > 1) {
        const layoutItems: SelectedMedia[] = result.assets.slice(0, 4).map((asset) => {
          const mediaType: "image" | "video" = asset.type === "video" ? "video" : "image";
          const mimeType = asset.mimeType ?? inferMimeType(asset.uri, mediaType);
          return {
            uri: asset.uri,
            name: asset.fileName ?? buildMediaFilename(mediaType, mimeType),
            type: mimeType,
            mediaType,
            source: "gallery" as const,
          };
        });

        if (layoutItems.length) {
          selectMedia(
            {
              ...layoutItems[0],
              name: `dressme-layout-${layoutItems.length}-photos.jpg`,
              layoutItems,
            },
            { caption: "Layout DressMe" },
          );
        }
        return;
      }

      const asset = result.assets[0];
      const mediaType = asset.type === "video" ? "video" : "image";
      const mimeType = asset.mimeType ?? inferMimeType(asset.uri, mediaType);

      selectMedia({
        uri: asset.uri,
        name: asset.fileName ?? buildMediaFilename(mediaType, mimeType),
        type: mimeType,
        mediaType,
        source: "gallery",
      });
    } catch (error) {
      Alert.alert("Galerie indisponible", error instanceof Error ? error.message : "Impossible d'ouvrir la galerie.");
    }
  };

  const capturePhoto = async (options?: { caption?: string }) => {
    if (!hasCameraAccess) {
      await requestCameraPermission();
      return;
    }

    if (!cameraRef.current || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setMessage("Capture de la photo...");
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        exif: false,
        skipProcessing: false,
      });

      selectMedia(
        {
          uri: picture.uri,
          name: buildMediaFilename("image", "image/jpeg"),
          type: "image/jpeg",
          mediaType: "image",
          source: "camera",
        },
        { caption: options?.caption },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Impossible de capturer la photo.";
      setMessage(errorMessage);
      Alert.alert("Camera indisponible", errorMessage);
    } finally {
      setIsCapturing(false);
    }
  };

  const captureLayoutPhoto = async () => {
    if (!hasCameraAccess) {
      await requestCameraPermission();
      return;
    }

    if (!cameraRef.current || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setMessage(`Capture layout ${layoutCaptures.length + 1}/4...`);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        exif: false,
        skipProcessing: false,
      });

      const nextCapture: SelectedMedia = {
        uri: picture.uri,
        name: buildMediaFilename("image", "image/jpeg"),
        type: "image/jpeg",
        mediaType: "image",
        source: "camera",
      };
      const nextCaptures = [...layoutCaptures, nextCapture];
      setLayoutCaptures(nextCaptures);

      if (nextCaptures.length >= 4) {
        selectMedia(
          {
            ...nextCaptures[0],
            name: "dressme-layout-4-photos.jpg",
            layoutItems: nextCaptures,
          },
          { caption: "Layout DressMe" },
        );
        return;
      }

      setMessage(`Photo ${nextCaptures.length}/4 ajoutee. Capture encore ou appuie sur Layout pour terminer.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Impossible de capturer la photo layout.";
      setMessage(errorMessage);
      Alert.alert("Layout indisponible", errorMessage);
    } finally {
      setIsCapturing(false);
    }
  };

  const finalizeLayout = () => {
    if (!layoutCaptures.length) {
      setMessage("Capture au moins une photo pour creer un layout.");
      return;
    }

    selectMedia(
      {
        ...layoutCaptures[0],
        name: `dressme-layout-${layoutCaptures.length}-photos.jpg`,
        layoutItems: layoutCaptures,
      },
      { caption: "Layout DressMe" },
    );
  };

  const toggleVideoRecording = async (options?: { maxDuration?: number; label?: string }) => {
    if (!hasCameraAccess) {
      await requestCameraPermission();
      return;
    }

    if (!hasMicrophoneAccess) {
      await requestMicrophonePermission();
      return;
    }

    if (!cameraRef.current) {
      return;
    }

    if (isRecording) {
      cameraRef.current.stopRecording();
      return;
    }

    setIsRecording(true);
    setMessage(options?.label ?? "Enregistrement du reel...");
    try {
      const videoResult = await cameraRef.current.recordAsync({ maxDuration: options?.maxDuration ?? 90 });
      if (!videoResult?.uri) {
        setMessage("Aucune video enregistree.");
        return;
      }

      selectMedia({
        uri: videoResult.uri,
        name: buildMediaFilename("video", "video/quicktime"),
        type: "video/quicktime",
        mediaType: "video",
        source: "camera",
      }, { caption: activeTool === "boomerang" ? "Boomerang DressMe" : undefined });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Impossible d'enregistrer le reel.";
      setMessage(errorMessage);
      Alert.alert("Reel indisponible", errorMessage);
    } finally {
      setIsRecording(false);
    }
  };

  const handleCapturePress = async () => {
    if (activeMode === "live") {
      if (onOpenLive) {
        onOpenLive();
        return;
      }
      await toggleLiveSession();
      return;
    }

    if (activeMode === "reel") {
      await toggleVideoRecording();
      return;
    }

    if (activeTool === "boomerang") {
      await toggleVideoRecording({ maxDuration: 2, label: "Boomerang en cours..." });
      return;
    }

    if (activeTool === "handsFree") {
      await toggleVideoRecording({ maxDuration: 90, label: "Hands-free enregistrement..." });
      return;
    }

    if (activeTool === "layout") {
      await captureLayoutPhoto();
      return;
    }

    await capturePhoto({ caption: activeTool === "create" ? createText.trim() : undefined });
  };

  const toggleLiveSession = async () => {
    if (isLive) {
      setIsLive(false);
      setMessage(`Live termine: ${formatRecordingTime(liveSeconds)}.`);
      Alert.alert("Live termine", `Duree: ${formatRecordingTime(liveSeconds)} · Pic: ${liveViewerCount} spectateurs.`);
      return;
    }

    if (!hasCameraAccess) {
      await requestCameraPermission();
      return;
    }

    if (!hasMicrophoneAccess) {
      await requestMicrophonePermission();
      return;
    }

    setIsLive(true);
    setMessage("Live en direct. Appuie sur le bouton rouge pour terminer.");
  };

  const resetToCamera = () => {
    setSelectedMedia(null);
    setComposerStep("camera");
    if (activeTool !== "layout") {
      setLayoutCaptures([]);
    }
    setMessage(getCameraMessage(activeMode));
  };

  const publishPost = async () => {
    if (isPublishing) {
      return;
    }

    if (!token) {
      Alert.alert("Session requise", "Connecte-toi avant de publier.");
      return;
    }

    if (!selectedMedia) {
      Alert.alert("Media requis", "Capture un media ou choisis-le depuis la galerie.");
      return;
    }

    if (!publishableMode) {
      Alert.alert(
        "Live non connecte",
        "Ce mode est present dans le flux camera. Le streaming backend sera ajoute dans une phase dediee.",
      );
      return;
    }

    const mediaType = activeMode === "reel" ? "video" : selectedMedia.mediaType;
    const finalCaption = caption.trim() || defaultCaptionByMode[activeMode];

    setIsPublishing(true);
    setMessage("Upload du media...");
    try {
      const mediaItems = selectedMedia.layoutItems?.length ? selectedMedia.layoutItems : [selectedMedia];
      const uploads = await Promise.all(
        mediaItems.map((media) =>
          client.uploadMedia(
            {
              uri: media.uri,
              name: media.name,
              type: media.type,
            },
            token,
          ),
        ),
      );
      const upload = uploads[0];

      if (activeMode === "story") {
        setMessage("Creation de la story...");
        await client.createStory(
          {
            mediaUrl: upload.url,
            mediaType,
          caption: finalCaption,
        },
          token,
        );

        setMessage("Story publiee.");
        Alert.alert("Story publiee", "Ta story est disponible dans la barre des stories pendant 24h.");
        onCreated?.("story");
        return;
      }

      setMessage("Creation de la publication...");
      await client.createPost(
        {
          caption: finalCaption,
          mediaType,
          imageUrls: uploads.map((item) => item.url),
          hashtags: parsedTags,
          garmentTags: parsedGarmentTags,
        },
        token,
      );

      const createdType = activeMode === "reel" ? "reel" : "post";
      setMessage(createdType === "reel" ? "Reel publie." : "Post publie.");
      Alert.alert(
        createdType === "reel" ? "Reel publie" : "Post publie",
        "Le media est enregistre dans MongoDB.",
      );
      onCreated?.(createdType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Impossible de publier ce media.";
      setMessage(errorMessage);
      Alert.alert("Publication echouee", errorMessage);
    } finally {
      setIsPublishing(false);
    }
  };

  if (composerStep === "details") {
    return (
      <KeyboardAvoidingView
        style={styles.detailsShell}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
      >
        <ScrollView
          style={styles.detailsScroll}
          contentContainerStyle={styles.detailsContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Pressable style={styles.roundButton} onPress={resetToCamera}>
                <ChevronLeft size={24} color={colors.muted} />
              </Pressable>
              <View style={styles.detailsTitleBlock}>
                <Text style={styles.detailsTitle}>
                  {activeMode === "reel" ? "Nouveau reel" : activeMode === "story" ? "Nouvelle story" : "Nouveau post"}
                </Text>
                <Text style={styles.detailsSubtitle}>
                  {selectedMedia?.source === "camera" ? "Capture camera" : "Depuis la galerie"}
                </Text>
              </View>
              <Pressable
                disabled={isPublishing}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Publier le media"
                onPress={() => void publishPost()}
              >
                <Text style={[styles.publish, isPublishing && styles.publishDisabled]}>
                  {isPublishing ? "..." : "Publier"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.previewFrame}>
              {selectedMedia?.layoutItems?.length ? (
                <View style={styles.layoutPreviewGrid}>
                  {selectedMedia.layoutItems.map((item, index) => (
                    <Image
                      key={`${item.uri}-${index}`}
                      source={{ uri: item.uri }}
                      style={[
                        styles.layoutPreviewImage,
                        selectedMedia.layoutItems?.length === 1 && styles.layoutPreviewImageSingle,
                      ]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              ) : selectedMedia?.mediaType === "image" ? (
                <Image source={{ uri: selectedMedia.uri }} style={styles.previewImage} resizeMode="cover" />
              ) : selectedMedia?.uri ? (
                <DressMeVideoPlayer
                  uri={selectedMedia.uri}
                  style={styles.previewImage}
                  autoPlay
                  loop
                  muted
                  nativeControls
                  contentFit="cover"
                />
              ) : (
                <View style={styles.videoPreview}>
                  <Video size={58} color={colors.white} />
                  <Text style={styles.videoPreviewTitle}>Reel video</Text>
                  <Text style={styles.videoPreviewName} numberOfLines={2}>{selectedMedia?.name}</Text>
                </View>
              )}
            </View>

            <Text style={styles.fieldLabel}>Legende</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={
                activeMode === "reel"
                  ? "Ajoute une description a ton reel..."
                  : "Ecris une legende..."
              }
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textArea]}
              editable={!isPublishing}
              multiline
              maxLength={1200}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Hashtags</Text>
            <TextInput
              value={hashtags}
              onChangeText={setHashtags}
              placeholder="ex: #casual #chic #burgundy"
              placeholderTextColor={colors.muted}
              style={styles.input}
              editable={!isPublishing}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {parsedTags.length ? (
              <View style={styles.tagRow}>
                {parsedTags.map((tag) => (
                  <Text key={tag} style={styles.tagPill}>{tag}</Text>
                ))}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Tags vetements</Text>
            <TextInput
              value={garmentTags}
              onChangeText={setGarmentTags}
              placeholder="ex: blazer burgundy, denim, sneakers"
              placeholderTextColor={colors.muted}
              style={styles.input}
              editable={!isPublishing}
            />

            {parsedGarmentTags.length ? (
              <View style={styles.tagRow}>
                {parsedGarmentTags.map((tag) => (
                  <Text key={tag} style={styles.garmentPill}>{tag}</Text>
                ))}
              </View>
            ) : null}

            <View style={styles.selectedMediaBox}>
              <Text style={styles.selectedMediaName} numberOfLines={1}>{selectedMedia?.name}</Text>
              <Text style={styles.selectedMediaMeta}>
                {selectedMedia?.layoutItems?.length
                  ? `Layout ${selectedMedia.layoutItems.length} image(s)`
                  : selectedMedia?.mediaType === "video"
                    ? "Video locale"
                    : "Image locale"} - upload automatique au moment de publier
              </Text>
            </View>

            <PrimaryButton
              label={
                isPublishing
                  ? "Publication..."
                  : activeMode === "story"
                    ? "Publier la story"
                    : activeMode === "reel"
                      ? "Publier le reel"
                      : "Publier"
              }
              disabled={isPublishing}
              onPress={() => void publishPost()}
            />
            <Text style={styles.note}>{message}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.cameraShell}>
      {hasCameraAccess ? (
        <CameraView
          ref={cameraRef}
          pointerEvents="none"
          style={styles.cameraPreview}
          facing={cameraFacing}
          flash={flashEnabled ? "on" : "off"}
          mode={isVideoMode ? "video" : "picture"}
          mute={false}
          active={composerStep === "camera"}
          onMountError={({ message: mountMessage }) => setMessage(mountMessage)}
        />
      ) : (
        <View style={styles.permissionState}>
          <Camera size={52} color={colors.white} />
          <Text style={styles.permissionTitle}>Camera requise</Text>
          <Text style={styles.permissionText}>
            Autorise DressMe a ouvrir la camera pour creer un post, une story ou un reel.
          </Text>
          <Pressable style={styles.permissionButton} onPress={() => void requestCameraPermission()}>
            <Text style={styles.permissionButtonText}>Autoriser la camera</Text>
          </Pressable>
        </View>
      )}

      <View pointerEvents="box-none" style={styles.cameraOverlay}>
        <View style={styles.cameraTopBar}>
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPressIn={handleClose}
            pressRetentionOffset={16}
            style={styles.cameraIconButton}
          >
            <X size={28} color={colors.white} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            pressRetentionOffset={12}
            style={styles.cameraIconButton}
            onPress={() => setFlashEnabled((enabled) => !enabled)}
          >
            {flashEnabled ? <Zap size={26} color={colors.white} /> : <ZapOff size={26} color={colors.white} />}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={iconTouchHitSlop}
            pressRetentionOffset={12}
            style={styles.cameraIconButton}
            onPress={() => Alert.alert("Parametres camera", "Flash, camera avant/arriere et outils de creation sont disponibles directement sur cet ecran.")}
          >
            <Settings size={26} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.cameraSideTools}>
          <SideTool
            active={activeTool === "create"}
            label="Aa"
            text="Create"
            onPress={() => selectCameraTool("create")}
          />
          <SideTool
            active={activeTool === "boomerang"}
            label="8"
            text="Boomerang"
            onPress={() => selectCameraTool("boomerang")}
          />
          <SideTool
            active={activeTool === "layout"}
            badge={layoutCaptures.length ? `${layoutCaptures.length}/4` : undefined}
            label="[]"
            text="Layout"
            onLongPress={finalizeLayout}
            onPress={() => selectCameraTool("layout")}
          />
          <SideTool
            active={activeTool === "handsFree"}
            label="O"
            text="Hands-free"
            onPress={() => selectCameraTool("handsFree")}
          />
        </View>

        {activeTool === "create" ? (
          <View style={styles.createTextPanel}>
            <Text style={styles.createTextLabel}>Texte</Text>
            <TextInput
              value={createText}
              onChangeText={setCreateText}
              placeholder="Ecris ton texte..."
              placeholderTextColor="rgba(255,255,255,0.72)"
              multiline
              style={styles.createTextInput}
            />
            <Text style={styles.createHint}>Capture pour utiliser ce texte comme legende.</Text>
          </View>
        ) : null}

        {activeTool === "layout" && layoutCaptures.length ? (
          <View style={styles.layoutProgress}>
            {layoutCaptures.map((item, index) => (
              <Image key={`${item.uri}-${index}`} source={{ uri: item.uri }} style={styles.layoutThumb} />
            ))}
            <Pressable
              accessibilityRole="button"
              hitSlop={touchHitSlop}
              onPress={finalizeLayout}
              pressRetentionOffset={touchRetentionOffset}
              style={styles.layoutDoneButton}
            >
              <Text style={styles.layoutDoneText}>Terminer</Text>
            </Pressable>
          </View>
        ) : null}

        {activeMode === "reel" && isRecording ? (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC {formatRecordingTime(recordingSeconds)}</Text>
          </View>
        ) : null}

        {isLive ? (
          <View style={styles.liveHud}>
            <View style={styles.liveHudTop}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>EN DIRECT</Text>
              </View>
              <Text style={styles.liveTimer}>{formatRecordingTime(liveSeconds)}</Text>
              <Text style={styles.liveViewerText}>{liveViewerCount} spectateurs</Text>
            </View>
            <View style={styles.liveComments}>
              {visibleLiveComments.map((comment) => (
                <View key={`${comment.username}-${comment.at}`} style={styles.liveCommentBubble}>
                  <Text style={styles.liveCommentText}>
                    <Text style={styles.liveCommentUser}>@{comment.username} </Text>
                    {comment.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.cameraBottomPanel}>
          <View style={styles.captureRow}>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              pressRetentionOffset={12}
              style={styles.galleryButton}
              onPress={() => void openGallery()}
            >
              {selectedMedia?.mediaType === "image" ? (
                <Image source={{ uri: selectedMedia.uri }} style={styles.galleryThumb} />
              ) : (
                <ImageIcon size={24} color={colors.white} />
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              pressRetentionOffset={12}
              style={[
                styles.captureButton,
                activeMode === "live" && styles.liveCaptureButton,
                isRecording && styles.recordingCaptureButton,
                isLive && styles.liveActiveCaptureButton,
              ]}
              onPress={() => void handleCapturePress()}
              disabled={isCapturing}
            >
              <View
                style={[
                  styles.captureInner,
                  activeMode === "reel" && styles.reelCaptureInner,
                  activeMode === "live" && styles.liveCaptureInner,
                  isRecording && styles.recordingCaptureInner,
                  isLive && styles.liveActiveCaptureInner,
                ]}
              >
                {activeMode === "live" ? <Radio size={24} color={colors.white} /> : null}
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              pressRetentionOffset={12}
              style={styles.switchCameraButton}
              onPress={() => setCameraFacing((facing) => (facing === "back" ? "front" : "back"))}
              disabled={isRecording}
            >
              <RotateCcw size={26} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.modeRail}>
            {(Object.keys(modeLabels) as ComposerMode[]).map((mode) => (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                key={mode}
                onPress={() => switchMode(mode)}
                pressRetentionOffset={12}
                style={styles.modeButton}
              >
                <Text style={[styles.modeText, activeMode === mode && styles.modeTextActive]}>
                  {modeLabels[mode]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function SideTool({
  active,
  badge,
  label,
  text,
  onLongPress,
  onPress,
}: {
  active: boolean;
  badge?: string;
  label: string;
  text: string;
  onLongPress?: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touchHitSlop}
      onLongPress={onLongPress}
      onPress={onPress}
      pressRetentionOffset={touchRetentionOffset}
      style={[styles.sideTool, active && styles.sideToolActive]}
    >
      <View style={styles.sideToolIconWrap}>
        <Text style={[styles.sideToolIcon, active && styles.sideToolIconActive]}>{label}</Text>
        {badge ? <Text style={styles.sideToolBadge}>{badge}</Text> : null}
      </View>
      <Text style={[styles.sideToolText, active && styles.sideToolTextActive]}>{text}</Text>
    </Pressable>
  );
}

function getCameraMessage(mode: ComposerMode): string {
  switch (mode) {
    case "post":
      return "Capture une photo ou choisis une photo/video depuis la galerie.";
    case "story":
      return "Capture une story ou choisis une photo/video depuis la galerie.";
    case "reel":
      return "Appuie pour enregistrer un reel, puis appuie encore pour terminer.";
    case "live":
      return "Appuie sur le bouton rouge pour demarrer un live.";
  }
}

function getToolMessage(tool: CameraTool): string {
  switch (tool) {
    case "create":
      return "Mode Create actif. Ecris un texte puis capture pour l'ajouter a la publication.";
    case "boomerang":
      return "Mode Boomerang actif. Capture une video courte de 2 secondes.";
    case "layout":
      return "Mode Layout actif. Capture jusqu'a 4 photos, puis appuie sur Terminer.";
    case "handsFree":
      return "Mode Hands-free actif. Appuie une fois pour enregistrer, puis encore pour terminer.";
    case "normal":
      return "Mode camera normal.";
  }
}

function getGalleryMediaTypes(mode: ComposerMode): Array<"images" | "videos"> {
  if (mode === "reel") {
    return ["videos"];
  }

  return ["images", "videos"];
}

function buildMediaFilename(mediaType: "image" | "video", mimeType: string): string {
  const extension =
    mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("quicktime", "mov") ??
    (mediaType === "video" ? "mp4" : "jpg");
  return `dressme-${Date.now()}.${extension}`;
}

function inferMimeType(uri: string, mediaType: "image" | "video"): string {
  const lowerUri = uri.toLowerCase();
  if (mediaType === "video") {
    if (lowerUri.endsWith(".mov")) {
      return "video/quicktime";
    }
    return "video/mp4";
  }

  if (lowerUri.endsWith(".png")) {
    return "image/png";
  }
  return "image/jpeg";
}

function formatRecordingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  cameraShell: {
    flex: 1,
    backgroundColor: "#05080A",
  },
  cameraPreview: {
    flex: 1,
    zIndex: 0,
  },
  permissionState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#05080A",
    gap: 14,
  },
  permissionTitle: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
  },
  permissionText: {
    color: "rgba(255,255,255,0.74)",
    textAlign: "center",
    lineHeight: 21,
  },
  permissionButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 8,
  },
  permissionButtonText: {
    color: colors.text,
    fontWeight: "900",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    justifyContent: "space-between",
  },
  cameraTopBar: {
    paddingTop: Platform.OS === "ios" ? 48 : 24,
    paddingHorizontal: 18,
    zIndex: 30,
    elevation: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cameraSideTools: {
    position: "absolute",
    left: 22,
    top: "38%",
    gap: 18,
  },
  sideTool: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 46,
    borderRadius: 18,
    paddingRight: 12,
  },
  sideToolActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  sideToolIconWrap: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sideToolIcon: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  sideToolIconActive: {
    color: colors.gold,
  },
  sideToolBadge: {
    marginTop: -4,
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.burgundy,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sideToolText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  sideToolTextActive: {
    color: colors.gold,
  },
  createTextPanel: {
    position: "absolute",
    left: 22,
    right: 22,
    top: "21%",
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    gap: 8,
  },
  createTextLabel: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 13,
  },
  createTextInput: {
    minHeight: 88,
    color: colors.white,
    fontSize: 24,
    fontWeight: "900",
    textAlignVertical: "top",
  },
  createHint: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
    fontSize: 12,
  },
  layoutProgress: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 202,
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  layoutThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.beige,
  },
  layoutDoneButton: {
    marginLeft: "auto",
    minHeight: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  layoutDoneText: {
    color: colors.burgundy,
    fontWeight: "900",
    fontSize: 12,
  },
  recordingBadge: {
    position: "absolute",
    top: Platform.OS === "ios" ? 104 : 76,
    alignSelf: "center",
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E53935",
  },
  recordingText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12,
  },
  liveHud: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 178,
    gap: 10,
  },
  liveHudTop: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#E53935",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  liveBadgeText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 11,
  },
  liveTimer: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12,
  },
  liveViewerText: {
    color: "rgba(255,255,255,0.84)",
    fontWeight: "800",
    fontSize: 12,
  },
  liveComments: {
    gap: 7,
    maxWidth: "82%",
  },
  liveCommentBubble: {
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  liveCommentText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 13,
  },
  liveCommentUser: {
    fontWeight: "900",
  },
  cameraBottomPanel: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    paddingTop: 18,
    zIndex: 30,
    elevation: 30,
    backgroundColor: "rgba(4,8,10,0.92)",
    gap: 18,
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  captureButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: colors.white,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  liveCaptureButton: {
    borderColor: "#FF3B30",
  },
  liveActiveCaptureButton: {
    borderColor: colors.white,
  },
  recordingCaptureButton: {
    borderColor: "#FF3B30",
  },
  captureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  reelCaptureInner: {
    backgroundColor: "#E53935",
  },
  recordingCaptureInner: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.white,
  },
  liveCaptureInner: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3B30",
  },
  liveActiveCaptureInner: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
  },
  switchCameraButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  modeRail: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
  },
  modeButton: {
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  modeText: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  modeTextActive: {
    color: colors.white,
    fontWeight: "900",
  },
  detailsShell: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  detailsScroll: {
    flex: 1,
  },
  detailsContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 28,
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  detailsTitleBlock: {
    flex: 1,
  },
  detailsTitle: {
    fontFamily: fonts.display,
    fontSize: 25,
    fontWeight: "700",
    color: colors.text,
  },
  detailsSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  publish: {
    color: colors.burgundy,
    fontWeight: "900",
    fontSize: 14,
  },
  publishDisabled: {
    opacity: 0.38,
  },
  previewFrame: {
    height: 392,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.beige,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  layoutPreviewGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    backgroundColor: colors.black,
  },
  layoutPreviewImage: {
    width: "49.7%",
    height: "49.7%",
    backgroundColor: colors.beige,
  },
  layoutPreviewImageSingle: {
    width: "100%",
    height: "100%",
  },
  videoPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.burgundyDark,
    padding: 18,
  },
  videoPreviewTitle: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 22,
  },
  videoPreviewName: {
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: -5,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    color: colors.text,
  },
  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    color: colors.burgundy,
    backgroundColor: colors.beige,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "800",
    fontSize: 12,
  },
  garmentPill: {
    color: colors.muted,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "800",
    fontSize: 12,
  },
  selectedMediaBox: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  selectedMediaName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  selectedMediaMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
