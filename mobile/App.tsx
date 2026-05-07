import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
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
import { colors, fonts } from "./src/theme/dressme";
import { EditProfileScreen } from "./src/screens/EditProfileScreen";
import { UserProfileScreen } from "./src/screens/UserProfileScreen";
import { FollowersScreen } from "./src/screens/FollowersScreen";
import { ChangePasswordScreen } from "./src/screens/ChangePasswordScreen";
import { client } from "./src/services";

const splashGif = require("./assets/dressme-splash.gif");
const AUTHENTICATED_TOP_SPACE = Platform.OS === "ios" ? 58 : StatusBar.currentHeight ?? 0;

type AuthRoute = "onboarding" | "login" | "register" | "forgot" | "reset";

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading, logout, user, token } = useAuth();
  const [authRoute, setAuthRoute] = useState<AuthRoute>("onboarding");
  const [activeTab, setActiveTab] = useState<AppTab>("feed");
  const [lastRegisteredEmail, setLastRegisteredEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [followersState, setFollowersState] = useState<{
    userId: string;
    mode: "followers" | "following";
  } | null>(null);

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
    if (showCreatePost) {
      return (
        <CreatePostScreen
          onClose={() => setShowCreatePost(false)}
          onCreated={(createdType) => {
            setShowCreatePost(false);
            setSelectedPostId(null);
            setActiveTab(createdType === "reel" ? "reels" : "feed");
          }}
        />
      );
    }

    if (selectedPostId) {
      return <PostDetailScreen postId={selectedPostId} onBack={() => setSelectedPostId(null)} />;
    }

    switch (activeTab) {
      case "feed":
        if (viewingUserId) {
          return (
            <UserProfileScreen
              userId={viewingUserId}
              onBack={() => setViewingUserId(null)}
              onOpenPost={setSelectedPostId}
            />
          );
        }
        return (
          <HomeFeedScreen
            onOpenPost={setSelectedPostId}
            onOpenProfile={(userId: string) => setViewingUserId(userId)}
          />
        );

      case "search":
        return <SearchScreen />;

      case "reels":
        return <ReelsScreen onOpenPost={setSelectedPostId} />;

      case "messages":
        return <MessagesScreen />;

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
            onOpenPost={setSelectedPostId}
            onEditProfile={() => setShowEditProfile(true)}
            onOpenFollowers={(uid) => setFollowersState({ userId: uid, mode: "followers" })}
            onOpenFollowing={(uid) => setFollowersState({ userId: uid, mode: "following" })}
          />
        );
    }
  };

  const changeTab = (tab: AppTab) => {
    setSelectedPostId(null);
    setShowCreatePost(false);
    setShowEditProfile(false);
    setShowChangePassword(false);
    setViewingUserId(null);
    setFollowersState(null);
    setActiveTab(tab);
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={["#E8E2D8", "#F0EBE3"]} style={styles.container}>
        <View style={styles.device}>
          {showSplash ? (
            <View style={styles.splash}>
              <Image source={splashGif} style={styles.splashImage} />
              <Text style={styles.splashLogo}>DressMe</Text>
            </View>
          ) : (
            <>
              {isAuthenticated && !showCreatePost ? (
                <Text style={styles.logout} onPress={() => void logout()}>
                  Logout{user?.firstName ? ` · ${user.firstName}` : ""}
                </Text>
              ) : null}

              {isLoading ? (
                <View style={[styles.screen, styles.loadingState]}>
                  <ActivityIndicator color={colors.burgundy} />
                </View>
              ) : isAuthenticated && authRoute !== "reset" ? (
                <View style={styles.tabScreen}>{renderTab()}</View>
              ) : (
                <ScrollView
                  style={styles.screen}
                  contentContainerStyle={styles.screenContent}
                  showsVerticalScrollIndicator={false}
                >
                  {renderAuth()}
                </ScrollView>
              )}

              {isAuthenticated && authRoute !== "reset" && !showCreatePost ? (
                <TabBar activeTab={activeTab} onChange={changeTab} />
              ) : null}
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function extractResetToken(url: string | null): string | null {
  if (!url || !url.includes("reset-password")) return null;
  const match = url.match(/[?&]token=([^&#]+)/);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].replace(/\+/g, "%20"));
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
    gap: 22,
  },
  splashImage: {
    width: 210,
    height: 210,
    resizeMode: "contain",
  },
  splashLogo: {
    fontFamily: fonts.display,
    color: colors.gold,
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: 1,
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
    paddingTop: AUTHENTICATED_TOP_SPACE,
    paddingBottom: 76,
  },
  screenContent: {
    flexGrow: 1,
    padding: 12,
    paddingTop: 18,
    paddingBottom: 20,
  },
  logout: {
    position: "absolute",
    top: AUTHENTICATED_TOP_SPACE + 10,
    right: 18,
    zIndex: 12,
    color: colors.burgundy,
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
  },
  loadingState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
});