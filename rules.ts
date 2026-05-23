// Deterministic escalation rules. The `level` field on EscalationDecision is
// computed here and ONLY here. LLMs never call into this file; this file never
// calls an LLM. Each rule is a small, named, commented function so the safety
// story is auditable line by line (we read these aloud at the demo).

import type { Baseline, CheckIn, EscalationDecision } from "./types";

// Hard red-flag terms — substring-matched (lowercase) against both the extracted
// symptom terms and the translated transcript. Belt-and-suspenders: the rule
// still fires if LLM extraction missed a phrase the parent literally said.
const RED_FLAG_TERMS = [
  "chest pain",
  "fainting",
  "fainted",
  "passed out",
  "difficulty breathing",
  "shortness of breath",
  "can't breathe",
  "slurred speech",
  "facial droop",
  "sudden weakness",
  "severe headache",
];

// "Within N days of a med change" — N. Wide enough to catch delayed adverse
// effects on a BP starter regimen; narrow enough to time-bound the watch.
const MED_CHANGE_WINDOW_DAYS = 14;

type RuleHit = {
  level: "escalate" | "monitor" | "fine";
  ruleName: string;
  reason: string;
  redFlags?: string[];
};

function isInBaseline(term: string, baseline: Baseline): boolean {
  const t = term.toLowerCase().trim();
  return baseline.knownSymptoms.some(k => {
    const known = k.toLowerCase().trim();
    return known.includes(t) || t.includes(known);
  });
}

// Rule 1 — Hard red-flag term → escalate.
// These symptoms warrant same-day clinician contact regardless of baseline or
// med context. Highest priority; checked first.
export function ruleRedFlag(checkIn: CheckIn, _baseline: Baseline): RuleHit | null {
  const haystacks: string[] = [
    checkIn.translatedTranscript.toLowerCase(),
    ...checkIn.extracted.symptoms.map(s => s.term.toLowerCase()),
  ];
  const hits = RED_FLAG_TERMS.filter(term => haystacks.some(h => h.includes(term)));
  if (hits.length === 0) return null;
  return {
    level: "escalate",
    ruleName: "redFlag",
    reason: `Hard red-flag term detected: ${hits.join(", ")}`,
    redFlags: hits,
  };
}

// Rule 2 — New symptom not in baseline + within N days of a med change → escalate.
// Temporal coincidence is the signal: an unfamiliar symptom appearing during the
// drug-onset window is treated as drug-related until a clinician says otherwise.
export function ruleNewSymptomAfterMedChange(
  checkIn: CheckIn,
  baseline: Baseline,
): RuleHit | null {
  if (checkIn.medContext.dayOfChange > MED_CHANGE_WINDOW_DAYS) return null;
  const novel = checkIn.extracted.symptoms.filter(
    s => s.isNew && !isInBaseline(s.term, baseline),
  );
  if (novel.length === 0) return null;
  return {
    level: "escalate",
    ruleName: "newSymptomAfterMedChange",
    reason:
      `New symptom(s) within ${MED_CHANGE_WINDOW_DAYS} days of starting ` +
      `${checkIn.medContext.name} (day ${checkIn.medContext.dayOfChange}): ` +
      novel.map(s => s.term).join(", "),
  };
}

// Rule 3 — Missed dose + any new symptom → escalate.
// Two failure modes overlap: the parent isn't getting the drug AND something
// has changed. Either alone is softer; together it warrants a clinician call.
export function ruleMissedDosePlusNewSymptom(
  checkIn: CheckIn,
  _baseline: Baseline,
): RuleHit | null {
  // "unsure" deliberately does NOT trigger this rule — only confirmed "no".
  // TODO: route "unsure" to an ambiguity follow-up question in the LLM layer.
  if (checkIn.extracted.medicationTaken !== "no") return null;
  const newSymptoms = checkIn.extracted.symptoms.filter(s => s.isNew);
  if (newSymptoms.length === 0) return null;
  return {
    level: "escalate",
    ruleName: "missedDosePlusNewSymptom",
    reason: `Missed dose alongside new symptom(s): ${newSymptoms.map(s => s.term).join(", ")}`,
  };
}

// Rule 4 — Comprehension flag true → escalate.
// If the parent misunderstands what the medication is for, self-management is
// unsafe by definition; the caregiver needs to step in immediately.
export function ruleComprehensionFlag(
  checkIn: CheckIn,
  _baseline: Baseline,
): RuleHit | null {
  if (!checkIn.extracted.comprehensionFlag) return null;
  return {
    level: "escalate",
    ruleName: "comprehensionFlag",
    reason: "Parent appears to misunderstand the medication's purpose or instructions.",
  };
}

// Rule 5 — All reported symptoms are in baseline.knownSymptoms and none is new → monitor.
// Familiar territory. Surface to the caregiver but don't alarm them.
export function ruleKnownSymptomNoNewPattern(
  checkIn: CheckIn,
  baseline: Baseline,
): RuleHit | null {
  const sx = checkIn.extracted.symptoms;
  if (sx.length === 0) return null;
  const anyNovel = sx.some(s => s.isNew || !isInBaseline(s.term, baseline));
  if (anyNovel) return null;
  return {
    level: "monitor",
    ruleName: "knownSymptomNoNewPattern",
    reason:
      "All reported symptoms are in baseline.knownSymptoms with no new pattern: " +
      sx.map(s => s.term).join(", "),
  };
}

// Rule 6 — Nothing new → fine.
// Requires positive evidence of a real check-in (non-empty transcript) AND no
// negative signals. An empty transcript is not "fine" — it's no information,
// which lands on the safety net (surface-don't-dismiss).
export function ruleNothingNew(
  checkIn: CheckIn,
  _baseline: Baseline,
): RuleHit | null {
  if (!checkIn.translatedTranscript.trim()) return null;
  if (checkIn.extracted.symptoms.length > 0) return null;
  if (checkIn.extracted.medicationTaken === "no") return null;
  if (checkIn.extracted.comprehensionFlag) return null;
  return {
    level: "fine",
    ruleName: "nothingNew",
    reason: "No new symptoms, no missed doses, no comprehension issues.",
  };
}

// Rule 7 — Uncovered new symptom → monitor.
// Catches the residual case: a symptom that is new or not in baseline but
// wasn't promoted to escalate (e.g., outside the med-change window, no missed
// dose, no comprehension flag). Uncovered new symptoms surface to the
// caregiver rather than silently passing through.
export function ruleUnmatchedNewSymptom(
  checkIn: CheckIn,
  baseline: Baseline,
): RuleHit | null {
  const novel = checkIn.extracted.symptoms.filter(
    s => s.isNew || !isInBaseline(s.term, baseline),
  );
  if (novel.length === 0) return null;
  return {
    level: "monitor",
    ruleName: "unmatchedNewSymptom",
    reason:
      "New or unfamiliar symptom(s) not covered by other rules — surfacing " +
      `for caregiver review: ${novel.map(s => s.term).join(", ")}`,
  };
}

// Rule 8 — Missed dose alone → monitor.
// Confirmed forgotten pill with no symptoms and no comprehension issue. A
// forgotten dose still deserves to surface to the caregiver, but on its own
// it isn't an escalation.
export function ruleMissedDoseOnly(
  checkIn: CheckIn,
  _baseline: Baseline,
): RuleHit | null {
  if (checkIn.extracted.medicationTaken !== "no") return null;
  if (checkIn.extracted.symptoms.length > 0) return null;
  if (checkIn.extracted.comprehensionFlag) return null;
  return {
    level: "monitor",
    ruleName: "missedDoseOnly",
    reason: `Confirmed missed dose of ${checkIn.medContext.name}, no other signals reported.`,
  };
}

// Rule 9 — Default safety net → monitor.
// Terminal rule: always returns a hit. Any check-in not matched by a prior
// rule surfaces for human review by default (surface-don't-dismiss). Loud in
// dev (console.warn) so we notice and add a targeted rule; never throws, so
// a realistic check-in cannot crash the app live.
export function ruleDefaultSafetyNet(
  checkIn: CheckIn,
  _baseline: Baseline,
): RuleHit {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[rules] safety net triggered for checkIn ${checkIn.id} — ` +
        `consider adding a targeted rule. ` +
        `medicationTaken=${checkIn.extracted.medicationTaken}, ` +
        `symptoms=${checkIn.extracted.symptoms.length}, ` +
        `comprehensionFlag=${checkIn.extracted.comprehensionFlag}, ` +
        `transcript=${JSON.stringify(checkIn.translatedTranscript)}`,
    );
  }
  return {
    level: "monitor",
    ruleName: "defaultSafetyNet",
    reason: "No prior rule matched; defaulting to monitor for human review.",
  };
}

// Priority order. Every escalate-tier rule that hits is recorded for the audit
// trail. Monitor and fine act as fallbacks, checked only if no escalation fired.
// ruleDefaultSafetyNet is terminal and lives outside the loop because its
// return type guarantees a hit.
const ESCALATE_RULES = [
  ruleRedFlag,
  ruleNewSymptomAfterMedChange,
  ruleMissedDosePlusNewSymptom,
  ruleComprehensionFlag,
];
const FALLBACK_RULES = [
  ruleKnownSymptomNoNewPattern,
  ruleUnmatchedNewSymptom,
  ruleMissedDoseOnly,
  ruleNothingNew,
];

export function decide(checkIn: CheckIn, baseline: Baseline): EscalationDecision {
  const reasons: string[] = [];
  const triggeredRules: string[] = [];
  const redFlags: string[] = [];

  for (const rule of ESCALATE_RULES) {
    const hit = rule(checkIn, baseline);
    if (!hit) continue;
    reasons.push(hit.reason);
    triggeredRules.push(hit.ruleName);
    if (hit.redFlags) redFlags.push(...hit.redFlags);
  }
  if (triggeredRules.length > 0) {
    return { level: "escalate", reasons, triggeredRules, redFlags };
  }

  for (const rule of FALLBACK_RULES) {
    const hit = rule(checkIn, baseline);
    if (!hit) continue;
    return {
      level: hit.level,
      reasons: [hit.reason],
      triggeredRules: [hit.ruleName],
      redFlags: [],
    };
  }

  const safety = ruleDefaultSafetyNet(checkIn, baseline);
  return {
    level: safety.level,
    reasons: [safety.reason],
    triggeredRules: [safety.ruleName],
    redFlags: [],
  };
}
