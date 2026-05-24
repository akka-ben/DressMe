import Constants from "expo-constants";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AppTab, TabBar } from "./src/components/TabBar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { CreatePostScreen } from "./src/screens/CreatePostScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { HomeFeedScreen } from "./src/screens/HomeFeedScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { PostDetailScreen } from "./src/screens/PostDetailScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ReelsScreen } from "./src/screens/ReelsScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { MessagesScreen } from "./src/screens/MessagesScreen";
import { IncomingCallScreen } from "./src/screens/IncomingCallScreen";
import { colors, fonts } from "./src/theme/dressme";
import { EditProfileScreen } from "./src/screens/EditProfileScreen";
import { UserProfileScreen } from "./src/screens/UserProfileScreen";
import { FollowersScreen } from "./src/screens/FollowersScreen";
import { ChangePasswordScreen } from "./src/screens/ChangePasswordScreen";
import { client } from "./src/services";
import type { CallMode } from "./src/types/calls";
import type { LiveSession, User } from "./src/types/contracts";

const splashGif = require("./assets/dressme-splash.gif");
const IS_EXPO_GO = Constants.appOwnership === "expo";
const APP_TOP_INSET = Math.max(Constants.statusBarHeight ?? 0, 0);
const LazyLiveHostScreen = React.lazy(() =>
  import("./src/screens/live/LiveHostScreen").then((module) => ({
    default: module.LiveHostScreen,
  })),
);
const LazyLiveViewerScreen = React.lazy(() =>
  import("./src/screens/live/LiveViewerScreen").then((module) => ({
    default: module.LiveViewerScreen,
  })),
);
const LazyCallScreen = React.lazy(() =>
  import("./src/screens/CallScreen").then((module) => ({
    default: module.CallScreen,
  })),
);

type AuthRoute = "onboarding" | "login" | "register" | "forgot" | "reset";
type LiveRoute = { role: "host" } | { role: "viewer"; session: LiveSession };
type ActiveCall = {
  id?: string;
  mode: CallMode;
  direction: "outgoing" | "incoming";
  peer?: User;
  peerName: string;
};

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const [authRoute, setAuthRoute] = useState<AuthRoute>("onboarding");
  const [activeTab, setActiveTab] = useState<AppTab>("feed");
  const [lastRegisteredEmail, setLastRegisteredEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostFocusComment, setSelectedPostFocusComment] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [liveRoute, setLiveRoute] = useState<LiveRoute | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [followersState, setFollowersState] = useState<{
    userId: string;
    mode: "followers" | "following";
  } | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [messageBadgeCount, setMessageBadgeCount] = useState(0);
  const [messagesDetailOpen, setMessagesDetailOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      const token = extractResetToken(url);
      if (!token) return;
      setResetToken(token);
      setAuthRoute("reset");
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Ping online toutes les 2 minutes
  useEffect(() => {
    if (!token) return;
    void client.pingOnline(token);
    const interval = setInterval(() => {
      void client.pingOnline(token);
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const refreshMessageBadge = useCallback(async () => {
    if (!token) {
      setMessageBadgeCount(0);
      return;
    }

    const conversations = await client.getConversations(token);
    setMessageBadgeCount(
      conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    );
  }, [token]);

  const pollIncomingCalls = useCallback(async () => {
    if (!token || activeCall || incomingCall) {
      return;
    }

    const calls = await client.getIncomingCalls(token);
    const firstCall = calls[0];
    if (firstCall) {
      setIncomingCall({
        id: firstCall.id,
        mode: firstCall.kind,
        direction: "incoming",
        peer: firstCall.peer,
        peerName: `${firstCall.peer.firstName} ${firstCall.peer.lastName}`.trim() || firstCall.peer.email,
      });
    }
  }, [activeCall, incomingCall, token]);

  useEffect(() => {
    if (!isAuthenticated || authRoute === "reset") {
      setIncomingCall(null);
      setActiveCall(null);
      setMessageBadgeCount(0);
      return;
    }

    void pollIncomingCalls().catch(() => undefined);
    void refreshMessageBadge().catch(() => undefined);
    const interval = setInterval(() => {
      void pollIncomingCalls().catch(() => undefined);
      void refreshMessageBadge().catch(() => undefined);
    }, 2500);
    return () => clearInterval(interval);
  }, [authRoute, isAuthenticated, pollIncomingCalls, refreshMessageBadge]);

  const startCall = (mode: CallMode, peer?: User, peerName?: string) => {
    setActiveCall({
      mode,
      direction: "outgoing",
      peer,
      peerName: peerName ?? "Contact",
    });
  };

  const renderAuth = () => {
    switch (authRoute) {
      case "onboarding":
        return <OnboardingScreen onGetStarted={() => setAuthRoute("login")} />;
      case "login":
        return (
          <LoginScreen
            initialEmail={lastRegisteredEmail}
            onLoginSuccess={() => {
              setSelectedPostId(null);
              setSelectedPostFocusComment(false);
              setShowCreatePost(false);
              setActiveTab("feed");
            }}
            onOpenRegister={() => setAuthRoute("register")}
            onOpenForgotPassword={() => setAuthRoute("forgot")}
          />
        );
      case "register":
        return (
          <RegisterScreen
            onRegistered={(email) => {
              setLastRegisteredEmail(email);
              setAuthRoute("login");
            }}
            onBackToLogin={() => setAuthRoute("login")}
          />
        );
      case "forgot":
        return <ForgotPasswordScreen onBackToLogin={() => setAuthRoute("login")} />;
      case "reset":
        return (
          <ResetPasswordScreen
            token={resetToken}
            onBackToLogin={() => setAuthRoute("login")}
            onResetSuccess={() => setAuthRoute("login")}
          />
        );
    }
  };

  const renderTab = () => {
    if (liveRoute?.role === "host") {
      if (IS_EXPO_GO) {
        return <LiveUnavailableScreen onClose={() => setLiveRoute(null)} />;
      }

      return (
        <Suspense fallback={<LiveLoadingState />}>
          <LazyLiveHostScreen
            onClose={() => {
              setLiveRoute(null);
              setActiveTab("feed");
            }}
          />
        </Suspense>
      );
    }

    if (liveRoute?.role === "viewer") {
      if (IS_EXPO_GO) {
        return <LiveUnavailableScreen onClose={() => setLiveRoute(null)} />;
      }

      return (
        <Suspense fallback={<LiveLoadingState />}>
          <LazyLiveViewerScreen liveSession={liveRoute.session} onClose={() => setLiveRoute(null)} />
        </Suspense>
      );
    }

    if (showCreatePost) {
      return (
        <CreatePostScreen
          onClose={() => setShowCreatePost(false)}
          onOpenLive={() => {
            setShowCreatePost(false);
            setSelectedPostId(null);
            setSelectedPostFocusComment(false);
            setLiveRoute({ role: "host" });
          }}
          onCreated={(createdType) => {
            setShowCreatePost(false);
            setSelectedPostId(null);
            setSelectedPostFocusComment(false);
            setActiveTab(createdType === "reel" ? "reels" : "feed");
          }}
        />
      );
    }

    if (selectedPostId) {
      return (
        <PostDetailScreen
          postId={selectedPostId}
          initialFocusComment={selectedPostFocusComment}
          onBack={() => {
            setSelectedPostId(null);
            setSelectedPostFocusComment(false);
          }}
        />
      );
    }

    if (viewingUserId) {
      return (
        <UserProfileScreen
          userId={viewingUserId}
          onBack={() => setViewingUserId(null)}
          onOpenPost={(postId) => {
            setSelectedPostFocusComment(false);
            setSelectedPostId(postId);
          }}
          onOpenProfile={(userId) => setViewingUserId(userId)}
        />
      );
    }

    switch (activeTab) {
      case "feed":
        return (
          <HomeFeedScreen
            onOpenPost={(postId) => {
              setSelectedPostFocusComment(false);
              setSelectedPostId(postId);
            }}
            onOpenComments={(postId) => {
              setSelectedPostFocusComment(true);
              setSelectedPostId(postId);
            }}
            onOpenLive={(session) => {
              setSelectedPostId(null);
              setSelectedPostFocusComment(false);
              setShowCreatePost(false);
              setLiveRoute({ role: "viewer", session });
            }}
            onOpenCreate={() => {
              setSelectedPostId(null);
              setSelectedPostFocusComment(false);
              setShowCreatePost(true);
            }}
            onOpenProfile={(userId: string) => setViewingUserId(userId)}
          />
        );

      case "search":
        return (
          <SearchScreen
            onOpenPost={(postId) => {
              setSelectedPostFocusComment(false);
              setSelectedPostId(postId);
            }}
          />
        );
      case "reels":
        return (
          <ReelsScreen
            onOpenPost={(postId) => {
              setSelectedPostFocusComment(false);
              setSelectedPostId(postId);
            }}
            onOpenProfile={(userId) => setViewingUserId(userId)}
          />
        );

      case "messages":
        return (
          <MessagesScreen
            onStartCall={startCall}
            onConversationRead={() => void refreshMessageBadge().catch(() => undefined)}
            onConversationStateChange={setMessagesDetailOpen}
          />
        );

      case "profile":
        if (showChangePassword) {
          return (
            <ChangePasswordScreen
              onBack={() => setShowChangePassword(false)}
            />
          );
        }
        if (followersState) {
          return (
            <FollowersScreen
              userId={followersState.userId}
              mode={followersState.mode}
              onBack={() => setFollowersState(null)}
              onOpenProfile={(uid) => {
                setFollowersState(null);
                setViewingUserId(uid);
              }}
            />
          );
        }
        if (showEditProfile) {
          return (
            <EditProfileScreen
              onBack={() => setShowEditProfile(false)}
              onSaved={() => setShowEditProfile(false)}
              onChangePassword={() => {
                setShowEditProfile(false);
                setShowChangePassword(true);
              }}
            />
          );
        }
        return (
          <ProfileScreen
            onOpenPost={(postId) => {
              setSelectedPostFocusComment(false);
              setSelectedPostId(postId);
            }}
            onEditProfile={() => setShowEditProfile(true)}
            onOpenFollowers={(uid) => setFollowersState({ userId: uid, mode: "followers" })}
            onOpenFollowing={(uid) => setFollowersState({ userId: uid, mode: "following" })}
          />
        );
    }
  };

  const changeTab = (tab: AppTab) => {
    setSelectedPostId(null);
    setSelectedPostFocusComment(false);
    setShowCreatePost(false);
    setShowEditProfile(false);
    setShowChangePassword(false);
    setViewingUserId(null);
    setFollowersState(null);
    setMessagesDetailOpen(false);
    setActiveTab(tab);
  };

  const isReelsRootScreen =
    activeTab === "reels" &&
    !viewingUserId &&
    !selectedPostId &&
    !showCreatePost &&
    !liveRoute &&
    !followersState &&
    !showEditProfile &&
    !showChangePassword;

  return (
    <View style={styles.safeArea}>
      <StatusBar
        barStyle={isReelsRootScreen ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />
      <LinearGradient colors={["#E8E2D8", "#F0EBE3"]} style={styles.container}>
        <View style={styles.device}>
          {showSplash ? (
            <View style={styles.splash}>
              <Image source={splashGif} style={styles.splashImage} />
            </View>
          ) : (
            <>
              {isLoading ? (
                <View style={[styles.screen, styles.loadingState]}>
                  <ActivityIndicator color={colors.burgundy} />
                </View>
              ) : isAuthenticated && authRoute !== "reset" ? (
                <View
                  style={[
                    styles.tabScreen,
                    activeTab === "messages" && messagesDetailOpen && styles.tabScreenFull,
                    isReelsRootScreen && styles.tabScreenFull,
                    isReelsRootScreen && styles.reelsTabScreen,
                    selectedPostId && styles.tabScreenFull,
                  ]}
                >
                  {renderTab()}
                </View>
              ) : (
                <ScrollView
                  style={styles.screen}
                  contentContainerStyle={styles.screenContent}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="always"
                  showsVerticalScrollIndicator={false}
                >
                  {renderAuth()}
                </ScrollView>
              )}

              {isAuthenticated &&
              authRoute !== "reset" &&
              !selectedPostId &&
              !showCreatePost &&
              !liveRoute &&
              !(activeTab === "messages" && messagesDetailOpen) ? (
                <TabBar
                  activeTab={activeTab}
                  onChange={changeTab}
                  messageBadgeCount={messageBadgeCount}
                />
              ) : null}
              {isAuthenticated && authRoute !== "reset" ? (
                <>
                  <Modal visible={Boolean(incomingCall)} animationType="fade">
                    {incomingCall ? (
                      <IncomingCallScreen
                        mode={incomingCall.mode}
                        peer={incomingCall.peer}
                        peerName={incomingCall.peerName}
                        onAccept={async () => {
                          setActiveCall(incomingCall);
                          setIncomingCall(null);
                        }}
                        onReject={async () => {
                          if (incomingCall.id && token) {
                            await client.rejectCall(incomingCall.id, token);
                          }
                          setIncomingCall(null);
                        }}
                      />
                    ) : null}
                  </Modal>
                  <Modal visible={Boolean(activeCall)} animationType="fade">
                    {activeCall ? (
                      <CallModalContent
                        activeCall={activeCall}
                        token={token}
                        onCallStarted={(callId) =>
                          setActiveCall((current) => current ? { ...current, id: callId } : current)
                        }
                        onEndCall={() => setActiveCall(null)}
                      />
                    ) : null}
                  </Modal>
                </>
              ) : null}
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function CallModalContent({
  activeCall,
  token,
  onCallStarted,
  onEndCall,
}: {
  activeCall: ActiveCall;
  token?: string | null;
  onCallStarted: (callId: string) => void;
  onEndCall: () => void;
}) {
  if (IS_EXPO_GO) {
    return <CallUnavailableScreen onClose={onEndCall} />;
  }

  return (
    <Suspense fallback={<LiveLoadingState />}>
      <LazyCallScreen
        mode={activeCall.mode}
        direction={activeCall.direction}
        token={token}
        callId={activeCall.id}
        peer={activeCall.peer}
        peerName={activeCall.peerName}
        onCallStarted={onCallStarted}
        onEndCall={onEndCall}
      />
    </Suspense>
  );
}

function CallUnavailableScreen({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.liveUnavailable}>
      <Text style={styles.liveUnavailableTitle}>Appels indisponibles dans Expo Go</Text>
      <Text style={styles.liveUnavailableText}>
        Les appels utilisent WebRTC natif. Utilise le dev build sur telephone reel pour tester
        l'audio/video.
      </Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.liveUnavailableButton}>
        <Text style={styles.liveUnavailableButtonText}>Retour</Text>
      </Pressable>
    </View>
  );
}

function extractResetToken(url: string | null): string | null {
  if (!url || !url.includes("reset-password")) return null;
  const match = url.match(/[?&]token=([^&#]+)/);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].replace(/\+/g, "%20"));
}

function LiveLoadingState() {
  return (
    <View style={[styles.screen, styles.loadingState]}>
      <ActivityIndicator color={colors.burgundy} />
      <Text style={styles.loadingText}>Chargement du live...</Text>
    </View>
  );
}

function LiveUnavailableScreen({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.liveUnavailable}>
      <Text style={styles.liveUnavailableTitle}>Live indisponible dans Expo Go</Text>
      <Text style={styles.liveUnavailableText}>
        Le streaming utilise WebRTC natif. Expo Go peut tester le feed, search, posts, reels et
        l'UI, mais pas le live video natif.
      </Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.liveUnavailableButton}>
        <Text style={styles.liveUnavailableButtonText}>Retour au feed</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E8E2D8",
  },
  container: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    padding: 0,
  },
  device: {
    position: "relative",
    flex: 1,
    width: "100%",
    minHeight: "100%",
    backgroundColor: colors.cream,
    borderRadius: 0,
    overflow: "hidden",
  },
  splash: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: {
    width: "86%",
    height: "86%",
    resizeMode: "contain",
  },
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.cream,
  },
  tabScreen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.cream,
    overflow: "hidden",
    paddingTop: APP_TOP_INSET,
    paddingBottom: 76,
  },
  tabScreenFull: {
    paddingBottom: 0,
  },
  reelsTabScreen: {
    paddingTop: 0,
    backgroundColor: colors.black,
  },
  screenContent: {
    flexGrow: 1,
    padding: 12,
    paddingTop: APP_TOP_INSET + 18,
    paddingBottom: 20,
  },
  loadingState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: colors.muted,
    fontWeight: "700",
  },
  liveUnavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
    backgroundColor: colors.cream,
  },
  liveUnavailableTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  liveUnavailableText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    textAlign: "center",
  },
  liveUnavailableButton: {
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.burgundy,
  },
  liveUnavailableButtonText: {
    color: colors.white,
    fontWeight: "900",
  },
});
