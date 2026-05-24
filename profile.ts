// Seeded "Mom" persona for the demo. The data foundation only — the API,
// rules engine, and check-in flow do not read from here yet. Lives at the app
// root via ProfileProvider so it survives tab switches and resets on refresh.

import type { CheckIn } from "@/types";

export interface Medication {
  id: string;
  name: string;
  dose: string;
  schedule: string;
  withFood: boolean;
  directions: string;
  commonSideEffects: string[];
  startedOn: string;
}

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  lastVisit: string;
}

export interface Profile {
  name: string;
  caregiverName: string;
  age: number;
  languages: string[];
  medications: Medication[];
  careTeam: CareTeamMember[];
  checkInHistory: CheckIn[];
}

const MEDICATIONS: Medication[] = [
  {
    id: "med-amlodipine-5",
    name: "Amlodipine",
    dose: "5 mg",
    schedule: "Once daily, morning",
    withFood: false,
    directions: "Take one tablet by mouth each morning at the same time.",
    commonSideEffects: [
      "dizziness",
      "lightheadedness",
      "ankle swelling",
      "flushing",
      "headache",
    ],
    startedOn: "2026-05-17",
  },
  {
    id: "med-metformin-500",
    name: "Metformin",
    dose: "500 mg",
    schedule: "Twice daily with meals",
    withFood: true,
    directions: "Take with breakfast and with dinner. Do not crush.",
    commonSideEffects: [
      "nausea",
      "loose stools",
      "stomach upset",
      "metallic taste",
    ],
    startedOn: "2024-08-22",
  },
  {
    id: "med-atorvastatin-20",
    name: "Atorvastatin",
    dose: "20 mg",
    schedule: "Once daily, evening",
    withFood: false,
    directions: "Take one tablet in the evening. Avoid grapefruit juice.",
    commonSideEffects: ["muscle aches", "joint pain", "mild headache"],
    startedOn: "2023-06-10",
  },
  {
    id: "med-vitamin-d3-1000",
    name: "Vitamin D3",
    dose: "1000 IU",
    schedule: "Once daily",
    withFood: true,
    directions: "Take with the largest meal of the day for absorption.",
    commonSideEffects: [],
    startedOn: "2020-03-15",
  },
];

const CARE_TEAM: CareTeamMember[] = [
  {
    id: "care-tanaka",
    name: "Dr. Aiko Tanaka",
    role: "Primary care physician",
    phone: "+1-626-555-0142",
    lastVisit: "2026-05-15",
  },
  {
    id: "care-yamamoto",
    name: "Dr. Kenji Yamamoto",
    role: "Cardiologist",
    phone: "+1-626-555-0188",
    lastVisit: "2026-05-10",
  },
  {
    id: "care-sato",
    name: "Hiroshi Sato, PharmD",
    role: "Pharmacist",
    phone: "+1-626-555-0117",
    lastVisit: "2026-05-17",
  },
];

// The five Amlodipine-onset check-ins (days 0–4). Day 3 and day 4 are the
// recent dizziness cluster — preserved verbatim so the existing demo path
// keeps producing the same signal it does today.
const AMLODIPINE_ONSET_CLUSTER: CheckIn[] = [
  {
    id: "seed-2026-05-17",
    timestamp: "2026-05-17T08:00:00Z",
    medContext: { name: "Amlodipine 5mg", dayOfChange: 0 },
    language: "ja",
    rawTranscript: "今朝、新しい薬を初めて飲みました。今のところ元気です。",
    translatedTranscript:
      "I took the new medicine for the first time this morning. So far I feel fine.",
    extracted: {
      medicationTaken: "yes",
      perceivedEffect: "same",
      symptoms: [],
      comprehensionFlag: false,
    },
    ambiguity: [],
  },
  {
    id: "seed-2026-05-18",
    timestamp: "2026-05-18T08:00:00Z",
    medContext: { name: "Amlodipine 5mg", dayOfChange: 1 },
    language: "ja",
    rawTranscript: "薬を飲みました。特に変わったことはありません。",
    translatedTranscript: "I took my medicine. Nothing in particular has changed.",
    extracted: {
      medicationTaken: "yes",
      perceivedEffect: "same",
      symptoms: [],
      comprehensionFlag: false,
    },
    ambiguity: [],
  },
  {
    id: "seed-2026-05-19",
    timestamp: "2026-05-19T08:00:00Z",
    medContext: { name: "Amlodipine 5mg", dayOfChange: 2 },
    language: "ja",
    rawTranscript: "薬は飲みました。膝がいつものように少し痛みます。",
    translatedTranscript: "I took my medicine. My knee aches a little, as usual.",
    extracted: {
      medicationTaken: "yes",
      perceivedEffect: "same",
      symptoms: [{ term: "knee pain", isNew: false }],
      comprehensionFlag: false,
    },
    ambiguity: [],
  },
  {
    id: "seed-2026-05-20",
    timestamp: "2026-05-20T08:00:00Z",
    medContext: { name: "Amlodipine 5mg", dayOfChange: 3 },
    language: "ja",
    rawTranscript: "薬は飲みましたが、少しふらふらします。",
    translatedTranscript: "I took my medicine, but I feel a little dizzy.",
    extracted: {
      medicationTaken: "yes",
      perceivedEffect: "worse",
      symptoms: [{ term: "dizziness", isNew: true }],
      comprehensionFlag: false,
    },
    ambiguity: [],
  },
  {
    id: "seed-2026-05-21",
    timestamp: "2026-05-21T08:00:00Z",
    medContext: { name: "Amlodipine 5mg", dayOfChange: 4 },
    language: "ja",
    rawTranscript: "薬を飲みました。まだ少しふらふらしています。",
    translatedTranscript: "I took my medicine. I still feel a little dizzy.",
    extracted: {
      medicationTaken: "yes",
      perceivedEffect: "worse",
      symptoms: [{ term: "dizziness", isNew: true }],
      comprehensionFlag: false,
    },
    ambiguity: [],
  },
];

// Build ~12 months of uneventful daily check-ins leading up to the Amlodipine
// onset, then append the onset cluster. medContext on the pre-onset days
// references Metformin (her most recent prior med change) so dayOfChange is
// well past the rules engine's 14-day window — these stay "fine" or "monitor"
// by design and exist as the steady backdrop the dizziness cluster stands out
// against. Generation is deterministic (template index by day count) so the
// demo is reproducible.
const PRE_ONSET_TEMPLATES: {
  ja: string;
  en: string;
  symptom?: { term: string; isNew: boolean };
  effect: CheckIn["extracted"]["perceivedEffect"];
}[] = [
  {
    ja: "薬を飲みました。元気です。",
    en: "I took my medicine. Feeling good.",
    effect: "same",
  },
  {
    ja: "今朝、薬を飲みました。いつも通りです。",
    en: "I took my medicine this morning. Same as usual.",
    effect: "same",
  },
  {
    ja: "薬を飲みました。特に変わったことはありません。",
    en: "I took my medicine. Nothing in particular has changed.",
    effect: "same",
  },
  {
    ja: "薬は飲みました。膝が少し痛みますが、いつものことです。",
    en: "I took my medicine. My knee aches a little, as usual.",
    symptom: { term: "knee pain", isNew: false },
    effect: "same",
  },
  {
    ja: "薬を飲みました。腰が少し硬いです。",
    en: "I took my medicine. My lower back feels a bit stiff.",
    symptom: { term: "lower-back stiffness", isNew: false },
    effect: "same",
  },
  {
    ja: "薬を飲みました。今日も元気にしています。",
    en: "I took my medicine. Feeling well today too.",
    effect: "better",
  },
  {
    ja: "薬を飲みました。花粉症で少し鼻が詰まっています。",
    en: "I took my medicine. My nose is a bit stuffy from hay fever.",
    symptom: { term: "hay-fever congestion", isNew: false },
    effect: "same",
  },
];

function buildPreOnsetHistory(): CheckIn[] {
  const out: CheckIn[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  // 12 months back from the day before Amlodipine starts.
  const start = Date.UTC(2025, 4, 17, 8, 0, 0); // 2025-05-17
  const end = Date.UTC(2026, 4, 16, 8, 0, 0); // 2026-05-16 (last pre-onset day)
  const metforminStartMs = Date.UTC(2024, 7, 22, 8, 0, 0); // 2024-08-22

  let i = 0;
  for (let t = start; t <= end; t += dayMs) {
    const tmpl = PRE_ONSET_TEMPLATES[i % PRE_ONSET_TEMPLATES.length];
    const date = new Date(t);
    const isoDay = date.toISOString().slice(0, 10);
    const dayOfChange = Math.floor((t - metforminStartMs) / dayMs);
    out.push({
      id: `history-${isoDay}`,
      timestamp: date.toISOString(),
      medContext: { name: "Metformin 500mg", dayOfChange },
      language: "ja",
      rawTranscript: tmpl.ja,
      translatedTranscript: tmpl.en,
      extracted: {
        medicationTaken: "yes",
        perceivedEffect: tmpl.effect,
        symptoms: tmpl.symptom ? [tmpl.symptom] : [],
        comprehensionFlag: false,
      },
      ambiguity: [],
    });
    i++;
  }
  return out;
}

export const SEED_MOM: Profile = {
  name: "Yuki Tanaka",
  caregiverName: "Angel",
  age: 74,
  languages: ["ja", "en"],
  medications: MEDICATIONS,
  careTeam: CARE_TEAM,
  checkInHistory: [...buildPreOnsetHistory(), ...AMLODIPINE_ONSET_CLUSTER],
};
