"use client";

import { useEffect, useState } from "react";
import type {
  Baseline,
  CaregiverBrief,
  CheckIn,
  EscalationDecision,
} from "@/types";
import { decide } from "@/rules";
import baselineJson from "@/baseline.json";
import demoCacheJson from "@/demo-cache.json";

type ApiResponse = {
  checkIn: CheckIn;
  decision: EscalationDecision;
  brief: CaregiverBrief;
};
type ApiError = { error: string };

const baseline = baselineJson as Baseline;

const SEEDED = {
  dizziness: "今朝は薬を飲み忘れて、ちょっとふらふらします。",
  knee: "今朝、庭仕事をしてから膝が少し痛みます。",
};
type ScenarioId = keyof typeof SEEDED;

// Pre-computed responses from running the seeded scenarios through the real
// pipeline. The cached path delivers these instantly so demos don't depend on
// LLM latency. The free-text "Analyze" path always stays live. ?live=1 forces
// the seeded buttons to hit the live pipeline (proof on demand that it's real).
const demoCache = demoCacheJson as Record<ScenarioId, ApiResponse>;
const SEEDED_DELAY_MS = 1200;

type Verdict = {
  phrase: string;
  tag: string;
  bg: string;
  bar: string;
  ink: string;
  ring: string;
};

const VERDICTS: Record<EscalationDecision["level"], Verdict> = {
  escalate: {
    phrase: "Worth a call today.",
    tag: "Escalate",
    bg: "bg-clay-soft",
    bar: "bg-clay",
    ink: "text-clay-deep",
    ring: "ring-clay/20",
  },
  monitor: {
    phrase: "Keep watching.",
    tag: "Monitor",
    bg: "bg-amber-bg",
    bar: "bg-amber-warm",
    ink: "text-amber-deep",
    ring: "ring-amber-warm/20",
  },
  fine: {
    phrase: "Looks normal today.",
    tag: "Fine",
    bg: "bg-paper",
    bar: "bg-stone-warm",
    ink: "text-ink-soft",
    ring: "ring-edge",
  },
};

export default function Dashboard() {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);

  useEffect(() => {
    setLiveMode(new URLSearchParams(window.location.search).has("live"));
  }, []);

  async function analyze(text: string, language = "ja") {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: trimmed, language }),
      });
      const data: ApiResponse | ApiError = await res.json();
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : `Request failed (HTTP ${res.status})`);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function runSeeded(id: ScenarioId) {
    const cached = demoCache[id];
    // ?live=1 overrides cache; missing cache entry also falls back to live.
    if (liveMode || !cached) {
      return analyze(SEEDED[id]);
    }
    setError(null);
    setResult(null);
    setLoading(true);
    await new Promise((r) => setTimeout(r, SEEDED_DELAY_MS));
    setResult(cached);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-cream text-ink-deep">
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <Header />
        <div className="print:hidden">
          <Controls
            transcript={transcript}
            setTranscript={setTranscript}
            loading={loading}
            onSeeded={runSeeded}
            onAnalyze={() => analyze(transcript)}
          />
        </div>
        {baseline.recentCheckIns.length > 0 && (
          <TrendStrip history={baseline.recentCheckIns} todayResult={result} />
        )}
        <section className="mt-10">
          {loading && <div className="print:hidden"><LoadingCard /></div>}
          {!loading && error && <div className="print:hidden"><ErrorCard message={error} /></div>}
          {!loading && !error && result && <ResultCard result={result} />}
          {!loading && !error && !result && <div className="print:hidden"><EmptyHint /></div>}
        </section>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="mb-12">
      <div className="text-xs uppercase tracking-[0.22em] text-clay font-medium">
        Throughline
      </div>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl leading-tight text-ink-deep">
        Today&rsquo;s check-in with Mom.
      </h1>
      <p className="mt-3 text-ink-soft text-base md:text-lg leading-relaxed">
        A bilingual bridge between you and her day &mdash; in her own words, and in English.
      </p>
    </header>
  );
}

function Controls({
  transcript,
  setTranscript,
  loading,
  onSeeded,
  onAnalyze,
}: {
  transcript: string;
  setTranscript: (s: string) => void;
  loading: boolean;
  onSeeded: (id: ScenarioId) => void;
  onAnalyze: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <SeededButton
          disabled={loading}
          onClick={() => onSeeded("dizziness")}
          label="Dizziness check-in"
          sub="JA · dose skipped"
        />
        <SeededButton
          disabled={loading}
          onClick={() => onSeeded("knee")}
          label="Knee pain check-in"
          sub="JA · after gardening"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px bg-edge flex-1" />
        <span className="text-xs uppercase tracking-widest text-ink-quiet">or paste a transcript</span>
        <div className="h-px bg-edge flex-1" />
      </div>

      <div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste Mom's transcript here (any language)…"
          rows={4}
          className="w-full rounded-lg border border-edge bg-paper px-4 py-3 text-ink-deep placeholder:text-ink-quiet focus:outline-none focus:border-clay/60 focus:ring-2 focus:ring-clay/15 resize-none transition-colors"
          disabled={loading}
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={onAnalyze}
            disabled={loading || !transcript.trim()}
            className="rounded-full bg-clay px-6 py-2.5 text-sm font-medium text-cream hover:bg-clay-deep disabled:bg-ink-quiet/40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SeededButton({
  label,
  sub,
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 group rounded-2xl border border-edge bg-paper px-5 py-4 text-left hover:border-clay/40 hover:bg-clay-soft/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <div className="text-base text-ink-deep group-hover:text-clay-deep transition-colors">
        {label}
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wider text-ink-quiet">{sub}</div>
    </button>
  );
}

function EmptyHint() {
  return (
    <div className="text-center text-ink-quiet text-sm py-12">
      Pick a check-in above to see the brief.
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-clay/30 bg-clay-soft/40 p-6">
      <div className="text-xs uppercase tracking-widest text-clay-deep mb-2">Something went wrong</div>
      <div className="text-ink-deep">{message}</div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl bg-paper border border-edge p-10 text-center">
      <div className="inline-flex items-center gap-3 text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-clay/70 animate-pulse" />
        <span className="text-sm">Listening to Mom…</span>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: ApiResponse }) {
  const { checkIn, decision } = result;
  const v = VERDICTS[decision.level];
  return (
    <article className="space-y-10">
      {/* Verdict + reasons */}
      <div className={`rounded-2xl ${v.bg} ring-1 ${v.ring} overflow-hidden`}>
        <div className="flex">
          <div className={`w-1.5 ${v.bar}`} />
          <div className="flex-1 p-7 md:p-9">
            <div className={`text-[11px] uppercase tracking-[0.22em] font-medium ${v.ink}`}>
              {v.tag}
            </div>
            <h2 className={`mt-3 font-serif text-3xl md:text-4xl leading-snug ${v.ink}`}>
              {v.phrase}
            </h2>
            {decision.reasons.length > 0 && (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-widest text-ink-quiet mb-2">Because</div>
                <ul className="space-y-1.5 text-ink-soft">
                  {decision.reasons.map((r, i) => (
                    <li key={i} className="leading-relaxed">
                      <span className="mr-2 text-clay/70">·</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bilingual bridge */}
      <Section label="In her own words">
        <blockquote
          lang={checkIn.language}
          className="font-serif text-2xl md:text-[1.65rem] leading-snug text-ink-deep"
        >
          &ldquo;{checkIn.rawTranscript}&rdquo;
        </blockquote>
        <div className="mt-4 text-xs uppercase tracking-widest text-ink-quiet">In English</div>
        <p className="mt-2 text-ink-soft text-lg leading-relaxed">
          &ldquo;{checkIn.translatedTranscript}&rdquo;
        </p>
      </Section>

      {/* Ambiguity — the signature feature */}
      {checkIn.ambiguity.length > 0 && (
        <Section label="Needs clarifying">
          <div className="space-y-4">
            {checkIn.ambiguity.map((a, i) => (
              <div
                key={i}
                className="rounded-xl bg-amber-bg/60 border border-amber-warm/25 p-5"
              >
                <div className="font-serif text-xl text-amber-deep" lang={checkIn.language}>
                  &ldquo;{a.phrase}&rdquo;
                </div>
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-widest text-amber-warm">Could mean</div>
                  <ul className="mt-1.5 text-ink-soft text-sm space-y-0.5">
                    {a.couldMean.map((c, j) => (
                      <li key={j}>
                        <span className="mr-2 text-amber-warm/60">·</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 pt-4 border-t border-amber-warm/20">
                  <div className="text-[11px] uppercase tracking-widest text-amber-warm mb-1.5">
                    Ask her
                  </div>
                  <p className="text-ink-deep leading-relaxed">{a.followUp}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Medication */}
      <Section label="Medication">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-widest text-ink-quiet">Today&rsquo;s dose</dt>
            <dd className="mt-1 text-ink-deep">
              {medicationLabel(checkIn.extracted.medicationTaken)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-ink-quiet">How she feels</dt>
            <dd className="mt-1 text-ink-deep">
              {effectLabel(checkIn.extracted.perceivedEffect)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-widest text-ink-quiet">Med context</dt>
            <dd className="mt-1 text-ink-soft">
              {checkIn.medContext.name} &middot; day {checkIn.medContext.dayOfChange}
            </dd>
          </div>
        </dl>
      </Section>

      {/* Brief — for the next appointment */}
      <BriefCard result={result} />

      {/* Audit trail */}
      <div className="pt-6 border-t border-edge text-xs text-ink-quiet font-mono print:hidden">
        Rules triggered: {decision.triggeredRules.join(", ") || "—"}
      </div>
    </article>
  );
}

function BriefCard({ result }: { result: ApiResponse }) {
  const { brief } = result;
  return (
    <Section label="For the next appointment">
      <div className="rounded-2xl border border-edge bg-paper p-6 md:p-7 space-y-6">
        <h3 className="font-serif text-xl md:text-2xl leading-snug text-ink-deep">
          {brief.headline}
        </h3>

        <div>
          <div className="text-xs uppercase tracking-widest text-ink-quiet mb-1.5">
            What changed
          </div>
          <p className="text-ink-soft leading-relaxed">{brief.whatChanged}</p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-ink-quiet mb-1.5">
            Why it matters
          </div>
          <p className="text-ink-soft leading-relaxed">{brief.whyItMatters}</p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-ink-quiet mb-1.5">
            Suggested action
          </div>
          <p className="text-ink-deep leading-relaxed">{brief.suggestedAction}</p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-ink-quiet mb-2">
            Questions to ask the doctor
          </div>
          <ul className="space-y-1.5 text-ink-soft">
            {brief.questionsForDoctor.map((q, i) => (
              <li key={i} className="leading-relaxed">
                <span className="mr-2 text-clay/70">·</span>
                {q}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 pt-4 border-t border-edge print:hidden">
          <CopyButton result={result} />
          <PrintButton />
        </div>
      </div>
    </Section>
  );
}

function CopyButton({ result }: { result: ApiResponse }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = formatPlainTextSummary(result);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-full border border-edge bg-paper px-4 py-2 text-sm text-ink-deep hover:border-clay/40 hover:bg-clay-soft/40 transition-colors"
    >
      {copied ? "Copied" : "Copy summary"}
    </button>
  );
}

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full border border-edge bg-paper px-4 py-2 text-sm text-ink-deep hover:border-clay/40 hover:bg-clay-soft/40 transition-colors"
    >
      Print
    </button>
  );
}

function formatPlainTextSummary(result: ApiResponse): string {
  const { checkIn, decision, brief } = result;
  const lines: string[] = [];
  lines.push(brief.headline);
  lines.push("");
  lines.push("WHAT CHANGED");
  lines.push(brief.whatChanged);
  lines.push("");
  lines.push("WHY IT MATTERS");
  lines.push(brief.whyItMatters);
  lines.push("");
  lines.push("SUGGESTED ACTION");
  lines.push(brief.suggestedAction);
  lines.push("");
  lines.push("QUESTIONS TO ASK THE DOCTOR");
  for (const q of brief.questionsForDoctor) {
    lines.push(`- ${q}`);
  }
  lines.push("");
  lines.push("—");
  lines.push(
    `Medication: ${checkIn.medContext.name}, day ${checkIn.medContext.dayOfChange}`,
  );
  lines.push(`Parent's words (${checkIn.language}): "${checkIn.rawTranscript}"`);
  lines.push(`Translation: "${checkIn.translatedTranscript}"`);
  lines.push(`Rules-engine level: ${decision.level}`);
  return lines.join("\n");
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.22em] text-clay font-medium mb-4">{label}</div>
      {children}
    </div>
  );
}

function TrendStrip({
  history,
  todayResult,
}: {
  history: CheckIn[];
  todayResult: ApiResponse | null;
}) {
  // history is oldest → newest. Each dot's day-ago index = history.length - i.
  const dots = history.map((ci, i) => ({
    ci,
    level: decide(ci, baseline).level,
    daysAgo: history.length - i,
  }));
  const caption = captionFromTrend(history, todayResult);

  return (
    <section className="mt-12 pb-6 border-b border-edge">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-3">
            Past {history.length} days
          </div>
          <div className="flex items-center gap-5">
            {dots.map((d) => (
              <Dot key={d.ci.id} level={d.level} />
            ))}
            {todayResult && (
              <TodayDot
                key={todayResult.checkIn.id}
                level={todayResult.decision.level}
              />
            )}
          </div>
          <div className="flex items-center gap-5 mt-2">
            {dots.map((d) => (
              <div
                key={d.ci.id}
                className="text-[10px] text-ink-quiet w-2.5 text-center tabular-nums"
              >
                {shortDate(d.ci.timestamp)}
              </div>
            ))}
            {todayResult && (
              <div
                key={todayResult.checkIn.id}
                className="text-[10px] text-ink-deep italic font-medium w-3 text-center whitespace-nowrap"
              >
                Today
              </div>
            )}
          </div>
        </div>
        {caption && (
          <p className="font-serif italic text-sm text-ink-soft text-right leading-snug max-w-[14rem]">
            {caption}
          </p>
        )}
      </div>
    </section>
  );
}

function Dot({ level }: { level: EscalationDecision["level"] }) {
  switch (level) {
    case "escalate":
      return <span className="block h-2.5 w-2.5 rounded-full bg-clay" />;
    case "monitor":
      return <span className="block h-2.5 w-2.5 rounded-full bg-stone-warm" />;
    case "fine":
      return <span className="block h-2.5 w-2.5 rounded-full border border-stone-warm/60" />;
  }
}

// Slightly larger than history dots, animates in on mount. The parent passes a
// `key` tied to checkIn.id so a new scenario remounts and re-animates.
function TodayDot({ level }: { level: EscalationDecision["level"] }) {
  const base = "block h-3 w-3 rounded-full";
  const fill =
    level === "escalate"
      ? "bg-clay"
      : level === "monitor"
        ? "bg-stone-warm"
        : "border border-stone-warm/60";
  return (
    <span
      className={`${base} ${fill}`}
      style={{ animation: "today-pop 420ms ease-out" }}
    />
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function captionFromTrend(
  history: CheckIn[],
  todayResult: ApiResponse | null,
): string {
  if (history.length === 0 && !todayResult) return "";

  const totalDays = history.length + (todayResult ? 1 : 0);
  const historyEscalates = history.filter(
    (ci) => decide(ci, baseline).level === "escalate",
  ).length;
  const todayLevel = todayResult?.decision.level;
  const totalEscalates =
    historyEscalates + (todayLevel === "escalate" ? 1 : 0);

  // Recurring escalation pattern: today escalates AND history already had
  // escalates. Name it by the most-frequent new-symptom term across the
  // timeline so the caption reads like a continuation, not a fresh alarm.
  if (todayLevel === "escalate" && historyEscalates >= 1) {
    const recurringTerm = mostFrequentNewTerm(history, todayResult);
    if (recurringTerm) {
      return `${capitalize(recurringTerm)} flagged again — ${totalEscalates} of the last ${totalDays} days.`;
    }
    return `${totalEscalates} of the last ${totalDays} days needed attention.`;
  }

  // Today escalates but is the first time in this window.
  if (todayLevel === "escalate") {
    const newToday = todayResult!.checkIn.extracted.symptoms.filter(
      (s) => s.isNew,
    );
    if (newToday.length > 0) {
      return `${capitalize(newToday[0].term)} flagged today — new this week.`;
    }
    return `Today needs attention.`;
  }

  // Today is monitor/fine (or no today). Look across history (and today, if
  // present) for the most-recently-introduced new symptom.
  const firstSeen = new Map<string, number>();
  history.forEach((ci, i) => {
    const daysAgo = history.length - i;
    for (const s of ci.extracted.symptoms) {
      if (s.isNew && !firstSeen.has(s.term)) {
        firstSeen.set(s.term, daysAgo);
      }
    }
  });
  if (todayResult) {
    for (const s of todayResult.checkIn.extracted.symptoms) {
      if (s.isNew && !firstSeen.has(s.term)) {
        firstSeen.set(s.term, 0);
      }
    }
  }

  if (firstSeen.size > 0) {
    let term = "";
    let daysAgo = Infinity;
    firstSeen.forEach((d, t) => {
      if (d < daysAgo) {
        term = t;
        daysAgo = d;
      }
    });
    const when =
      daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
    return `${capitalize(term)} is new — first appeared ${when}.`;
  }

  if (totalEscalates === 0) {
    return `${totalDays} days, nothing new.`;
  }
  return `${totalEscalates} of the last ${totalDays} days needed attention.`;
}

function mostFrequentNewTerm(
  history: CheckIn[],
  todayResult: ApiResponse | null,
): string | null {
  const counts = new Map<string, number>();
  const bump = (term: string) =>
    counts.set(term, (counts.get(term) ?? 0) + 1);
  for (const ci of history) {
    for (const s of ci.extracted.symptoms) if (s.isNew) bump(s.term);
  }
  if (todayResult) {
    for (const s of todayResult.checkIn.extracted.symptoms) {
      if (s.isNew) bump(s.term);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  counts.forEach((c, t) => {
    if (c > bestCount) {
      best = t;
      bestCount = c;
    }
  });
  return best;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function medicationLabel(v: CheckIn["extracted"]["medicationTaken"]): string {
  switch (v) {
    case "yes":
      return "Taken";
    case "no":
      return "Skipped";
    case "unsure":
      return "Not mentioned — ask her";
  }
}

function effectLabel(v: CheckIn["extracted"]["perceivedEffect"]): string {
  switch (v) {
    case "better":
      return "Better than before";
    case "worse":
      return "Worse than before";
    case "same":
      return "About the same";
    case "unsure":
      return "Hard to tell";
  }
}
