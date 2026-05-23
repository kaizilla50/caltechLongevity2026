// POST /api/checkin
// Body: { transcript: string, language: string }
// Pipeline: analyzeTranscript (LLM extraction) → decide (deterministic rules).
// The LLM never sets `decision.level`; the rules engine does. See rules.ts.

import { analyzeTranscript } from "@/extract";
import { generateBrief } from "@/brief";
import { decide } from "@/rules";
import type { Baseline } from "@/types";
import baselineJson from "@/baseline.json";

const baseline = baselineJson as Baseline;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "request body must be valid JSON" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "request body must be a JSON object" },
      { status: 400 },
    );
  }
  const { transcript, language } = body as Record<string, unknown>;
  if (typeof transcript !== "string" || typeof language !== "string") {
    return Response.json(
      { error: "`transcript` and `language` must both be strings" },
      { status: 400 },
    );
  }

  try {
    const checkIn = await analyzeTranscript(transcript, language, baseline);
    const decision = decide(checkIn, baseline);
    const brief = await generateBrief(checkIn, decision, baseline);
    return Response.json({ checkIn, decision, brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
