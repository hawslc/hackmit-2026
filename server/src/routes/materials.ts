// Materials endpoints (contract types in @ta-coach/shared):
//   POST /file     multipart field "file"  -> SourceFile
//   POST /concepts ExtractConceptsRequest  -> ExtractConceptsResponse

import { type ExtractConceptsResponse, type SourceFile, UPLOAD_LIMITS } from "@ta-coach/shared";
import express from "express";
import multer from "multer";
import { extractConcepts } from "ai-review";
import { extractFile } from "../extract/index.ts";
import { HttpError, llmErrorToHttp } from "../httpError.ts";
import { parseExtractConceptsRequest } from "../validation.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.maxBytes, files: 1 },
});

export const materialsRouter = express.Router();

materialsRouter.post("/file", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'No file uploaded (expected a form field named "file").');

  const { text, truncated } = await extractFile(file.originalname, file.buffer);
  const body: SourceFile = {
    name: file.originalname,
    text,
    size: file.size,
    ...(truncated ? { truncated: true } : {}),
  };
  res.json(body);
});

materialsRouter.post("/concepts", async (req, res) => {
  const { files } = parseExtractConceptsRequest(req.body);
  let concepts: ExtractConceptsResponse;
  try {
    concepts = await extractConcepts(files);
  } catch (err) {
    console.error("[server] concept extraction failed:", err);
    throw llmErrorToHttp(
      err,
      "Couldn't extract key ideas right now. Try again or add them yourself.",
      "Finding key ideas took too long. Try again.",
    );
  }
  res.json(concepts); // bare array is what the client expects
});
