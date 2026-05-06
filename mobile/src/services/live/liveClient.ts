import { API_URL } from "../api/apiClient";

export type LiveRole = "host" | "viewer";

export function buildLiveWebSocketUrl(liveId: string, token: string, role: LiveRole): string {
  const wsBaseUrl = API_URL.replace(/^http/i, "ws").replace(/\/$/, "");
  const params = new URLSearchParams({
    token,
    role,
  });
  return `${wsBaseUrl}/live/ws/${encodeURIComponent(liveId)}?${params.toString()}`;
}
