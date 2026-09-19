// .txt / .md — decode as UTF-8, returned as-is (already markdown-friendly).

import { decodeBytes } from "./ooxml.ts";

export function extractPlain(bytes: Uint8Array): string {
  return decodeBytes(bytes);
}
