// LLM extraction layer. The model translates, extracts structured fields, and
// detects medical ambiguity. It NEVER decides urgency, escalation, or action —
// that is the rules engine's job (rules.ts). The strict JSON schema below is
// the type-system half of that boundary: the schema has no `level` field for
// the model to fill, so it cannot leak a decision even if instructed to.

import Anthropic from "@anthropic-ai/sdk";
import type { Baseline, CheckIn } from "@/types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a bilingual medication-response extraction assistant for an elder-care app.

Your ONLY responsibilities:
1. Translate the raw transcript faithfully to natural English.
2. Extract structured signals from the parent's words.
3. Flag medically ambiguous phrases that need a follow-up question.

You MUST NOT:
- Assess medical urgency, severity, risk, or whether the situation is concerning.
- Recommend any action, treatment, or contact with clinicians.
- Use words like "escalate", "urgent", "warning", "fine", or "monitor" anywhere in your output.
- Diagnose, advise, or interpret beyond what the parent literally said.

A separate deterministic rules engine handles every medical-urgency decision based on your extraction. Your role is faithful translation and extraction — nothing more.

Field guidance:
- translatedTranscript: a natural English translation of the parent's words. Preserve their voice; do not summarize, paraphrase, or add anything.
- extracted.medicationTaken: "yes" if the parent confirms taking the dose, "no" if they confirm skipping or forgetting it, "unsure" if the transcript is ambiguous.
- extracted.perceivedEffect: how the parent says they feel relative to before the medication change. "unsure" if ambiguous.
- extracted.symptoms: every symptom the parent mentions. For each, give a short English term and set isNew=false if it plausibly matches a symptom in baseline.knownSymptoms (e.g., "knee hurts" matches "occasional knee pain"); otherwise isNew=true.
- extracted.comprehensionFlag: true ONLY if the parent reveals a clear misunderstanding of what the medication is for or how to take it.
- ambiguity: for each medically ambiguous symptom phrase (e.g., Japanese ふらふら could mean dizzy / lightheaded / weak / faint), include one entry with the original-language phrase, a list of medically distinct interpretations (couldMean), and a precise follow-up question (followUp) that would disambiguate. Also include one entry whenever medicationTaken is "unsure".`;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    translatedTranscript: { type: "string" },
    extracted: {
      type: "object",
      properties: {
        medicationTaken: { type: "string", enum: ["yes", "no", "unsure"] },
        perceivedEffect: {
          type: "string",
          enum: ["better", "worse", "same", "unsure"],
        },
        symptoms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              term: { type: "string" },
              isNew: { type: "boolean" },
            },
            required: ["term", "isNew"],
            additionalProperties: false,
          },
        },
        comprehensionFlag: { type: "boolean" },
      },
      required: [
        "medicationTaken",
        "perceivedEffect",
        "symptoms",
        "comprehensionFlag",
      ],
      additionalProperties: false,
    },
    ambiguity: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phrase: { type: "string" },
          couldMean: { type: "array", items: { type: "string" } },
          followUp: { type: "string" },
        },
        required: ["phrase", "couldMean", "followUp"],
        additionalProperties: false,
      },
    },
  },
  required: ["translatedTranscript", "extracted", "ambiguity"],
  additionalProperties: false,
} as const;

// Pinned for the demo persona so every run shows the same dayOfChange — the
// rules engine's window check (≤ 14 days) must produce identical decisions
// regardless of when the demo is replayed. Compute from `startedOn` once we
// have more than one persona / a real clock to trust.
const DEMO_DAY_OF_CHANGE = 5;

export async function analyzeTranscript(
  rawTranscript: string,
  language: string,
  baseline: Baseline,
): Promise<CheckIn> {
  const currentMed = baseline.medications[0];
  if (!currentMed) {
    throw new Error("baseline has no medications — cannot construct medContext");
  }
  const dayOfChange = DEMO_DAY_OF_CHANGE;

  const userMessage = [
    `Raw transcript (language code: ${language}):`,
    `"""`,
    rawTranscript,
    `"""`,
    ``,
    `Parent's baseline.knownSymptoms (use this to set isNew on each extracted symptom):`,
    JSON.stringify(baseline.knownSymptoms, null, 2),
    ``,
    `Current medication context:`,
    `- name: ${currentMed.name}`,
    `- purpose: ${currentMed.purpose}`,
    `- day of change (days since they started this medication): ${dayOfChange}`,
    ``,
    `Return the structured extraction. Do not assess urgency.`,
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
    },
  });

  let json: string | undefined;
  for (const block of response.content) {
    if (block.type === "text") {
      json = block.text;
      break;
    }
  }
  if (!json) {
    throw new Error("extraction response contained no text block");
  }

  const parsed = JSON.parse(json) as {
    translatedTranscript: string;
    extracted: CheckIn["extracted"];
    ambiguity: CheckIn["ambiguity"];
  };

  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    medContext: { name: currentMed.name, dayOfChange },
    language,
    rawTranscript,
    translatedTranscript: parsed.translatedTranscript,
    extracted: parsed.extracted,
    ambiguity: parsed.ambiguity,
  };
}
