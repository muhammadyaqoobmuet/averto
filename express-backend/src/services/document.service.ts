import axios from "axios";
// pdf-parse v2 uses a different module structure than @types/pdf-parse (which targets v1).
// Using require() avoids the TypeScript "has no call signatures" false-positive.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buf: Buffer,
) => Promise<{ text: string }>;

/**
 * Downloads a remote file into a Buffer.
 * Hard-caps at 32 MB and 60 s — both reasonable for PDFs and text files.
 */
export async function downloadFile(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60_000,
    maxContentLength: 32 * 1024 * 1024,
  });
  return Buffer.from(response.data);
}

/**
 * Extracts plain text from a file buffer.
 *
 * Bug fix: the previous version imported `PDFParse` as a named class export.
 * `pdf-parse` actually exports a plain async function as its default export —
 * `new PDFParse(...)` throws `TypeError: PDFParse is not a constructor`.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");

  if (isPdf) {
    // Correct usage: call pdfParse(buffer) directly — it's a function, not a class.
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  // Plain text, markdown, CSV, etc.
  return buffer.toString("utf-8");
}

/**
 * Returns 'markdown' if the file is a Markdown file, 'text' otherwise.
 * Controls which text splitter is used during indexing.
 */
export function detectContentType(
  fileName: string,
  mimeType: string,
): "markdown" | "text" {
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    mimeType === "text/markdown"
  ) {
    return "markdown";
  }
  return "text";
}
