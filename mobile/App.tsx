import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppTab, TabBar } from "./src/components/TabBar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { CreatePostScreen } from "./src/screens/CreatePostScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";

type AuthRoute = "onboarding" | "login" | "register" | "forgot";

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

  const renderAuth = () => {
    switch (authRoute) {
      case "onboarding":
        return <OnboardingScreen onGetStarted={() => setAuthRoute("login")} />;
      case "login":
        return (
          <LoginScreen
            onLoginSuccess={() => setActiveTab("feed")}
            onOpenRegister={() => setAuthRoute("register")}
            onOpenForgotPassword={() => setAuthRoute("forgot")}
          />
        );
      case "register":
        return (
          <RegisterScreen
            onRegistered={() => setAuthRoute("login")}
            onBackToLogin={() => setAuthRoute("login")}
          />
        );
      case "forgot":
        return <ForgotPasswordScreen onBackToLogin={() => setAuthRoute("login")} />;
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "feed":
        return <FeedScreen />;
      case "create":
        return <CreatePostScreen />;
      case "profile":
        return <ProfileScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.device}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>DressMe</Text>
              <Text style={styles.title}>
                {isAuthenticated ? `Welcome${user?.firstName ? `, ${user.firstName}` : ""}` : "Welcome"}
              </Text>
              <Text style={styles.subtitle}>
                {isAuthenticated
                  ? "Authenticated with the DressMe backend."
                  : "Use the onboarding and auth flow like a real mobile app."}
              </Text>
            </View>
            {isAuthenticated ? (
              <Text style={styles.badge} onPress={() => void logout()}>
                Logout
              </Text>
            ) : null}
          </View>

          <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.screenContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color="#8f4d32" />
              </View>
            ) : isAuthenticated ? (
              renderTab()
            ) : (
              renderAuth()
            )}
          </ScrollView>

          {isAuthenticated ? <TabBar activeTab={activeTab} onChange={setActiveTab} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#d9ccb9",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  device: {
    width: "100%",
    maxWidth: 430,
    height: "100%",
    maxHeight: 920,
    backgroundColor: "#f7f3ea",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#c9b9a6",
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfd5",
    backgroundColor: "#efe8dc",
  },
  eyebrow: {
    color: "#8f4d32",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f1a17",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5f554d",
  },
  badge: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#8f4d32",
    color: "#fffaf5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    fontWeight: "700",
    overflow: "hidden",
  },
  loadingState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
});
