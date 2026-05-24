"use client";


import { useEffect, useMemo, useState } from "react";
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
 { id: "trends", label: "Trends", clickable: false },
 { id: "medications", label: "Medications", clickable: false },
 { id: "careteam", label: "Care Team", clickable: false },
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


     {/* Language selector — non-interactive placeholders (i18n not yet wired) */}
     <div className="px-4 pb-5 pt-3 border-t border-edge">
       <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-2">Language</div>
       <div className="flex gap-1.5">
         <div className="flex-1 text-xs py-1.5 rounded-lg bg-clay text-cream font-medium text-center select-none">
           EN
         </div>
         <div className="flex-1 text-xs py-1.5 rounded-lg border border-edge text-ink-quiet text-center select-none">
           日本語
         </div>
       </div>
     </div>
   </aside>
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


               {/* Controls */}
               <div className="mt-8 print:hidden">
                 <Controls
                   transcript={transcript}
                   setTranscript={setTranscript}
                   loading={loading}
                   onSeeded={runSeeded}
                   onAnalyze={() => analyze(transcript)}
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
}: {
 transcript: string;
 setTranscript: (s: string) => void;
 loading: boolean;
 onSeeded: (id: ScenarioId) => void;
 onAnalyze: () => void;
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


// History view — reverse-chronological list of every past check-in. Verdict
// dot per row uses the same decide() rules engine the live check-in uses; the
// rules engine is the single source of truth for level coloring.
function HistoryView() {
 const { profile } = useProfile();
 const rows = useMemo(
   () =>
     [...profile.checkInHistory].reverse().map((ci) => ({
       ci,
       level: decide(ci, baseline).level,
     })),
   [profile.checkInHistory],
 );


 return (
   <>
     <div className="text-sm text-ink-quiet mb-1">History</div>
     <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
       Mom&rsquo;s past check-ins.
     </h1>
     <p className="mt-2 text-ink-soft text-sm md:text-base leading-relaxed max-w-xl">
       {rows.length} days, newest first. The verdict dot reflects the rules engine.
     </p>


     <div className="mt-8 -mx-3">
       {rows.map(({ ci, level }) => (
         <HistoryRow key={ci.id} checkIn={ci} level={level} />
       ))}
     </div>
   </>
 );
}


function HistoryRow({
 checkIn,
 level,
}: {
 checkIn: CheckIn;
 level: EscalationDecision["level"];
}) {
 const escalate = level === "escalate";
 const symptoms = checkIn.extracted.symptoms;
 const summary =
   symptoms.length > 0
     ? symptoms
         .map((s) => (s.isNew ? `${s.term} (new)` : s.term))
         .join(", ")
     : truncate(checkIn.translatedTranscript, 90);


 return (
   <div
     className={`flex items-start gap-4 px-3 py-3 border-b border-edge/60 ${
       escalate ? "bg-clay-soft/40" : ""
     }`}
   >
     <div className="pt-1.5">
       <Dot level={level} />
     </div>
     <div className="w-24 shrink-0 text-xs text-ink-quiet tabular-nums pt-0.5">
       {longDate(checkIn.timestamp)}
     </div>
     <div className="flex-1 min-w-0">
       <div
         className={`text-sm leading-relaxed ${
           escalate ? "text-clay-deep font-medium" : "text-ink-soft"
         }`}
       >
         {summary}
       </div>
       <div className="text-[11px] text-ink-quiet mt-0.5">
         {checkIn.medContext.name} &middot; day {checkIn.medContext.dayOfChange}
       </div>
     </div>
   </div>
 );
}


function truncate(s: string, n: number): string {
 return s.length <= n ? s : s.slice(0, n - 1) + "…";
}


function longDate(iso: string): string {
 const d = new Date(iso);
 const y = d.getUTCFullYear();
 const m = String(d.getUTCMonth() + 1).padStart(2, "0");
 const day = String(d.getUTCDate()).padStart(2, "0");
 return `${y}-${m}-${day}`;
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
