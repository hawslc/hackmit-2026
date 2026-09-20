// The client always talks to the real server (Vite proxies /api to it in dev).
// Materials upload + concept extraction and the session review all go over HTTP.

import { materialsApi } from "./materials";
import { reviewApi } from "./review";
import type { Api } from "./types";

export const api: Api = { materials: materialsApi, review: reviewApi };
