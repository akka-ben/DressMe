export const routes = [
  "Onboarding",
  "Login",
  "Register",
  "ForgotPassword",
  "Feed",
  "PostDetail",
  "CreatePost",
  "Profile",
] as const;

export type AppRoute = (typeof routes)[number];
