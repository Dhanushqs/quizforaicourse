import { HttpError } from "./errors.js";

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel limits request bodies to ~4.5 MB

// Pulls the plain text out of an uploaded PDF or DOCX file.
export async function extractText(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw new HttpError(400, "The file is larger than 4 MB. Please upload a smaller file or paste the text instead.");
  }

  const name = String(file.name || "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (name.endsWith(".pdf")) {
      // We import the inner file on purpose: the package's main file tries to read a
      // test PDF when loaded, which breaks in Next.js.
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const result = await pdfParse(buffer);
      return result.text || "";
    }
    if (name.endsWith(".docx")) {
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }
  } catch (err) {
    console.error("Text extraction failed:", err);
    throw new HttpError(400, "Could not read that file. It may be damaged or password-protected.");
  }

  throw new HttpError(400, "Only .pdf and .docx files are supported.");
}
