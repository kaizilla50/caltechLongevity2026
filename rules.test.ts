import { describe, it, expect } from "vitest";
import { decide } from "./rules";
import type { Baseline, CheckIn } from "./types";
import baselineJson from "./baseline.json";

const baseline = baselineJson as Baseline;

function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: "test-check-in",
    timestamp: "2026-05-22T10:00:00Z",
    medContext: { name: "Amlodipine 5mg", dayOfChange: 5 },
    language: "ja",
    rawTranscript: "",
    translatedTranscript: "",
    extracted: {
      medicationTaken: "yes",
      perceivedEffect: "same",
      symptoms: [],
      comprehensionFlag: false,
    },
    ambiguity: [],
    ...overrides,
  };
}

describe("escalation rules engine", () => {
  it("ESCALATE — new dizziness + skipped dose on day 5 of a new BP med", () => {
    const checkIn = makeCheckIn({
      rawTranscript: "今朝は薬を飲み忘れて、ちょっとふらふらします。",
      translatedTranscript:
        "I forgot to take my medicine this morning and I feel a bit dizzy.",
      extracted: {
        medicationTaken: "no",
        perceivedEffect: "worse",
        symptoms: [{ term: "dizziness", isNew: true }],
        comprehensionFlag: false,
      },
    });

    const decision = decide(checkIn, baseline);

    expect(decision.level).toBe("escalate");
    expect(decision.triggeredRules).toContain("newSymptomAfterMedChange");
    expect(decision.triggeredRules).toContain("missedDosePlusNewSymptom");
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  it("MONITOR — knee hurts after gardening, in baseline.knownSymptoms", () => {
    const checkIn = makeCheckIn({
      rawTranscript: "昨日庭仕事をしてから膝が少し痛いです。",
      translatedTranscript: "My knee hurts a little after gardening yesterday.",
      extracted: {
        medicationTaken: "yes",
        perceivedEffect: "same",
        symptoms: [{ term: "knee pain", isNew: false }],
        comprehensionFlag: false,
      },
    });

    const decision = decide(checkIn, baseline);

    expect(decision.level).toBe("monitor");
    expect(decision.triggeredRules).toEqual(["knownSymptomNoNewPattern"]);
    expect(decision.redFlags).toEqual([]);
  });

  it("MONITOR — missed dose only, otherwise fine", () => {
    const checkIn = makeCheckIn({
      rawTranscript: "今朝、薬を飲み忘れました。それ以外は元気です。",
      translatedTranscript:
        "I forgot to take my pill this morning. Otherwise I feel fine.",
      extracted: {
        medicationTaken: "no",
        perceivedEffect: "same",
        symptoms: [],
        comprehensionFlag: false,
      },
    });

    const decision = decide(checkIn, baseline);

    expect(decision.level).toBe("monitor");
    expect(decision.triggeredRules).toEqual(["missedDoseOnly"]);
    expect(decision.redFlags).toEqual([]);
  });

  it("SAFETY NET — empty/no-signal check-in lands on monitor without crashing", () => {
    const checkIn = makeCheckIn({
      rawTranscript: "",
      translatedTranscript: "",
    });

    expect(() => decide(checkIn, baseline)).not.toThrow();
    const decision = decide(checkIn, baseline);

    expect(decision.level).toBe("monitor");
    expect(decision.triggeredRules).toEqual(["defaultSafetyNet"]);
  });
});
