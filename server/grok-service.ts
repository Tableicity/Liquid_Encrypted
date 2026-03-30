import OpenAI from "openai";

const GROK_ENABLED = process.env.GROK_API_KEY && process.env.GROK_API_KEY.length > 0;

const grokClient = GROK_ENABLED
  ? new OpenAI({
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1",
    })
  : null;

export interface DocumentAnalysis {
  classification: string;
  tags: string[];
  summary: string;
  keyEntities: string[];
  confidentialityLevel: string;
  language: string;
}

export async function analyzeDocument(
  fileName: string,
  fileContent: Buffer,
  mimeType: string
): Promise<DocumentAnalysis | null> {
  if (!grokClient) {
    console.log("[Grok] Service not enabled — skipping document analysis");
    return null;
  }

  try {
    const textContent = extractTextPreview(fileContent, mimeType);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await grokClient.chat.completions.create({
      model: "grok-3-mini",
      messages: [
        {
          role: "system",
          content: `You are a document intelligence analyst. Analyze the provided document and return a JSON object with these fields:
- "classification": One of: "financial", "legal", "technical", "medical", "personal", "corporate", "academic", "government", "correspondence", "other"
- "tags": Array of 3-6 relevant keyword tags (lowercase, no special characters)
- "summary": A 1-2 sentence summary of the document's purpose and content
- "keyEntities": Array of key names, organizations, dates, or amounts mentioned (up to 5)
- "confidentialityLevel": One of: "public", "internal", "confidential", "highly_confidential"
- "language": The primary language of the document (e.g., "english", "spanish")

Respond ONLY with valid JSON. No markdown, no explanation.`,
        },
        {
          role: "user",
          content: `Analyze this document:\nFilename: ${fileName}\nMIME Type: ${mimeType}\n\nContent preview:\n${textContent}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      console.error("[Grok] Empty response from API");
      return null;
    }

    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      classification: parsed.classification || "other",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
      summary: parsed.summary || "",
      keyEntities: Array.isArray(parsed.keyEntities) ? parsed.keyEntities.slice(0, 5) : [],
      confidentialityLevel: parsed.confidentialityLevel || "internal",
      language: parsed.language || "english",
    };
  } catch (error) {
    console.error("[Grok] Document analysis failed:", error);
    return null;
  }
}

function extractTextPreview(buffer: Buffer, mimeType: string): string {
  const maxChars = 3000;

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    return buffer.toString("utf-8").slice(0, maxChars);
  }

  if (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const text = buffer.toString("utf-8");
    const printable = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    return printable.slice(0, maxChars);
  }

  if (mimeType.startsWith("image/")) {
    return `[Binary image file: ${mimeType}]`;
  }

  const text = buffer.toString("utf-8");
  const printable = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  return printable.slice(0, maxChars) || `[Binary file: ${mimeType}]`;
}

export function isGrokEnabled(): boolean {
  return !!GROK_ENABLED;
}
