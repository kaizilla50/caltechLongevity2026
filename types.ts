export interface CheckIn {
  id: string;
  timestamp: string;
  medContext: {
    name: string;
    dayOfChange: number;
  };
  language: string;
  rawTranscript: string;
  translatedTranscript: string;
  extracted: {
    medicationTaken: "yes" | "no" | "unsure";
    perceivedEffect: "better" | "worse" | "same" | "unsure";
    symptoms: { term: string; isNew: boolean }[];
    comprehensionFlag: boolean;
  };
  ambiguity: { phrase: string; couldMean: string[]; followUp: string }[];
}

export interface Baseline {
  personId: string;
  knownSymptoms: string[];
  medications: { name: string; startedOn: string; purpose: string }[];
  recentCheckIns: CheckIn[];
}

// Produced ONLY by the deterministic rules engine. Never set from an LLM.
// The strict union on `level` is the type-system half of the safety story.
export interface EscalationDecision {
  level: "escalate" | "monitor" | "fine";
  reasons: string[];
  triggeredRules: string[];
  redFlags: string[];
}

// LLM-authored prose. Deliberately has no `level` field — the level lives on
// EscalationDecision and is never re-derived or restated by the model.
export interface CaregiverBrief {
  headline: string;
  whatChanged: string;
  whyItMatters: string;
  suggestedAction: string;
  questionsForDoctor: string[];
}
