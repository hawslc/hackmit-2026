import type { Api } from "../types";
import { mockMaterialsApi } from "./materials";
import { mockReviewApi } from "./review";

export const mockApi: Api = { materials: mockMaterialsApi, review: mockReviewApi };
