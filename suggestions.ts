// Deterministic "Today, you might check on…" rules over the profile. No LLM,
// no freeform chat. Each rule reads useProfile()-shaped data and returns at
// most one Suggestion or null. generateSuggestions() runs the rules and
// returns the top 3–4 cards to surface above the check-in controls.
//
// `now` is injectable so tests stay deterministic. UTC-day math throughout
// (matching the seeded timestamps) avoids viewer-timezone surprises.

import type { Profile } from "./profile";

export interface Suggestion {
  id: string;
  text: string;
  source: string;
  prefill: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MED_RECENT_WINDOW = 14; // days
const SYMPTOM_LOOKBACK = 3; // days
const APPT_LOOKAHEAD = 3; // days
const REC_OLDER_THAN = 14; // days

export function generateSuggestions(
  profile: Profile,
  now: Date = new Date(),
): Suggestion[] {
  const todayKey = utcDayKey(now);
  const out: Suggestion[] = [];

  const med = ruleMedStartedRecently(profile, todayKey);
  if (med) out.push(med);

  const sym = ruleRecentSymptom(profile, todayKey);
  if (sym) out.push(sym);

  const appt = ruleUpcomingAppointment(profile, todayKey);
  if (appt) out.push(appt);

  const rec = ruleOlderRecommendation(profile, todayKey);
  if (rec) out.push(rec);

  return out.slice(0, 4);
}

// Rule 1 — A medication was started in the last 14 days. Pick the most
// recently started qualifying med so a brand-new addition wins over a
// 10-day-old one.
function ruleMedStartedRecently(
  profile: Profile,
  todayKey: string,
): Suggestion | null {
  let best: { name: string; id: string; days: number } | null = null;
  for (const med of profile.medications) {
    const days = daysBetween(todayKey, med.startedOn);
    if (days < 0 || days > MED_RECENT_WINDOW) continue;
    if (!best || days < best.days) {
      best = { name: med.name, id: med.id, days };
    }
  }
  if (!best) return null;
  const ago =
    best.days === 0
      ? "today"
      : `${best.days} day${best.days === 1 ? "" : "s"} ago`;
  const prefill =
    best.days === 0
      ? `Mom just started ${best.name} this morning and says she feels fine so far.`
      : `Mom's been on ${best.name} for ${best.days} day${best.days === 1 ? "" : "s"} now and says it's been okay so far.`;
  return {
    id: `sug-med-${best.id}`,
    source: "medStartedRecently",
    text: `Mom started ${best.name} ${ago} — is it helping, hurting, or about the same?`,
    prefill,
  };
}

// Rule 2 — A symptom showed up in the last 3 days of check-in history. Walk
// newest → oldest and stop at the first qualifying check-in so we surface the
// freshest symptom rather than the worst one in the window.
function ruleRecentSymptom(
  profile: Profile,
  todayKey: string,
): Suggestion | null {
  for (let i = profile.checkInHistory.length - 1; i >= 0; i--) {
    const ci = profile.checkInHistory[i];
    const ciKey = ci.timestamp.slice(0, 10);
    const days = daysBetween(todayKey, ciKey);
    if (days > SYMPTOM_LOOKBACK) break; // history is chronological; older entries can't qualify
    if (days < 0) continue;
    if (ci.extracted.symptoms.length === 0) continue;
    const sym = ci.extracted.symptoms[0].term;
    const when =
      days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
    return {
      id: `sug-sym-${ci.id}`,
      source: "recentSymptom",
      text: `She mentioned ${sym} ${when} — is she still feeling it?`,
      prefill: `Mom says the ${sym} is still bothering her today.`,
    };
  }
  return null;
}

// Rule 3 — An appointment is within the next 3 days. Pick the soonest.
function ruleUpcomingAppointment(
  profile: Profile,
  todayKey: string,
): Suggestion | null {
  let best: { id: string; role: string; doctorName: string; days: number } | null = null;
  for (const a of profile.appointments) {
    const days = daysBetween(a.date, todayKey);
    if (days < 0 || days > APPT_LOOKAHEAD) continue;
    if (!best || days < best.days) {
      best = { id: a.id, role: a.role, doctorName: a.doctorName, days };
    }
  }
  if (!best) return null;
  const inN =
    best.days === 0
      ? "today"
      : best.days === 1
        ? "tomorrow"
        : `in ${best.days} days`;
  return {
    id: `sug-appt-${best.id}`,
    source: "upcomingAppointment",
    text: `Her ${lcFirst(best.role)} visit with ${best.doctorName} is ${inN} — want to note what to raise?`,
    prefill: `Mom has a ${lcFirst(best.role)} with ${best.doctorName} coming up — she's been doing well overall.`,
  };
}

// Rule 4 — A recommendation is older than 2 weeks. Pick the most recently
// dated qualifying recommendation so the freshest "did this work?" check
// surfaces first (older suggestions get drowned out).
function ruleOlderRecommendation(
  profile: Profile,
  todayKey: string,
): Suggestion | null {
  let best: { id: string; text: string; goal: string; days: number } | null = null;
  for (const r of profile.recommendations) {
    const days = daysBetween(todayKey, r.date);
    if (days < REC_OLDER_THAN) continue;
    if (!best || days < best.days) {
      best = { id: r.id, text: r.text, goal: r.goal, days };
    }
  }
  if (!best) return null;
  const weeks = Math.round(best.days / 7);
  const head = firstClause(best.text);
  const prefill =
    RECOMMENDATION_PREFILLS[best.goal] ??
    `Mom says her ${best.goal} has been better lately.`;
  return {
    id: `sug-rec-${best.id}`,
    source: "olderRecommendation",
    text: `${weeks} weeks ago you tried "${head}" for ${best.goal} — has it helped?`,
    prefill,
  };
}

// Hand-crafted observation lines per recommendation goal. Each reads like
// something a caregiver would naturally type — no "checking in on the X
// suggestion" meta-phrasing that the LLM extractor would treat as the
// patient's own words. Falls back to a generic line for unknown goals.
const RECOMMENDATION_PREFILLS: Record<string, string> = {
  energy:
    "Mom says her energy has been better in the afternoons since adding the protein snack.",
  mobility:
    "Mom says her back has felt less stiff since we started the daily stretches.",
  cholesterol:
    "Mom's been good about skipping grapefruit since she started Atorvastatin.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Whole UTC-day difference between two YYYY-MM-DD strings (later - earlier).
// Math.round is defensive — both inputs are interpreted as UTC midnight so
// the ratio is integer in theory, but rounding guards against float drift.
function daysBetween(laterIso: string, earlierIso: string): number {
  const a = Date.UTC(
    +laterIso.slice(0, 4),
    +laterIso.slice(5, 7) - 1,
    +laterIso.slice(8, 10),
  );
  const b = Date.UTC(
    +earlierIso.slice(0, 4),
    +earlierIso.slice(5, 7) - 1,
    +earlierIso.slice(8, 10),
  );
  return Math.round((a - b) / DAY_MS);
}

// First clause of a recommendation (split on " — "). Lowercased so it reads
// naturally inside the surrounding sentence: `you tried "add a small protein
// snack…" for energy`.
function firstClause(text: string): string {
  const head = text.split(" — ")[0].trim();
  return head ? head[0].toLowerCase() + head.slice(1) : head;
}

function lcFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
