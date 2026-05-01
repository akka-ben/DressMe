import { ApiDressMeClient } from "./api/apiClient";
import { API_URL } from "./api/apiClient";
import type { DressMeClient } from "./types";

export const client: DressMeClient = new ApiDressMeClient(API_URL);
