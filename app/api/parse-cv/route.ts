import { NextRequest } from "next/server";
import { generateObject, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { CvParseResultSchema } from "@/lib/ai/types";
import {
  buildParseCvUserPrompt,
  PARSE_CV_PROMPT_VERSION,
  PARSE_CV_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/parse-cv";

/**
 * POST /api/parse-cv
 *
 * Accepts either:
 *   - application/json: { text: string }
 *   - multipart/form-data: file=<File>  (PDF or DOCX)
 *
 * Returns: { parsed: CvParseResult, meta: {...} }
 *
 * PDF/DOCX text is extracted server-side (pdf-parse / mammoth) before
 * being sent to Claude Haiku. Privacy: file bytes and extracted text
 * stay in memory only and are not persisted.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const PARSE_MODEL = "claude-haiku-4-5";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_LENGTH = 20000;
const MIN_TEXT_LENGTH = 50;

const TextBodySchema = z.object({
  text: z.string().min(MIN_TEXT_LENGTH).max(MAX_TEXT_LENGTH),
});

async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File is too large (${Math.round(file.size / 1024 / 1024)}MB). Max is ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
    );
  }

  const lowerName = file.name.toLowerCase();
  const isPdf =
    file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx");

  if (!isPdf && !isDocx) {
    throw new Error(
      "Unsupported file type. Upload a PDF or DOCX, or paste the text instead.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isPdf) {
    // pdf-parse v2 exposes a clean default export. (The old v1 inner-path
    // workaround is no longer needed — and v2 doesn't even export it.)
    const pdfModule = (await import("pdf-parse")) as unknown as {
      default: (buf: Buffer) => Promise<{ text: string }>;
    };
    const pdfParse = pdfModule.default;
    const result = await pdfParse(buffer);
    const text = (result.text ?? "").trim();
    if (text.length < MIN_TEXT_LENGTH) {
      throw new Error(
        "Couldn't read text from this PDF — it may be a scan or image-based. Try pasting the text instead.",
      );
    }
    return text.slice(0, MAX_TEXT_LENGTH);
  }

  // DOCX path
  const mammoth = (await import("mammoth")) as unknown as {
    extractRawText: (opts: {
      buffer: Buffer;
    }) => Promise<{ value: string; messages: unknown[] }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? "").trim();
  if (text.length < MIN_TEXT_LENGTH) {
    throw new Error(
      "Couldn't read text from this DOCX. Try pasting the text instead.",
    );
  }
  return text.slice(0, MAX_TEXT_LENGTH);
}

export async function POST(req: NextRequest) {
  let cvText: string;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json(
        { error: "invalid_form_data", message: "Could not read upload." },
        { status: 400 },
      );
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        {
          error: "missing_file",
          message: "Attach a PDF or DOCX in the 'file' field.",
        },
        { status: 400 },
      );
    }

    try {
      cvText = await extractTextFromFile(file);
    } catch (err) {
      console.error("[/api/parse-cv] file extract error:", err);
      return Response.json(
        {
          error: "extract_failed",
          message:
            err instanceof Error
              ? err.message
              : "Couldn't extract text from the file.",
        },
        { status: 400 },
      );
    }
  } else {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json(
        { error: "invalid_json", message: "Body must be valid JSON" },
        { status: 400 },
      );
    }

    const parseInput = TextBodySchema.safeParse(raw);
    if (!parseInput.success) {
      return Response.json(
        {
          error: "validation_failed",
          details: parseInput.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    cvText = parseInput.data.text;
  }

  const t0 = Date.now();

  try {
    const result = await generateObject({
      model: anthropic(PARSE_MODEL),
      schema: CvParseResultSchema,
      system: PARSE_CV_SYSTEM_PROMPT,
      prompt: buildParseCvUserPrompt(cvText),
      temperature: 0.2,
      maxOutputTokens: 3000,
    });

    return Response.json({
      parsed: result.object,
      meta: {
        model: PARSE_MODEL,
        promptVersion: PARSE_CV_PROMPT_VERSION,
        inputCharCount: cvText.length,
        tokens: {
          input: result.usage?.inputTokens ?? null,
          output: result.usage?.outputTokens ?? null,
        },
        elapsedMs: Date.now() - t0,
      },
    });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("[/api/parse-cv] NoObjectGeneratedError");
      console.error("  cause:", err.cause);
      console.error("  raw text (truncated):", err.text?.slice(0, 1000));
      return Response.json(
        {
          error: "parse_failed",
          message:
            "Couldn't extract a clean profile from this CV. Try the manual form instead.",
        },
        { status: 502 },
      );
    }
    console.error("[/api/parse-cv] error:", err);
    return Response.json(
      {
        error: "parse_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
