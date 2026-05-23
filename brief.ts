// LLM brief generation. The model writes prose ONLY. It receives the rules
// engine's decision.level as input and never decides, contradicts, or restates
// urgency itself. The JSON schema below contains NO `level` field — the type
// system half of the safety story holds even if the prompt fails: the model
// cannot emit a level even if it tried.

import Anthropic from "@anthropic-ai/sdk";
import type {
  Baseline,
  CaregiverBrief,
  CheckIn,
  EscalationDecision,
} from "@/types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are writing a one-page brief for an adult-child caregiver to take to their aging parent's next medical appointment.

A deterministic rules engine has ALREADY decided this check-in's urgency level (escalate / monitor / fine). You receive that level as input and write PROSE THAT REFLECTS IT.

You MUST NOT:
- Reinterpret, re-derive, or second-guess the level.
- Reassess urgency, severity, or risk yourself.
- Use the words "escalate", "monitor", or "fine" verbatim in your prose — speak as a person would.
- Diagnose, recommend stopping or changing medication, or give clinical assessment.

You MUST:
- Write in plain, warm, second-person English ("you") addressing the caregiver.
- Calibrate tone to the level: urgent-but-calm for escalate, watchful for monitor, reassuring for fine.
- Always defer the final call to a clinician in suggestedAction.

Field guidance:
- headline: ONE sentence, the bottom line of this check-in. Calibrated to the level. Plain language.
- whatChanged: 1-2 sentences in plain English. What's new or different in the parent's day today, relative to baseline. No medical jargon.
- whyItMatters: 1-2 sentences explaining why the caregiver should bring this up with the clinician (or, if the level is "fine", why they likely don't need to). Focus on the parent's well-being, not abstract pathophysiology.
- suggestedAction: ONE sentence. Concrete. Non-diagnostic. Always defers to a clinician (e.g., "Call the prescribing doctor's office today and ask about X" or "Bring this up at the next routine visit"). NEVER recommend stopping a medication, NEVER give a diagnosis, NEVER assess severity yourself.
- questionsForDoctor: 3-5 specific, answerable questions the caregiver can ask the doctor. Each one line, plain language. Make them actionable and specific to this check-in — not generic worries.`;

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    whatChanged: { type: "string" },
    whyItMatters: { type: "string" },
    suggestedAction: { type: "string" },
    questionsForDoctor: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "headline",
    "whatChanged",
    "whyItMatters",
    "suggestedAction",
    "questionsForDoctor",
  ],
  additionalProperties: false,
} as const;

export async function generateBrief(
  checkIn: CheckIn,
  decision: EscalationDecision,
  baseline: Baseline,
): Promise<CaregiverBrief> {
  const currentMed = baseline.medications[0];

  const lines: string[] = [];
  lines.push(
    `The deterministic rules engine has decided this check-in's level: ${decision.level.toUpperCase()}.`,
    `Do NOT change, re-derive, or contradict this level. Reflect it in tone and substance.`,
    ``,
    `Rules-engine reasons (already determined):`,
    ...decision.reasons.map((r) => `- ${r}`),
  );
  if (decision.redFlags.length > 0) {
    lines.push(``, `Red-flag terms detected: ${decision.redFlags.join(", ")}`);
  }
  lines.push(
    ``,
    `Triggered rules: ${decision.triggeredRules.join(", ") || "(none)"}`,
    ``,
    `Today's check-in:`,
    `- Original (${checkIn.language}): "${checkIn.rawTranscript}"`,
    `- English translation: "${checkIn.translatedTranscript}"`,
    ``,
    `Extracted signals from the parent's words:`,
    `- medicationTaken: ${checkIn.extracted.medicationTaken}`,
    `- perceivedEffect: ${checkIn.extracted.perceivedEffect}`,
    `- symptoms: ${JSON.stringify(checkIn.extracted.symptoms)}`,
    `- comprehensionFlag: ${checkIn.extracted.comprehensionFlag}`,
    ``,
    `Ambiguity flags raised by the extraction layer:`,
    checkIn.ambiguity.length > 0
      ? checkIn.ambiguity
          .map((a) => `- "${a.phrase}" could mean: ${a.couldMean.join(" / ")}`)
          .join("\n")
      : `(none)`,
    ``,
    `Medication context:`,
    `- name: ${currentMed?.name ?? "(no current medication on record)"}`,
    `- purpose: ${currentMed?.purpose ?? "(unknown)"}`,
    `- day of change (days since started): ${checkIn.medContext.dayOfChange}`,
    ``,
    `Parent's baseline known-symptoms (her usual aches — used to judge novelty):`,
    baseline.knownSymptoms.map((s) => `- ${s}`).join("\n"),
    ``,
    `Write the brief in the structured format. Calibrate tone to the level. Never restate the level word itself. Never diagnose. Always defer the final call to a clinician.`,
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: lines.join("\n") }],
    output_config: {
      format: { type: "json_schema", schema: BRIEF_SCHEMA },
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
    throw new Error("brief response contained no text block");
  }

  return JSON.parse(json) as CaregiverBrief;
}
