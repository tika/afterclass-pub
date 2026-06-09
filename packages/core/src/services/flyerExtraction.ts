import { GoogleGenAI } from "@google/genai";
import type { ServiceContext } from "./context";

export interface ExtractedFlyerData {
  title: string;
  orgName: string;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  description: string | null;
  /** True only if this is a one-time event or recurring event on a fixed day. False for services, hotlines, ongoing resources. */
  isEvent: boolean;
}

const EXTRACTION_PROMPT = `Extract event details from this flyer/poster image. Return ONLY valid JSON, no markdown or extra text.

First, determine if this flyer promotes an EVENT we can add to a calendar:
- isEvent: true = one-time event (e.g., "Engineers Week Feb 22-28") OR recurring event on a fixed day (e.g., "Free math help every Thursday 6-8pm")
- isEvent: false = NOT an event: services, hotlines, ongoing resources (e.g., "Open 7 PM - 7 AM every night"), general promotions, contact info only, etc.

Output format:
{
  "isEvent": true or false,
  "title": "event title or main heading",
  "orgName": "organization or group name (e.g. 'Ears 4 Peers')",
  "startDate": "YYYY-MM-DD or null if not found",
  "startTime": "HH:MM or null if not found",
  "endTime": "HH:MM or null if not found",
  "locationName": "venue/building name or null if not found",
  "description": "brief description or null if not found"
}

If a field cannot be determined from the image, use null. Be conservative - only extract what is clearly visible.
For isEvent: when in doubt (e.g., no specific dates or recurring schedule), use false.`;

export async function extractFlyerData(
  ctx: ServiceContext,
  imageSource: string | Buffer,
  mimeType: string = "image/jpeg",
  groupNames?: string[],
): Promise<ExtractedFlyerData> {
  const apiKey = ctx.secrets.googleGenaiApiKey;
  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY is not configured");
  }

  let prompt = EXTRACTION_PROMPT;
  if (groupNames && groupNames.length > 0) {
    prompt += `\n\nHere is a list of known clubs/organizations. For the "orgName" field, if the organization on the flyer clearly matches one of these, use the EXACT name from this list. If none match well, use the name as it appears on the flyer.\n\nKnown organizations:\n${groupNames.join("\n")}`;
  }

  let base64Data: string;
  if (Buffer.isBuffer(imageSource)) {
    base64Data = imageSource.toString("base64");
  } else {
    const response = await fetch(imageSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    base64Data = Buffer.from(arrayBuffer).toString("base64");
  }

  const ai = new GoogleGenAI({ apiKey });

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
  });

  const text = result.text?.trim() ?? "";
  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  // Parse JSON - handle potential markdown code block wrapper
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1]?.trim() ?? text;
  }

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    orgName: typeof parsed.orgName === "string" ? parsed.orgName : "",
    startDate: typeof parsed.startDate === "string" ? parsed.startDate : null,
    startTime: typeof parsed.startTime === "string" ? parsed.startTime : null,
    endTime: typeof parsed.endTime === "string" ? parsed.endTime : null,
    locationName: typeof parsed.locationName === "string" ? parsed.locationName : null,
    description: typeof parsed.description === "string" ? parsed.description : null,
    isEvent: parsed.isEvent === true,
  };
}
