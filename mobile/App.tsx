import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  SafeAreaView,
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
import { FeedScreen } from "./src/screens/FeedScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { MessagesScreen } from "./src/screens/MessagesScreen";
import { colors } from "./src/theme/dressme";

const splashGif = require("./assets/dressme-splash.gif");

type AuthRoute = "onboarding" | "login" | "register" | "forgot" | "reset";

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const [authRoute, setAuthRoute] = useState<AuthRoute>("onboarding");
  const [activeTab, setActiveTab] = useState<AppTab>("feed");
  const [lastRegisteredEmail, setLastRegisteredEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      const token = extractResetToken(url);
      if (!token) {
        return;
      }

      setResetToken(token);
      setAuthRoute("reset");
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    return () => subscription.remove();
  }, []);

  const renderAuth = () => {
    switch (authRoute) {
      case "onboarding":
        return <OnboardingScreen onGetStarted={() => setAuthRoute("login")} />;
      case "login":
        return (
          <LoginScreen
            initialEmail={lastRegisteredEmail}
            onLoginSuccess={() => setActiveTab("feed")}
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
    switch (activeTab) {
      case "feed":
        return <FeedScreen />;
      case "search":
        return <SearchScreen />;
      case "create":
        return <CreatePostScreen />;
      case "messages":
        return <MessagesScreen />;
      case "profile":
        return <ProfileScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={showSplash ? "light-content" : "dark-content"} hidden={showSplash} />
      <LinearGradient colors={["#E8E2D8", "#F0EBE3"]} style={styles.container}>
        <View style={styles.device}>
          {showSplash ? (
            <View style={styles.splash}>
              <Image source={splashGif} style={styles.splashImage} />
            </View>
          ) : (
            <>
              {isAuthenticated ? (
                <Text style={styles.logout} onPress={() => void logout()}>
                  Logout{user?.firstName ? ` · ${user.firstName}` : ""}
                </Text>
              ) : null}

              <ScrollView
                style={styles.screen}
                contentContainerStyle={styles.screenContent}
                showsVerticalScrollIndicator={false}
              >
                {isLoading ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator color={colors.burgundy} />
                  </View>
                ) : isAuthenticated && authRoute !== "reset" ? (
                  renderTab()
                ) : (
                  renderAuth()
                )}
              </ScrollView>

              {isAuthenticated && authRoute !== "reset" ? (
                <TabBar activeTab={activeTab} onChange={setActiveTab} />
              ) : null}
            </>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function extractResetToken(url: string | null): string | null {
  if (!url || !url.includes("reset-password")) {
    return null;
  }

  const match = url.match(/[?&]token=([^&#]+)/);
  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1].replace(/\+/g, "%20"));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E8E2D8",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  device: {
    width: "100%",
    height: "100%",
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
    backgroundColor: colors.cream,
  },
  screenContent: {
    padding: 12,
    paddingTop: 18,
    paddingBottom: 20,
  },
  logout: {
    position: "absolute",
    top: 14,
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
