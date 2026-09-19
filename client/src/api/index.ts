// The one place that decides whether the client talks to the real server.
// Mock mode is on unless VITE_USE_MOCK_API is exactly "false".

import { materialsApi } from "./materials";
import { mockApi } from "./mock";
import { reviewApi } from "./review";
import type { Api } from "./types";

const httpApi: Api = { materials: materialsApi, review: reviewApi };

export const api: Api = import.meta.env.VITE_USE_MOCK_API === "false" ? httpApi : mockApi;
