"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import type {
 Baseline,
 CaregiverBrief,
 CheckIn,
 EscalationDecision,
} from "@/types";
import { decide } from "@/rules";
import baselineJson from "@/baseline.json";
import demoCacheJson from "@/demo-cache.json";
import { useProfile } from "@/profile-context";
import type { Appointment, CareTeamMember, Medication } from "@/profile";
import { generateSuggestions, type Suggestion } from "@/suggestions";


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
   tag: "Recommended follow-up",
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


// Inline SVG icon helper — uses Heroicons-style stroke paths
function Icon({ d, className = "" }: { d: string; className?: string }) {
 return (
   <svg
     className={`w-4 h-4 shrink-0 ${className}`}
     fill="none"
     viewBox="0 0 24 24"
     stroke="currentColor"
     strokeWidth={1.5}
   >
     <path strokeLinecap="round" strokeLinejoin="round" d={d} />
   </svg>
 );
}


type NavItemId = "checkin" | "history" | "trends" | "medications" | "careteam" | "settings";


const NAV_ICONS: Record<NavItemId, string> = {
 checkin:
   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
 history: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
 trends: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
 medications:
   "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
 careteam:
   "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
 settings:
   "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
};


const NAV_ITEMS: { id: NavItemId; label: string; clickable: boolean }[] = [
 { id: "checkin", label: "Check-in", clickable: true },
 { id: "history", label: "History", clickable: true },
 { id: "trends", label: "Trends", clickable: true },
 { id: "medications", label: "Medications", clickable: true },
 { id: "careteam", label: "Care Team", clickable: true },
 { id: "settings", label: "Settings", clickable: false },
];


function LeftSidebar({
 activeView,
 onSelectView,
}: {
 activeView: NavItemId;
 onSelectView: (id: NavItemId) => void;
}) {
 return (
   <aside className="hidden md:flex w-56 shrink-0 h-full flex-col border-r border-edge bg-paper/70 print:hidden">
     {/* Logo */}
     <div className="px-5 py-6 border-b border-edge">
       <div className="flex items-center gap-2.5">
         <div className="w-7 h-7 rounded-lg bg-clay flex items-center justify-center shrink-0">
           <span className="text-cream text-xs font-serif font-bold">T</span>
         </div>
         <div>
           <div className="text-ink-deep font-serif text-base leading-none">Throughline</div>
           <div className="text-[10px] text-ink-quiet mt-0.5">Caregiver companion</div>
         </div>
       </div>
     </div>


     {/* Nav */}
     <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
       {NAV_ITEMS.map((item) => {
         const isActive = activeView === item.id;
         const base =
           "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-left";
         const state = isActive
           ? "bg-clay-soft/80 text-clay-deep font-medium"
           : item.clickable
             ? "text-ink-soft hover:bg-edge/60 hover:text-ink-deep"
             : "text-ink-quiet/70 cursor-not-allowed";
         return (
           <button
             key={item.id}
             type="button"
             onClick={item.clickable ? () => onSelectView(item.id) : undefined}
             disabled={!item.clickable}
             aria-current={isActive ? "page" : undefined}
             className={`${base} ${state}`}
           >
             <Icon
               d={NAV_ICONS[item.id]}
               className={
                 isActive
                   ? "text-clay"
                   : item.clickable
                     ? "text-ink-quiet"
                     : "text-ink-quiet/50"
               }
             />
             <span className="flex-1">{item.label}</span>
             {!item.clickable && (
               <span className="text-[9px] uppercase tracking-widest text-ink-quiet/80 bg-edge/60 px-1.5 py-0.5 rounded">
                 Soon
               </span>
             )}
           </button>
         );
       })}
     </nav>


     {/* Quick Tip */}
     <div className="px-4 mb-3">
       <div className="rounded-xl bg-sage-soft border border-sage/20 p-3.5">
         <div className="text-[10px] uppercase tracking-widest text-sage font-semibold mb-1.5">
           Quick Tip
         </div>
         <p className="text-xs text-ink-soft leading-relaxed">
           Check in daily at the same time for the most consistent insights.
         </p>
       </div>
     </div>


     {/* Language toggle — visual only for now; selection is local sidebar state */}
     <LanguageToggle />
   </aside>
 );
}

function LanguageToggle() {
 const [lang, setLang] = useState<"en" | "ja">("en");
 const pill = (id: "en" | "ja", label: string) => (
   <button
     type="button"
     onClick={() => setLang(id)}
     aria-pressed={lang === id}
     className={`flex-1 text-xs py-1.5 rounded-lg text-center transition-colors ${
       lang === id
         ? "bg-clay text-cream font-medium"
         : "border border-edge text-ink-quiet hover:border-clay/40 hover:text-ink-soft"
     }`}
   >
     {label}
   </button>
 );
 return (
   <div className="px-4 pb-5 pt-3 border-t border-edge">
     <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-2">Language</div>
     <div className="flex gap-1.5">
       {pill("en", "EN")}
       {pill("ja", "日本語")}
     </div>
   </div>
 );
}


export default function Dashboard() {
 const { profile } = useProfile();
 const [activeView, setActiveView] = useState<NavItemId>("checkin");
 const [transcript, setTranscript] = useState("");
 const [loading, setLoading] = useState(false);
 const [result, setResult] = useState<ApiResponse | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [liveMode, setLiveMode] = useState(false);
 const [greeting, setGreeting] = useState("Good morning");


 useEffect(() => {
   setLiveMode(new URLSearchParams(window.location.search).has("live"));
   const hour = new Date().getHours();
   if (hour < 12) setGreeting("Good morning");
   else if (hour < 17) setGreeting("Good afternoon");
   else setGreeting("Good evening");
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


 const showRightPanel =
   activeView === "checkin" && !loading && !error && !!result;

 // Deterministic rules over useProfile() data — no LLM, no API call. Runs
 // once per profile change. Surfaces 3–4 prompts above the check-in controls.
 const suggestions = useMemo(() => generateSuggestions(profile), [profile]);

 // Ref the textarea so clicking a suggestion can focus + scroll the caregiver
 // straight to the prefilled note for editing.
 const transcriptRef = useRef<HTMLTextAreaElement>(null);

 function pickSuggestion(s: Suggestion) {
   setTranscript(s.prefill);
   // Defer to the next frame so React has committed the new value before we
   // move the caret to the end and scroll the textarea into view.
   requestAnimationFrame(() => {
     const el = transcriptRef.current;
     if (!el) return;
     el.focus();
     try {
       el.setSelectionRange(s.prefill.length, s.prefill.length);
     } catch {
       // setSelectionRange can throw on detached elements — safe to ignore.
     }
     el.scrollIntoView({ behavior: "smooth", block: "center" });
   });
 }


 return (
   <div className="h-screen bg-cream flex overflow-hidden">
     <LeftSidebar activeView={activeView} onSelectView={setActiveView} />


     <div className="flex-1 flex min-w-0 overflow-hidden">
       {/* Main workspace */}
       <main className="flex-1 overflow-y-auto min-w-0">
         <div className="max-w-2xl mx-auto px-6 py-10">
           {activeView === "checkin" && (
             <>
               {/* Greeting */}
               <div className="text-sm text-ink-quiet mb-1">
                 {greeting}, {profile.caregiverName}
               </div>


               {/* Main heading */}
               <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
                 Today&rsquo;s check-in with Mom.
               </h1>
               <p className="mt-2 text-ink-soft text-sm md:text-base leading-relaxed max-w-xl">
                 A multilingual bridge between you and her day &mdash; in her own words, and in English.
               </p>


               {/* Suggestions — deterministic rules over the profile; click prefills */}
               {suggestions.length > 0 && (
                 <div className="mt-8 print:hidden">
                   <SuggestionsCard
                     suggestions={suggestions}
                     onPick={pickSuggestion}
                   />
                 </div>
               )}

               {/* Controls */}
               <div className="mt-6 print:hidden">
                 <Controls
                   transcript={transcript}
                   setTranscript={setTranscript}
                   loading={loading}
                   onSeeded={runSeeded}
                   onAnalyze={() => analyze(transcript)}
                   textareaRef={transcriptRef}
                 />
               </div>


               {/* Privacy banner */}
               <PrivacyBanner />


               {/* Trend strip */}
               {baseline.recentCheckIns.length > 0 && (
                 <TrendStrip history={baseline.recentCheckIns} todayResult={result} />
               )}


               {/* Result main content */}
               <section className="mt-8">
                 {loading && (
                   <div className="print:hidden">
                     <LoadingCard />
                   </div>
                 )}
                 {!loading && error && (
                   <div className="print:hidden">
                     <ErrorCard message={error} />
                   </div>
                 )}
                 {!loading && !error && result && <MainResultContent result={result} />}
                 {!loading && !error && !result && (
                   <div className="print:hidden">
                     <EmptyHint />
                   </div>
                 )}
               </section>
             </>
           )}


           {activeView === "history" && <HistoryView />}

           {activeView === "medications" && <MedicationsView />}

           {activeView === "careteam" && <CareTeamView />}

           {activeView === "trends" && <TrendsView />}
         </div>
       </main>


       {/* Right insight panel — slides in when results are present */}
       {showRightPanel && (
         <aside className="w-[300px] xl:w-[340px] shrink-0 h-full overflow-y-auto border-l border-edge bg-paper/60 print:hidden">
           <div className="p-6">
             <RightPanel result={result!} />
           </div>
         </aside>
       )}
     </div>
   </div>
 );
}


function SuggestionsCard({
  suggestions,
  onPick,
}: {
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.22em] text-clay font-medium mb-3">
        Today, you might check on…
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            title={`Click to prefill the transcript — source: ${s.source}`}
            className="w-full text-left rounded-xl border border-sage/25 bg-sage-soft/50 hover:bg-sage-soft hover:border-sage/50 px-4 py-3 text-sm text-ink-deep leading-relaxed transition-colors"
          >
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrivacyBanner() {
 return (
   <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-edge bg-paper/60 px-4 py-2.5">
     <Icon
       d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
       className="text-sage mt-0.5"
     />
     <p className="text-xs text-ink-quiet leading-relaxed">
       Your data is private and secure. We never share it without your permission.
     </p>
   </div>
 );
}


function Controls({
 transcript,
 setTranscript,
 loading,
 onSeeded,
 onAnalyze,
 textareaRef,
}: {
 transcript: string;
 setTranscript: (s: string) => void;
 loading: boolean;
 onSeeded: (id: ScenarioId) => void;
 onAnalyze: () => void;
 textareaRef?: React.Ref<HTMLTextAreaElement>;
}) {
 return (
   <div className="space-y-5">
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
         ref={textareaRef}
         value={transcript}
         onChange={(e) => setTranscript(e.target.value)}
         placeholder="Describe how Mom feels today — any language."
         rows={4}
         className="w-full rounded-xl border border-edge bg-paper px-4 py-3 text-ink-deep placeholder:text-ink-quiet focus:outline-none focus:border-clay/60 focus:ring-2 focus:ring-clay/15 resize-none transition-colors"
         disabled={loading}
       />
       <div className="mt-2 flex items-center gap-2">
         {/* Input method pills — visual only, no new functionality */}
         <div className="flex gap-1.5">
           <InputMethodPill label="Type" active />
           <InputMethodPill label="Voice" />
           <InputMethodPill label="Translate" />
         </div>
         <div className="flex-1" />
         <button
           onClick={onAnalyze}
           disabled={loading || !transcript.trim()}
           className="rounded-full bg-clay px-6 py-2 text-sm font-medium text-cream hover:bg-clay-deep disabled:bg-ink-quiet/40 disabled:cursor-not-allowed transition-colors"
         >
           {loading ? "Analyzing…" : "Analyze"}
         </button>
       </div>
     </div>
   </div>
 );
}


function InputMethodPill({ label, active }: { label: string; active?: boolean }) {
 return (
   <div
     className={`rounded-full px-3 py-1 text-xs border select-none ${
       active
         ? "border-clay/40 bg-clay-soft/50 text-clay-deep"
         : "border-edge text-ink-quiet"
     }`}
   >
     {label}
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
     className="flex-1 group rounded-2xl border border-edge bg-paper px-5 py-4 text-left hover:border-clay/40 hover:bg-clay-soft/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
   >
     <div className="text-sm font-medium text-ink-deep group-hover:text-clay-deep transition-colors">
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


// Main workspace result content: bilingual bridge, medication, brief
function MainResultContent({ result }: { result: ApiResponse }) {
 const { checkIn, decision } = result;
 return (
   <article className="space-y-8">
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


     {/* Brief */}
     <BriefCard result={result} />


     {/* Audit trail */}
     <div className="pt-6 border-t border-edge text-xs text-ink-quiet font-mono print:hidden">
       Rules triggered: {decision.triggeredRules.join(", ") || "—"}
     </div>
   </article>
 );
}


// History view — month-at-a-time calendar over the seeded year. Each day cell
// with a check-in shows a verdict dot (clay/stone/hollow) plus a 1–2 word
// summary; clicking a day opens a detail panel with the symptoms, transcript,
// med context, and the "because" reasons the rules engine returned. decide()
// stays the single source of truth for level coloring — no rule logic is
// duplicated in this file.
function HistoryView() {
  const { profile } = useProfile();

  // Index history by ISO day (YYYY-MM-DD). One check-in per day in the seed.
  const byDay = useMemo(() => {
    const m = new Map<string, CheckIn>();
    for (const ci of profile.checkInHistory) m.set(ci.timestamp.slice(0, 10), ci);
    return m;
  }, [profile.checkInHistory]);

  // Navigation bounds — drawn from the seed timeline so arrows disable at the
  // edges instead of letting users wander into empty months.
  const bounds = useMemo(() => {
    if (profile.checkInHistory.length === 0) return null;
    const first = profile.checkInHistory[0].timestamp;
    const last = profile.checkInHistory[profile.checkInHistory.length - 1].timestamp;
    return { min: monthFromIso(first), max: monthFromIso(last) };
  }, [profile.checkInHistory]);

  // Default to today's month. In the demo, today is in May 2026, so this
  // lands on the month that contains the Amlodipine cluster.
  const [{ year, month }, setMonth] = useState<{ year: number; month: number }>(
    () => {
      const now = new Date();
      return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
    },
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = selectedKey ? (byDay.get(selectedKey) ?? null) : null;

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Per-cell verdicts for the summary line above the grid + the cell tint.
  const cellVerdicts = useMemo(() => {
    const m = new Map<string, EscalationDecision["level"]>();
    for (const key of cells) {
      if (!key) continue;
      const ci = byDay.get(key);
      if (!ci) continue;
      m.set(key, decide(ci, baseline).level);
    }
    return m;
  }, [cells, byDay]);

  const canPrev = !!bounds && monthCompare({ year, month }, bounds.min) > 0;
  const canNext = !!bounds && monthCompare({ year, month }, bounds.max) < 0;

  function step(delta: -1 | 1) {
    setMonth(({ year, month }) => {
      const m = month + delta;
      if (m < 0) return { year: year - 1, month: 11 };
      if (m > 11) return { year: year + 1, month: 0 };
      return { year, month: m };
    });
  }

  return (
    <>
      <div className="text-sm text-ink-quiet mb-1">History</div>
      <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
        Mom&rsquo;s past check-ins.
      </h1>
      <p className="mt-2 text-ink-soft text-sm md:text-base leading-relaxed max-w-xl">
        {summarizeMonth(cellVerdicts)}
      </p>

      {/* Month nav */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="w-9 h-9 rounded-full border border-edge text-ink-soft text-lg leading-none hover:border-clay/40 hover:text-clay-deep disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>
        <div className="font-serif text-xl text-ink-deep">
          {monthLabel(year, month)}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canNext}
          aria-label="Next month"
          className="w-9 h-9 rounded-full border border-edge text-ink-soft text-lg leading-none hover:border-clay/40 hover:text-clay-deep disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
      </div>

      {/* Weekday header */}
      <div className="mt-5 grid grid-cols-7 gap-1.5 text-[10px] uppercase tracking-widest text-ink-quiet">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center pb-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((key, i) => {
          if (!key) return <div key={`pad-${i}`} className="aspect-square" />;
          const ci = byDay.get(key);
          const day = parseInt(key.slice(8, 10), 10);
          if (!ci) return <EmptyDayCell key={key} day={day} />;
          const level = cellVerdicts.get(key) ?? "fine";
          return (
            <DayCell
              key={key}
              day={day}
              level={level}
              summary={summarize(ci)}
              onClick={() => setSelectedKey(key)}
            />
          );
        })}
      </div>

      {selected && (
        <DayDetailModal checkIn={selected} onClose={() => setSelectedKey(null)} />
      )}
    </>
  );
}

function DayCell({
  day,
  level,
  summary,
  onClick,
}: {
  day: number;
  level: EscalationDecision["level"];
  summary: string;
  onClick: () => void;
}) {
  const isEsc = level === "escalate";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`aspect-square min-w-0 rounded-lg border p-1.5 text-left transition-colors flex flex-col ${
        isEsc
          ? "bg-clay-soft/60 border-clay/30 hover:border-clay/60"
          : "bg-paper border-edge/60 hover:border-clay/40"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`text-xs tabular-nums ${
            isEsc ? "text-clay-deep font-medium" : "text-ink-deep"
          }`}
        >
          {day}
        </span>
        <Dot level={level} />
      </div>
      <div
        className={`mt-auto text-[10px] leading-tight truncate ${
          isEsc ? "text-clay-deep" : "text-ink-soft"
        }`}
        title={summary}
      >
        {summary}
      </div>
    </button>
  );
}

function EmptyDayCell({ day }: { day: number }) {
  return (
    <div className="aspect-square rounded-lg border border-edge/30 bg-cream/40 p-1.5">
      <span className="text-xs text-ink-quiet/50 tabular-nums">{day}</span>
    </div>
  );
}

function DayDetailModal({
  checkIn,
  onClose,
}: {
  checkIn: CheckIn;
  onClose: () => void;
}) {
  const decision = decide(checkIn, baseline);
  const v = VERDICTS[decision.level];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink-deep/30 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-paper rounded-t-2xl md:rounded-2xl border border-edge shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full text-ink-quiet hover:text-ink-deep hover:bg-edge/60 transition-colors flex items-center justify-center text-xl leading-none"
        >
          ×
        </button>

        <div className="p-6 md:p-7 space-y-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-ink-quiet font-medium">
              {prettyDate(checkIn.timestamp)}
            </div>
            <div className={`mt-3 inline-flex items-center gap-2 ${v.ink}`}>
              <Dot level={decision.level} />
              <span className="text-[11px] uppercase tracking-[0.22em] font-medium">
                {v.tag}
              </span>
            </div>
            <h2 className={`mt-1 font-serif text-2xl leading-snug ${v.ink}`}>
              {v.phrase}
            </h2>
          </div>

          {decision.reasons.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-2">
                Because
              </div>
              <ul className="space-y-1.5 text-ink-soft text-sm">
                {decision.reasons.map((r, i) => (
                  <li key={i} className="leading-relaxed">
                    <span className="mr-2 text-clay/70">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkIn.extracted.symptoms.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-2">
                Symptoms
              </div>
              <ul className="text-sm text-ink-soft space-y-0.5">
                {checkIn.extracted.symptoms.map((s, i) => (
                  <li key={i}>
                    <span className="mr-2 text-clay/70">·</span>
                    {s.term}
                    {s.isNew && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-clay-deep">
                        new
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-2">
              In her own words
            </div>
            <blockquote
              lang={checkIn.language}
              className="font-serif text-lg text-ink-deep leading-snug"
            >
              &ldquo;{checkIn.rawTranscript}&rdquo;
            </blockquote>
            <p className="mt-2 text-ink-soft text-sm leading-relaxed">
              &ldquo;{checkIn.translatedTranscript}&rdquo;
            </p>
          </div>

          <div className="pt-4 border-t border-edge">
            <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-1">
              Med context
            </div>
            <div className="text-sm text-ink-soft">
              {checkIn.medContext.name} &middot; day {checkIn.medContext.dayOfChange}
            </div>
            <div className="text-sm text-ink-soft mt-1">
              Dose: {medicationLabel(checkIn.extracted.medicationTaken)} &middot;{" "}
              How she felt: {effectLabel(checkIn.extracted.perceivedEffect)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar helpers — date math + per-cell text. No rule logic lives here; the
// verdict level always comes from decide() upstream.
// ─────────────────────────────────────────────────────────────────────────────

function summarize(checkIn: CheckIn): string {
  if (checkIn.extracted.symptoms.length > 0) {
    return checkIn.extracted.symptoms[0].term;
  }
  if (checkIn.extracted.medicationTaken === "no") return "skipped";
  return "normal";
}

function summarizeMonth(
  verdicts: Map<string, EscalationDecision["level"]>,
): string {
  if (verdicts.size === 0) return "No check-ins this month.";
  let escalates = 0;
  let monitors = 0;
  for (const level of verdicts.values()) {
    if (level === "escalate") escalates++;
    else if (level === "monitor") monitors++;
  }
  if (escalates > 0) {
    return `${escalates} day${escalates === 1 ? "" : "s"} needed attention this month.`;
  }
  if (monitors > 0) {
    return `${monitors} day${monitors === 1 ? "" : "s"} worth watching this month.`;
  }
  return `${verdicts.size} quiet day${verdicts.size === 1 ? "" : "s"} this month.`;
}

// Returns 7-column cells covering one calendar month. null = padding (before
// the 1st or after the last day so the grid stays aligned to Sun…Sat columns).
// Strings = ISO day keys (YYYY-MM-DD). All math is UTC so it stays in sync
// with the seeded timestamps regardless of the viewer's local time zone.
function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const leading = firstOfMonth.getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

function monthFromIso(iso: string): { year: number; month: number } {
  return {
    year: parseInt(iso.slice(0, 4), 10),
    month: parseInt(iso.slice(5, 7), 10) - 1,
  };
}

function monthCompare(
  a: { year: number; month: number },
  b: { year: number; month: number },
): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// Shared form bits — used by AddMedicationForm and AddCareTeamForm. Inputs
// match the same warm card styling as the rest of the app; submit stays
// disabled until the name is non-empty (the only required field per spec).
// ─────────────────────────────────────────────────────────────────────────────

const todayIso = new Date().toISOString().slice(0, 10);

const inputClass =
  "w-full rounded-xl border border-edge bg-paper px-3 py-2 text-sm text-ink-deep placeholder:text-ink-quiet focus:outline-none focus:border-clay/60 focus:ring-2 focus:ring-clay/15 transition-colors";

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink-quiet mb-1.5">
        {label}
        {required && <span className="ml-1 text-clay/70">*</span>}
      </div>
      {children}
    </div>
  );
}

function FormActions({
  onCancel,
  submitLabel,
  canSubmit,
}: {
  onCancel: () => void;
  submitLabel: string;
  canSubmit: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-4 border-t border-edge">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-edge bg-paper px-4 py-2 text-sm text-ink-deep hover:border-clay/40 hover:bg-clay-soft/30 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-full bg-clay px-6 py-2 text-sm font-medium text-cream hover:bg-clay-deep disabled:bg-ink-quiet/40 disabled:cursor-not-allowed transition-colors"
      >
        {submitLabel}
      </button>
    </div>
  );
}


// Medications view — read-only cards for the regimen, sorted newest-started
// first so the recent additions (Amlodipine + Lisinopril) lead. Reads
// medications straight from useProfile(); no mutations yet.
function MedicationsView() {
  const { profile, addMedication } = useProfile();
  const [adding, setAdding] = useState(false);

  const meds = useMemo(
    () =>
      [...profile.medications].sort((a, b) =>
        b.startedOn.localeCompare(a.startedOn),
      ),
    [profile.medications],
  );

  return (
    <>
      <div className="text-sm text-ink-quiet mb-1">Medications</div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
          Mom&rsquo;s regimen.
        </h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-full bg-clay px-4 py-2 text-sm font-medium text-cream hover:bg-clay-deep transition-colors"
          >
            + Add medication
          </button>
        )}
      </div>
      <p className="mt-2 text-ink-soft text-sm md:text-base leading-relaxed max-w-xl">
        {meds.length} active medications, newest started first.
      </p>

      <div className="mt-8 space-y-5">
        {adding && (
          <AddMedicationForm
            onSubmit={(med) => {
              addMedication(med);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {meds.map((med) => (
          <MedicationCard key={med.id} med={med} />
        ))}
      </div>
    </>
  );
}

function AddMedicationForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (med: Medication) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [purpose, setPurpose] = useState("");
  const [schedule, setSchedule] = useState("");
  const [directions, setDirections] = useState("");
  const [withFood, setWithFood] = useState(false);
  const [sideEffectsRaw, setSideEffectsRaw] = useState("");
  const [startedOn, setStartedOn] = useState(todayIso);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSubmit = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      id: `med-custom-${Date.now()}`,
      name: name.trim(),
      dose: dose.trim(),
      purpose: purpose.trim(),
      schedule: schedule.trim(),
      directions: directions.trim(),
      withFood,
      commonSideEffects: sideEffectsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      startedOn,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-clay/30 bg-paper p-6 md:p-7 space-y-4"
    >
      <div className="text-xs uppercase tracking-[0.22em] text-clay font-medium">
        New medication
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Name" required>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amlodipine"
            className={inputClass}
          />
        </FormField>
        <FormField label="Dose">
          <input
            type="text"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="e.g. 5 mg"
            className={inputClass}
          />
        </FormField>
      </div>

      <FormField label="Purpose">
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. Lowers blood pressure"
          className={inputClass}
        />
      </FormField>

      <FormField label="Schedule">
        <input
          type="text"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="e.g. Once daily, morning"
          className={inputClass}
        />
      </FormField>

      <FormField label="Directions">
        <textarea
          value={directions}
          onChange={(e) => setDirections(e.target.value)}
          placeholder="e.g. Take one tablet by mouth each morning."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </FormField>

      <FormField label="Common side effects">
        <input
          type="text"
          value={sideEffectsRaw}
          onChange={(e) => setSideEffectsRaw(e.target.value)}
          placeholder="comma-separated, e.g. dizziness, headache"
          className={inputClass}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
        <FormField label="Started on">
          <input
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-ink-deep cursor-pointer py-2">
          <input
            type="checkbox"
            checked={withFood}
            onChange={(e) => setWithFood(e.target.checked)}
            className="w-4 h-4 rounded border-edge accent-clay"
          />
          Take with food
        </label>
      </div>

      <FormActions
        onCancel={onCancel}
        submitLabel="Add medication"
        canSubmit={canSubmit}
      />
    </form>
  );
}

function MedicationCard({ med }: { med: Medication }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `med-panel-${med.id}`;

  return (
    <article className="rounded-2xl border border-edge bg-paper overflow-hidden">
      {/* Always-visible header: name + dose + one-line purpose. The whole row
          is a button so keyboard and screen-reader users can toggle too. */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full text-left p-6 md:p-7 hover:bg-cream/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-xl md:text-2xl leading-snug text-ink-deep">
              {med.name}{" "}
              <span className="text-ink-soft font-normal">{med.dose}</span>
            </h2>
            <p className="mt-1 text-sm text-ink-soft leading-relaxed">
              {med.purpose}
            </p>
          </div>
          <Icon
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            className={`mt-2 text-ink-quiet shrink-0 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Collapsible panel — animates via grid-template-rows 0fr ↔ 1fr so we
          get a smooth height transition without measuring the DOM. The inner
          overflow-hidden is what makes the clipping work at 0fr. */}
      <div
        id={panelId}
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="px-6 md:px-7 pb-6 md:pb-7 pt-5 border-t border-edge space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-ink-quiet mb-1.5">
                  Schedule
                </div>
                <p className="text-ink-soft leading-relaxed text-sm">
                  {med.schedule}
                </p>
              </div>
              {med.withFood && (
                <span className="shrink-0 text-[10px] uppercase tracking-widest text-sage bg-sage-soft border border-sage/30 px-2.5 py-1 rounded-full font-medium">
                  With food
                </span>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-ink-quiet mb-1.5">
                Directions
              </div>
              <p className="text-ink-soft leading-relaxed text-sm">
                {med.directions}
              </p>
            </div>

            {med.commonSideEffects.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-widest text-ink-quiet mb-2">
                  Common side effects
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {med.commonSideEffects.map((s, i) => (
                    <li
                      key={i}
                      className="text-xs text-ink-soft bg-edge/40 px-2.5 py-1 rounded-full"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-edge text-xs text-ink-quiet">
              Started {prettyDate(med.startedOn)}{" "}
              <span className="text-ink-quiet/70">
                · {relativeAge(med.startedOn)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// Relative-age phrasing for the "started …" line. Coarse on purpose — users
// want "6 months ago", not "183 days ago".
function relativeAge(startedOn: string): string {
  const start = new Date(`${startedOn}T00:00:00Z`).getTime();
  const days = Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  if (days < 730) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// Care Team view — read-only cards per clinician. Each card carries an
// "Upcoming" badge when profile.appointments has a future visit booked with
// that doctor (matched by name). Today (demo) is 2026-05-24, so Dr. Yamamoto's
// 2026-05-26 cardiology follow-up surfaces here next to the recent dizziness.
function CareTeamView() {
  const { profile, addCareTeamMember } = useProfile();
  const [adding, setAdding] = useState(false);

  // Soonest upcoming appointment per doctor name. We match on doctorName
  // since CareTeamMember and Appointment don't share an id; the seed keeps
  // these spellings in sync.
  const upcomingByName = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const m = new Map<string, Appointment>();
    const futures = profile.appointments
      .filter((a) => a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const a of futures) {
      if (!m.has(a.doctorName)) m.set(a.doctorName, a);
    }
    return m;
  }, [profile.appointments]);

  return (
    <>
      <div className="text-sm text-ink-quiet mb-1">Care Team</div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
          Mom&rsquo;s circle of care.
        </h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-full bg-clay px-4 py-2 text-sm font-medium text-cream hover:bg-clay-deep transition-colors"
          >
            + Add care team member
          </button>
        )}
      </div>
      <p className="mt-2 text-ink-soft text-sm md:text-base leading-relaxed max-w-xl">
        {profile.careTeam.length} clinicians on call.
      </p>

      <div className="mt-8 space-y-5">
        {adding && (
          <AddCareTeamForm
            onSubmit={(m) => {
              addCareTeamMember(m);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {profile.careTeam.map((member) => (
          <CareTeamCard
            key={member.id}
            member={member}
            upcoming={upcomingByName.get(member.name) ?? null}
          />
        ))}
      </div>
    </>
  );
}

function AddCareTeamForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (m: CareTeamMember) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [lastVisit, setLastVisit] = useState(todayIso);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSubmit = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      id: `care-custom-${Date.now()}`,
      name: name.trim(),
      role: role.trim(),
      phone: phone.trim(),
      lastVisit,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-clay/30 bg-paper p-6 md:p-7 space-y-4"
    >
      <div className="text-xs uppercase tracking-[0.22em] text-clay font-medium">
        New care team member
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Name" required>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dr. Aiko Tanaka"
            className={inputClass}
          />
        </FormField>
        <FormField label="Role">
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Cardiologist"
            className={inputClass}
          />
        </FormField>
        <FormField label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +1-555-555-5555"
            className={inputClass}
          />
        </FormField>
        <FormField label="Last visit">
          <input
            type="date"
            value={lastVisit}
            onChange={(e) => setLastVisit(e.target.value)}
            className={inputClass}
          />
        </FormField>
      </div>

      <FormActions
        onCancel={onCancel}
        submitLabel="Add care team member"
        canSubmit={canSubmit}
      />
    </form>
  );
}

function CareTeamCard({
  member,
  upcoming,
}: {
  member: CareTeamMember;
  upcoming: Appointment | null;
}) {
  return (
    <article className="rounded-2xl border border-edge bg-paper p-6 md:p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-serif text-xl md:text-2xl leading-snug text-ink-deep">
            {member.name}
          </h2>
          <div className="mt-1 text-sm text-ink-soft">{member.role}</div>
        </div>
        {upcoming && (
          <span className="shrink-0 text-[10px] uppercase tracking-widest text-clay-deep bg-clay-soft border border-clay/30 px-2.5 py-1 rounded-full font-medium">
            Upcoming: {prettyDate(upcoming.date)}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-widest text-ink-quiet mb-1">
            Phone
          </dt>
          <dd>
            <a
              href={`tel:${member.phone.replace(/[^+\d]/g, "")}`}
              className="text-ink-deep hover:text-clay-deep transition-colors tabular-nums"
            >
              {member.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-ink-quiet mb-1">
            Last visit
          </dt>
          <dd className="text-ink-deep">{prettyDate(member.lastVisit)}</dd>
        </div>
      </dl>
    </article>
  );
}

// Trends view — month-by-month verdict counts over the seeded year, plus a
// short list of patterns derived from the same decide() pipeline that scores
// individual check-ins. No new rule logic, no LLM, no heavy chart library —
// just inline-styled <div> bars and a couple of named aggregators.
function TrendsView() {
  const { profile } = useProfile();

  const months = useMemo(
    () => buildMonthlyBuckets(profile.checkInHistory),
    [profile.checkInHistory],
  );
  const patterns = useMemo(
    () => derivePatterns(profile.checkInHistory),
    [profile.checkInHistory],
  );
  const maxTotal = useMemo(
    () => Math.max(1, ...months.map((m) => m.total)),
    [months],
  );

  return (
    <>
      <div className="text-sm text-ink-quiet mb-1">Trends</div>
      <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
        Mom&rsquo;s year at a glance.
      </h1>
      <p className="mt-2 text-ink-soft text-sm md:text-base leading-relaxed max-w-xl">
        {months.length}{" "}months of check-ins, scored by the same rules engine that ran today&rsquo;s.
      </p>

      <div className="mt-8">
        <Section label="Each month">
          <MonthlyBarStrip months={months} maxTotal={maxTotal} />
        </Section>
      </div>

      <div className="mt-10">
        <Section label="Patterns noticed">
          <ul className="space-y-2">
            {patterns.map((p, i) => (
              <li key={i} className="text-ink-soft leading-relaxed">
                <span className="mr-2 text-clay/70">·</span>
                {p}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

interface MonthBucket {
  key: string; // YYYY-MM
  year: number;
  month: number; // 0-11
  label: string; // e.g. "May '25" or "Jun"
  escalate: number;
  monitor: number;
  fine: number;
  total: number;
}

function MonthlyBarStrip({
  months,
  maxTotal,
}: {
  months: MonthBucket[];
  maxTotal: number;
}) {
  const BAR_PX = 96; // height the tallest month occupies

  return (
    <div className="rounded-2xl border border-edge bg-paper p-6 md:p-7">
      <div
        className="flex items-end gap-1.5"
        style={{ height: `${BAR_PX}px` }}
      >
        {months.map((m) => {
          const esc = (m.escalate / maxTotal) * BAR_PX;
          const mon = (m.monitor / maxTotal) * BAR_PX;
          const fin = (m.fine / maxTotal) * BAR_PX;
          const fineOnly = esc === 0 && mon === 0;
          return (
            <div
              key={m.key}
              className="flex-1 min-w-0 flex flex-col justify-end"
              title={`${m.label.replace(/ '\d{2}$/, "")} ${m.year}: ${m.escalate} escalate · ${m.monitor} monitor · ${m.fine} fine`}
            >
              {esc > 0 && (
                <div
                  className="w-full bg-clay rounded-t-sm"
                  style={{ height: `${esc}px` }}
                />
              )}
              {mon > 0 && (
                <div
                  className={`w-full bg-stone-warm/75 ${esc === 0 ? "rounded-t-sm" : ""}`}
                  style={{ height: `${mon}px` }}
                />
              )}
              {fin > 0 && (
                <div
                  className={`w-full bg-stone-warm/25 ${fineOnly ? "rounded-t-sm" : ""}`}
                  style={{ height: `${fin}px` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {months.map((m) => (
          <div
            key={m.key}
            className="flex-1 min-w-0 text-[9px] text-center text-ink-quiet tabular-nums whitespace-nowrap overflow-hidden"
          >
            {m.label}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft">
        <LegendSwatch className="bg-clay" label="Escalate" />
        <LegendSwatch className="bg-stone-warm/75" label="Monitor" />
        <LegendSwatch className="bg-stone-warm/25" label="Fine" />
      </div>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function buildMonthlyBuckets(history: CheckIn[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const ci of history) {
    const key = ci.timestamp.slice(0, 7);
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        year: +key.slice(0, 4),
        month: +key.slice(5, 7) - 1,
        label: "",
        escalate: 0,
        monitor: 0,
        fine: 0,
        total: 0,
      };
      map.set(key, b);
    }
    const level = decide(ci, baseline).level;
    if (level === "escalate") b.escalate++;
    else if (level === "monitor") b.monitor++;
    else b.fine++;
    b.total++;
  }
  const sorted = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  // Show year on the first bucket and whenever the year rolls over so a
  // 13-month strip ("May '25 … May '26") stays unambiguous.
  let prevYear = -1;
  for (const b of sorted) {
    b.label =
      b.year === prevYear
        ? SHORT_MONTH_NAMES[b.month]
        : `${SHORT_MONTH_NAMES[b.month]} '${String(b.year).slice(2)}`;
    prevYear = b.year;
  }
  return sorted;
}

// "Patterns noticed" — short, derived from the same decide() pipeline so the
// numbers always match the History calendar and the Trends bar strip. Each
// pattern is a complete sentence so they render straight into a list.
function derivePatterns(history: CheckIn[]): string[] {
  const out: string[] = [];

  const episodes = countMedRelatedEpisodes(history);
  if (episodes > 0) {
    out.push(
      `${episodes} medication-related episode${episodes === 1 ? "" : "s"} flagged in the past year.`,
    );
  }

  const top = mostCommonSymptom(history);
  if (top) {
    out.push(
      `Most-mentioned symptom: ${top.term} (${top.count} mention${top.count === 1 ? "" : "s"}).`,
    );
  }

  let fine = 0;
  let total = 0;
  for (const ci of history) {
    const level = decide(ci, baseline).level;
    if (level === "fine") fine++;
    total++;
  }
  if (total > 0) {
    const pct = Math.round((fine / total) * 100);
    out.push(`${pct}% of days were quiet — no symptoms, no missed doses.`);
  }

  return out;
}

// Count distinct medication-onset episodes: each is a cluster of
// `newSymptomAfterMedChange` escalates separated from the previous one by
// more than 14 days. Lisinopril-onset (Nov 2025) + Amlodipine-onset (May
// 2026) → 2 in the seeded year.
function countMedRelatedEpisodes(history: CheckIn[]): number {
  const dayMs = 24 * 60 * 60 * 1000;
  let count = 0;
  let lastTime: number | null = null;
  for (const ci of history) {
    const decision = decide(ci, baseline);
    if (!decision.triggeredRules.includes("newSymptomAfterMedChange")) continue;
    const t = new Date(ci.timestamp).getTime();
    if (lastTime === null || t - lastTime > 14 * dayMs) count++;
    lastTime = t;
  }
  return count;
}

function mostCommonSymptom(
  history: CheckIn[],
): { term: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const ci of history) {
    for (const s of ci.extracted.symptoms) {
      counts.set(s.term, (counts.get(s.term) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  let bestTerm = "";
  let bestCount = 0;
  counts.forEach((c, t) => {
    if (c > bestCount) {
      bestTerm = t;
      bestCount = c;
    }
  });
  return { term: bestTerm, count: bestCount };
}

// Right insight panel: verdict card + needs clarification
function RightPanel({ result }: { result: ApiResponse }) {
 const { checkIn, decision } = result;
 const v = VERDICTS[decision.level];


 return (
   <div className="space-y-6">
     <div className="text-[11px] uppercase tracking-[0.2em] text-ink-quiet font-medium">
       Today&rsquo;s insight
     </div>


     {/* Verdict card */}
     <div className={`rounded-2xl ${v.bg} ring-1 ${v.ring} overflow-hidden`}>
       <div className="flex">
         <div className={`w-1.5 ${v.bar} shrink-0`} />
         <div className="flex-1 p-5">
           <div className={`text-[10px] uppercase tracking-[0.22em] font-medium ${v.ink}`}>
             {v.tag}
           </div>
           <h2 className={`mt-2 font-serif text-2xl leading-snug ${v.ink}`}>
             {v.phrase}
           </h2>
           {decision.reasons.length > 0 && (
             <div className="mt-4">
               <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-2">
                 Because
               </div>
               <ul className="space-y-1.5 text-ink-soft text-sm">
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


     {/* Needs clarification */}
     {checkIn.ambiguity.length > 0 && (
       <div>
         <div className="text-[11px] uppercase tracking-[0.2em] text-ink-quiet font-medium mb-3">
           Needs clarification
         </div>
         <div className="space-y-3">
           {checkIn.ambiguity.map((a, i) => (
             <div
               key={i}
               className="rounded-xl bg-amber-bg/60 border border-amber-warm/25 p-4"
             >
               <div className="font-serif text-lg text-amber-deep" lang={checkIn.language}>
                 &ldquo;{a.phrase}&rdquo;
               </div>
               <div className="mt-2.5">
                 <div className="text-[10px] uppercase tracking-widest text-amber-warm">
                   Could mean
                 </div>
                 <ul className="mt-1 text-ink-soft text-xs space-y-0.5">
                   {a.couldMean.map((c, j) => (
                     <li key={j}>
                       <span className="mr-1.5 text-amber-warm/60">·</span>
                       {c}
                     </li>
                   ))}
                 </ul>
               </div>
               <div className="mt-3 pt-3 border-t border-amber-warm/20">
                 <div className="text-[10px] uppercase tracking-widest text-amber-warm mb-1">
                   Ask her
                 </div>
                 <p className="text-ink-deep text-sm leading-relaxed">{a.followUp}</p>
               </div>
             </div>
           ))}
         </div>
       </div>
     )}
   </div>
 );
}


function BriefCard({ result }: { result: ApiResponse }) {
 const { brief } = result;
 return (
   <Section label="What her doctor should know">
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
     className="rounded-full border border-edge bg-paper px-4 py-2 text-sm text-ink-deep hover:border-clay/40 hover:bg-clay-soft/30 transition-colors"
   >
     {copied ? "Copied" : "Copy summary"}
   </button>
 );
}


function PrintButton() {
 return (
   <button
     onClick={() => window.print()}
     className="rounded-full border border-edge bg-paper px-4 py-2 text-sm text-ink-deep hover:border-clay/40 hover:bg-clay-soft/30 transition-colors"
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
     <div className="text-xs uppercase tracking-[0.22em] text-clay font-medium mb-4">
       {label}
     </div>
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
   <section className="mt-8 pb-6 border-b border-edge">
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
