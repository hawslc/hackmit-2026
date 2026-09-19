// Materials endpoints, honoring the live client contract exactly
// (client/src/api/materials.ts):
//   POST /file     multipart field "file"  -> SourceFile { name, text, size, truncated? }
//   POST /concepts JSON { files: SourceFile[] } -> bare array { name, source?, importance? }[]

import express from "express";
import multer from "multer";
import { extractConcepts, type MaterialFile } from "ai-review";
import { extractFile } from "../extract/index.ts";
import { HttpError } from "../httpError.ts";
import { LIMITS } from "../limits.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.maxBytes, files: 1 },
});

export const materialsRouter = express.Router();

materialsRouter.post("/file", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'No file uploaded (expected a form field named "file").');

  const { text, truncated } = await extractFile(file.originalname, file.buffer);
  res.json({
    name: file.originalname,
    text,
    size: file.size,
    ...(truncated ? { truncated: true } : {}),
  });
});

interface ConceptsBody {
  files?: { name?: string; text?: string }[];
}

materialsRouter.post("/concepts", async (req, res) => {
  const { files } = (req.body ?? {}) as ConceptsBody;
  if (!Array.isArray(files) || files.length === 0) {
    throw new HttpError(400, "Send { files: SourceFile[] } with at least one file.");
  }

  const materialFiles: MaterialFile[] = files.map((f) => ({
    name: String(f?.name ?? "file"),
    text: String(f?.text ?? ""),
  }));

  const concepts = await extractConcepts(materialFiles);
  res.json(concepts); // bare array is what the client expects
});
