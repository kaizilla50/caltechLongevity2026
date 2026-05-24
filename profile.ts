// Seeded "Mom" persona for the demo. The data foundation only — the API,
// rules engine, and check-in flow do not read from here yet. Lives at the app
// root via ProfileProvider so it survives tab switches and resets on refresh.

import type { CheckIn } from "@/types";

export interface Medication {
  id: string;
  name: string;
  dose: string;
  purpose: string;
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

export interface Appointment {
  id: string;
  role: string;
  doctorName: string;
  date: string;
}

export interface Recommendation {
  id: string;
  text: string;
  goal: string;
  date: string;
}

export interface Profile {
  name: string;
  caregiverName: string;
  age: number;
  languages: string[];
  medications: Medication[];
  careTeam: CareTeamMember[];
  appointments: Appointment[];
  recommendations: Recommendation[];
  checkInHistory: CheckIn[];
}

const MEDICATIONS: Medication[] = [
  {
    id: "med-amlodipine-5",
    name: "Amlodipine",
    dose: "5 mg",
    purpose: "Lowers blood pressure",
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
    id: "med-lisinopril-10",
    name: "Lisinopril",
    dose: "10 mg",
    purpose: "Lowers blood pressure (ACE inhibitor)",
    schedule: "Once daily, morning",
    withFood: false,
    directions:
      "Take one tablet by mouth each morning. Call the doctor if a persistent dry cough develops.",
    commonSideEffects: [
      "dry cough",
      "dizziness",
      "headache",
      "low blood pressure when standing",
    ],
    startedOn: "2025-11-15",
  },
  {
    id: "med-metformin-500",
    name: "Metformin",
    dose: "500 mg",
    purpose: "Manages blood sugar / type 2 diabetes",
    schedule: "Twice daily with meals",
    withFood: true,
    directions: "Take with breakfast and with dinner. Do not crush the tablet.",
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
    purpose: "Lowers cholesterol",
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
    purpose: "Bone and general health",
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

const APPOINTMENTS: Appointment[] = [
  {
    id: "appt-cardio-2026-05-26",
    role: "Cardiology follow-up",
    doctorName: "Dr. Kenji Yamamoto",
    date: "2026-05-26",
  },
  {
    id: "appt-gp-2026-05-15",
    role: "Annual physical",
    doctorName: "Dr. Aiko Tanaka",
    date: "2026-05-15",
  },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-protein-2026-05-03",
    text: "Add a small protein snack in the afternoon — Mom's energy dips after lunch and a handful of nuts or a hard-boiled egg should steady her through to dinner.",
    goal: "energy",
    date: "2026-05-03",
  },
  {
    id: "rec-back-stretch-2026-03-22",
    text: "Gentle 5-minute back stretch after sitting for more than an hour. It eases the lower-back stiffness that flares up on long-sitting days.",
    goal: "mobility",
    date: "2026-03-22",
  },
  {
    id: "rec-grapefruit-2025-08-10",
    text: "Skip grapefruit and grapefruit juice while taking Atorvastatin — it changes how the drug clears and can raise side-effect risk.",
    goal: "cholesterol",
    date: "2025-08-10",
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

// ─────────────────────────────────────────────────────────────────────────────
// 12 months of pre-Amlodipine history. Generated deterministically per UTC day
// so reloads are reproducible. Shape it for diversity — judges scanning the
// History page should see real ups and downs, not a wall of identical rows.
// Symptom strings deliberately match (or stay outside) baseline.knownSymptoms
// so the rules engine produces the intended verdict mix without re-implementing
// rule logic here.
// ─────────────────────────────────────────────────────────────────────────────

type EntryShape = {
  ja: string;
  en: string;
  symptoms?: { term: string; isNew: boolean }[];
  effect: CheckIn["extracted"]["perceivedEffect"];
  taken: CheckIn["extracted"]["medicationTaken"];
};

const FINE_DAYS: EntryShape[] = [
  {
    ja: "薬を飲みました。元気です。",
    en: "I took my medicine. Feeling good.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "今朝、薬を飲みました。いつも通りです。",
    en: "I took my medicine this morning. Same as usual.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。特に変わったことはありません。",
    en: "I took my medicine. Nothing in particular has changed.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。穏やかな一日です。",
    en: "I took my medicine. A calm day.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "朝食のあとに薬を飲みました。落ち着いています。",
    en: "I took my medicine after breakfast. Feeling settled.",
    effect: "same",
    taken: "yes",
  },
];

const GREAT_DAYS: EntryShape[] = [
  {
    ja: "薬を飲みました。今日はとても気分がいいです。",
    en: "I took my medicine. I feel really good today.",
    effect: "better",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。散歩がとても気持ちよかったです。",
    en: "I took my medicine. The walk this morning felt wonderful.",
    effect: "better",
    taken: "yes",
  },
];

const KNEE_DAYS: EntryShape[] = [
  {
    ja: "薬は飲みました。膝が少し痛みますが、いつものことです。",
    en: "I took my medicine. My knee aches a little, as usual.",
    symptoms: [{ term: "knee pain", isNew: false }],
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。庭仕事のあと、いつもの膝の痛みがあります。",
    en: "I took my medicine. The usual knee pain after gardening.",
    symptoms: [{ term: "knee pain", isNew: false }],
    effect: "same",
    taken: "yes",
  },
];

const BACK_DAYS: EntryShape[] = [
  {
    ja: "薬を飲みました。長く座っていたので腰が硬いです。",
    en: "I took my medicine. My lower back feels stiff from sitting too long.",
    symptoms: [{ term: "lower-back stiffness", isNew: false }],
    effect: "same",
    taken: "yes",
  },
];

const HAYFEVER_DAYS: EntryShape[] = [
  {
    ja: "薬を飲みました。花粉症で鼻が詰まっています。",
    en: "I took my medicine. My nose is stuffy from hay fever.",
    symptoms: [{ term: "hay-fever congestion", isNew: false }],
    effect: "same",
    taken: "yes",
  },
];

const TIRED_DAYS: EntryShape[] = [
  {
    ja: "薬を飲みました。今日も少し疲れています。",
    en: "I took my medicine. Feeling a bit tired again today.",
    symptoms: [{ term: "fatigue", isNew: true }],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。体がだるくて元気が出ません。",
    en: "I took my medicine. My body feels sluggish and I have no energy.",
    symptoms: [{ term: "low energy", isNew: true }],
    effect: "worse",
    taken: "yes",
  },
];

const COLD_DAYS: EntryShape[] = [
  {
    ja: "薬を飲みました。風邪をひいたみたいで、咳と鼻づまりがあります。",
    en: "I took my medicine. I think I caught a cold — I have a cough and a stuffy nose.",
    symptoms: [
      { term: "cough", isNew: true },
      { term: "hay-fever congestion", isNew: false },
    ],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。喉が痛いです。",
    en: "I took my medicine. My throat hurts.",
    symptoms: [{ term: "sore throat", isNew: true }],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。風邪気味で少し熱っぽいです。",
    en: "I took my medicine. I'm a bit feverish from the cold.",
    symptoms: [{ term: "feverish", isNew: true }],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。咳がまだ続いています。",
    en: "I took my medicine. The cough is still lingering.",
    symptoms: [{ term: "cough", isNew: true }],
    effect: "worse",
    taken: "yes",
  },
];

const COLD_MISSED_DOSE: EntryShape = {
  ja: "気分が悪くて今朝は薬を飲み忘れました。咳がひどいです。",
  en: "I didn't feel well and forgot my medicine this morning. The cough is bad.",
  symptoms: [{ term: "cough", isNew: true }],
  effect: "worse",
  taken: "no",
};

// Lisinopril onset (2025-11-15 to 2025-11-29). Days 0–1 quiet, days 2–7 ACE-
// inhibitor cough + headache (within 14-day med-change window → escalate),
// days 8–9 tapering (monitor — cough now isNew=false, still not in baseline),
// days 10–14 recovered. The cluster gives History 2–3 visible clay dots well
// before the recent Amlodipine cluster, so the recent escalation feels like
// part of a pattern rather than the first time the app has ever spoken up.
const LISINOPRIL_ONSET: EntryShape[] = [
  {
    ja: "今朝、新しい血圧の薬を初めて飲みました。",
    en: "I took the new blood pressure medicine for the first time this morning.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。今のところ大丈夫です。",
    en: "I took my medicine. So far so good.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。空咳が出始めました。",
    en: "I took my medicine. I've started having a dry cough.",
    symptoms: [{ term: "dry cough", isNew: true }],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。咳がまだ続いています。",
    en: "I took my medicine. The cough is still there.",
    symptoms: [{ term: "dry cough", isNew: true }],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。咳に加えて頭も痛いです。",
    en: "I took my medicine. The cough and now a headache too.",
    symptoms: [
      { term: "dry cough", isNew: true },
      { term: "headache", isNew: true },
    ],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。咳と頭痛が続いています。",
    en: "I took my medicine. Coughing and the headache continue.",
    symptoms: [
      { term: "dry cough", isNew: true },
      { term: "headache", isNew: true },
    ],
    effect: "worse",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。頭痛は少し良くなりましたが咳は残っています。",
    en: "I took my medicine. The headache is a bit better but the cough lingers.",
    symptoms: [{ term: "dry cough", isNew: true }],
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。咳だけ残っています。",
    en: "I took my medicine. Just the cough is hanging on.",
    symptoms: [{ term: "dry cough", isNew: true }],
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。咳が少し落ち着いてきました。",
    en: "I took my medicine. The cough is settling down.",
    symptoms: [{ term: "dry cough", isNew: false }],
    effect: "better",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。今日は咳が少ないです。",
    en: "I took my medicine. Less coughing today.",
    symptoms: [{ term: "dry cough", isNew: false }],
    effect: "better",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。咳もほとんど出ません。",
    en: "I took my medicine. The cough is mostly gone.",
    effect: "better",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。落ち着いてきました。",
    en: "I took my medicine. Things are settling down.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。普段通りです。",
    en: "I took my medicine. Back to normal.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。元気にしています。",
    en: "I took my medicine. Doing well.",
    effect: "same",
    taken: "yes",
  },
  {
    ja: "薬を飲みました。今日は気分がいいです。",
    en: "I took my medicine. Feeling good today.",
    effect: "better",
    taken: "yes",
  },
];

const SKIPPED_DAYS: EntryShape[] = [
  {
    ja: "今日は薬を飲み忘れました。特に変わったことはありません。",
    en: "I forgot my medicine today. Nothing in particular feels different.",
    effect: "same",
    taken: "no",
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// medContext for any day: whichever medication change is most recent. The
// rules engine reads `dayOfChange` to decide whether new symptoms fall inside
// its 14-day med-onset window. Once Lisinopril started, all check-ins after
// it (including the winter cold and the tired stretch) reference Lisinopril,
// not Metformin — that matches how a clinician would think about timing.
function medContextFor(t: number): { name: string; dayOfChange: number } {
  const lisinoStart = Date.UTC(2025, 10, 15, 8, 0, 0); // 2025-11-15
  const metStart = Date.UTC(2024, 7, 22, 8, 0, 0); // 2024-08-22
  if (t >= lisinoStart) {
    return {
      name: "Lisinopril 10mg",
      dayOfChange: Math.floor((t - lisinoStart) / DAY_MS),
    };
  }
  return {
    name: "Metformin 500mg",
    dayOfChange: Math.floor((t - metStart) / DAY_MS),
  };
}

function entryFor(t: number, idx: number): EntryShape {
  const date = new Date(t);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  // Lisinopril onset cluster — 2025-11-15 through 2025-11-29.
  if (y === 2025 && m === 10 && d >= 15 && d <= 29) {
    return LISINOPRIL_ONSET[d - 15];
  }

  // Winter cold — 2025-12-15 through 2026-01-05.
  const coldStart = Date.UTC(2025, 11, 15, 8, 0, 0);
  const coldEnd = Date.UTC(2026, 0, 5, 8, 0, 0);
  if (t >= coldStart && t <= coldEnd) {
    const dayIntoCold = Math.floor((t - coldStart) / DAY_MS);
    // One day mid-cold she felt too rough to take her pill — missed dose
    // alongside a new cough trips the missedDosePlusNewSymptom rule.
    if (dayIntoCold === 7) return COLD_MISSED_DOSE;
    return COLD_DAYS[dayIntoCold % COLD_DAYS.length];
  }

  // Tired / low-energy stretch — 2026-02-15 through 2026-02-28.
  if (y === 2026 && m === 1 && d >= 15 && d <= 28) {
    return TIRED_DAYS[(d - 15) % TIRED_DAYS.length];
  }

  // Hay-fever flare days — spread through April and early May.
  if (y === 2026 && m === 3 && (d === 4 || d === 11 || d === 18 || d === 25)) {
    return HAYFEVER_DAYS[0];
  }
  if (y === 2026 && m === 4 && (d === 2 || d === 9)) {
    return HAYFEVER_DAYS[0];
  }

  // Knee pain after gardening — scattered through spring and summer, with a
  // couple of off-season aches too.
  if (m >= 4 && m <= 9 && (d === 5 || d === 16 || d === 27)) {
    return KNEE_DAYS[idx % KNEE_DAYS.length];
  }
  if (y === 2025 && m === 9 && d === 12) return KNEE_DAYS[0];
  if (y === 2026 && m === 0 && d === 18) return KNEE_DAYS[0];

  // Lower-back stiffness — clusters in winter (more sitting).
  if (
    (m === 11 && (d === 8 || d === 19)) ||
    (m === 0 && d === 22) ||
    (m === 1 && d === 3) ||
    (m === 8 && d === 17)
  ) {
    return BACK_DAYS[0];
  }

  // Standout "feeling great" days — rare but worth a hollow dot with a smile.
  if (y === 2025 && m === 5 && d === 21) return GREAT_DAYS[0];
  if (y === 2025 && m === 8 && d === 16) return GREAT_DAYS[1];
  if (y === 2026 && m === 2 && d === 14) return GREAT_DAYS[0];
  if (y === 2026 && m === 3 && d === 7) return GREAT_DAYS[1];

  // Occasional missed dose (no other signal → monitor via ruleMissedDoseOnly).
  if (y === 2025 && m === 6 && d === 23) return SKIPPED_DAYS[0];
  if (y === 2026 && m === 2 && d === 8) return SKIPPED_DAYS[0];

  // Default — a fine, uneventful day. Rotates through the FINE_DAYS pool so
  // adjacent entries don't read identical when scanned in the History view.
  return FINE_DAYS[idx % FINE_DAYS.length];
}

function buildHistory(): CheckIn[] {
  const out: CheckIn[] = [];
  const start = Date.UTC(2025, 4, 17, 8, 0, 0); // 2025-05-17
  const end = Date.UTC(2026, 4, 16, 8, 0, 0); // 2026-05-16 (last pre-Amlodipine day)

  let idx = 0;
  for (let t = start; t <= end; t += DAY_MS) {
    const e = entryFor(t, idx);
    const date = new Date(t);
    const iso = date.toISOString().slice(0, 10);
    out.push({
      id: `history-${iso}`,
      timestamp: date.toISOString(),
      medContext: medContextFor(t),
      language: "ja",
      rawTranscript: e.ja,
      translatedTranscript: e.en,
      extracted: {
        medicationTaken: e.taken,
        perceivedEffect: e.effect,
        symptoms: e.symptoms ?? [],
        comprehensionFlag: false,
      },
      ambiguity: [],
    });
    idx++;
  }

  // Append the recent Amlodipine onset cluster verbatim.
  out.push(...AMLODIPINE_ONSET_CLUSTER);
  return out;
}

export const SEED_MOM: Profile = {
  name: "Yuki Tanaka",
  caregiverName: "Angel",
  age: 74,
  languages: ["ja", "en"],
  medications: MEDICATIONS,
  careTeam: CARE_TEAM,
  appointments: APPOINTMENTS,
  recommendations: RECOMMENDATIONS,
  checkInHistory: buildHistory(),
};
