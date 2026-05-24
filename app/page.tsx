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
import type { Appointment, CareTeamMember, Medication, Profile } from "@/profile";
import { generateSuggestions, type Suggestion } from "@/suggestions";
import { findEpisodes, type Episode } from "@/recovery";
import { CuraphiMark } from "@/components/CuraphiMark";


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

// Small filled heart. Sits on the cap-line of surrounding copy. Uses an
// inline style so it stays on the warm brand palette without depending on
// Tailwind's default red ramp.
function HeartIcon({ className = "w-3 h-3" }: { className?: string }) {
 return (
   <svg
     className={`${className} shrink-0`}
     viewBox="0 0 24 24"
     fill="currentColor"
     style={{ color: "#C24F4F" }}
     aria-hidden="true"
   >
     <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.003-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
   </svg>
 );
}

// Stroke icons reused across the check-in view. Each wraps a single SVG path
// in `currentColor` so the parent's `text-…` class controls the tone.
function PhoneIcon({ className = "w-4 h-4" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
     <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
   </svg>
 );
}

function LightbulbIcon({ className = "w-4 h-4" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
     <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
   </svg>
 );
}

function MicIcon({ className = "w-4 h-4" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
     <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
   </svg>
 );
}

function KeyboardIcon({ className = "w-4 h-4" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
     <rect x="3" y="7" width="18" height="10" rx="1.75" />
     <path strokeLinecap="round" d="M7 11h.5M11 11h.5M15 11h.5M7 14h10" />
   </svg>
 );
}

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
     <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
   </svg>
 );
}

// Heroicons user-circle, used by the profile bubble next to the greeting.
function UserIcon({ className = "w-4 h-4" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
     <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
   </svg>
 );
}

// Stylized two-turn inward spiral. Reads as motion/dizziness without needing
// a literal vertigo metaphor.
function SpiralIcon({ className = "w-5 h-5" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
     <path d="M5 12a4 4 0 0 1 8 0 a3 3 0 0 1 -6 0 a2 2 0 0 1 4 0 a1 1 0 0 1 -2 0" />
   </svg>
 );
}

// Orthopedic joint: a femoral condyle (rounded bottom of the upper bone), a
// tibial plateau (flat top of the lower bone) facing it, and a thin cartilage
// band running through the joint space. Reads as a medical joint diagram even
// at small sizes.
function JointIcon({ className = "w-5 h-5" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
     {/* Upper bone — vertical shaft narrowing to a rounded condyle */}
     <path d="M9 3 v6 q0 2 3 2 q3 0 3 -2 v-6" />
     {/* Lower bone — flat tibial plateau with slight side ridges, shaft below */}
     <path d="M7.5 14 h9 M9 14 q0 -1 3 -1 q3 0 3 1 M9 14 v7 M15 14 v7" />
     {/* Cartilage band running through the joint space */}
     <path d="M7 12 h10" strokeDasharray="1.5 1.5" opacity="0.7" />
   </svg>
 );
}

// Filled medical cross — used only by the Medications nav slot. Filled
// (not stroked) so it reads as a proper Red-Cross symbol; inherits color via
// `currentColor`, so the parent controls the clay tint.
function MedicalCrossIcon({ className = "w-4 h-4" }: { className?: string }) {
 return (
   <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
     <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />
   </svg>
 );
}

// Small filled "i" badge in a soft sky-blue. Inline style keeps the muted-
// healthcare blue without adding a Tailwind color or extending the theme.
function InfoBadge({ className = "" }: { className?: string }) {
 return (
   <span
     aria-hidden="true"
     className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold leading-none shrink-0 ${className}`}
     style={{ backgroundColor: "#7FA9C7", color: "#FFFFFF" }}
   >
     i
   </span>
 );
}


type NavItemId = "checkin" | "history" | "trends" | "medications" | "careteam";


const NAV_ICONS: Record<NavItemId, string> = {
 checkin:
   "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75",
 history: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
 trends: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
 medications:
   "M3 8H21a4 4 0 0 1 0 8H3a4 4 0 0 1 0 -8zM12 8V16",
 careteam:
   "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
};


const NAV_ITEMS: { id: NavItemId; label: string; clickable: boolean }[] = [
 { id: "checkin", label: "Check-in", clickable: true },
 { id: "history", label: "History", clickable: true },
 { id: "trends", label: "Trends", clickable: true },
 { id: "medications", label: "Medications", clickable: true },
 { id: "careteam", label: "Care Team", clickable: true },
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
         <CuraphiMark className="h-11 w-auto shrink-0" title="" />
         <div className="min-w-0">
           <div className="text-ink-deep font-serif text-base leading-none tracking-tight">CuraPhi</div>
           <div className="text-[10px] text-ink-quiet mt-1 leading-tight">Bringing words. Caring better.</div>
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
             {item.id === "medications" ? (
               <MedicalCrossIcon
                 className={`w-4 h-4 ${
                   isActive
                     ? "text-clay"
                     : item.clickable
                       ? "text-ink-quiet"
                       : "text-ink-quiet/50"
                 }`}
               />
             ) : (
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
             )}
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
         <div className="text-[10px] uppercase tracking-widest text-sage font-semibold mb-1.5 inline-flex items-center gap-1.5">
           <InfoBadge />
           Quick Tip
         </div>
         <p className="text-xs text-ink-soft leading-relaxed">
           Check in daily at the same time for the most consistent insights.
         </p>
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

 // Deterministic rules over useProfile() data — no LLM, no API call. Runs
 // once per profile change. Surfaces 3–4 prompts above the check-in controls.
 const suggestions = useMemo(() => generateSuggestions(profile), [profile]);

 // Ref the textarea so clicking a suggestion can focus + scroll the caregiver
 // straight to the prefilled note for editing.
 const transcriptRef = useRef<HTMLTextAreaElement>(null);

 function pickSuggestion(s: Suggestion) {
   // Cached path — same shape as the seeded buttons. Fires when the
   // suggestion declares a cacheKey, demo-cache.json has that entry, and
   // we're not in ?live=1. Otherwise we fall through to the live-prefill
   // path so the caregiver can edit and hit Analyze themselves.
   const cached =
     s.cacheKey && !liveMode
       ? (demoCache as Record<string, ApiResponse>)[s.cacheKey]
       : undefined;
   if (cached) {
     setError(null);
     setResult(null);
     setLoading(true);
     setTimeout(() => {
       setResult(cached);
       setLoading(false);
     }, SEEDED_DELAY_MS);
     return;
   }

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
               {/* Greeting + Mom's Profile bubble (across-from layout) */}
               <div className="flex items-center justify-between gap-3 mb-1">
                 <div className="text-sm text-ink-quiet">
                   {greeting}, {profile.caregiverName}
                 </div>
                 <ProfileBubble />
               </div>


               {/* Main heading — heart renders as inline punctuation after "Mom" */}
               <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
                 Today&rsquo;s check-in with Mom<HeartIcon className="w-3.5 h-3.5 md:w-4 md:h-4 inline-block ml-1 align-baseline" />
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
        Today, you might check on<span className="tracking-[0.4em] ml-0.5">...</span>
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

// Rounded pill on the right of the greeting line — premium quick-access feel.
// Rendered as a button so it picks up cursor + hover affordance; click is a
// no-op for now (no profile screen wired yet) per spec.
function ProfileBubble() {
  return (
    <button
      type="button"
      className="shrink-0 inline-flex items-center gap-2 rounded-full border border-edge bg-paper/80 px-3 py-1.5 text-xs text-ink-soft hover:border-clay/40 hover:text-ink-deep transition-colors"
    >
      <UserIcon className="w-4 h-4 text-sage" />
      <span>Mom&rsquo;s Profile</span>
    </button>
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
 // Feature-detect SpeechRecognition. We optimistically render the Voice pill
 // as enabled during SSR + initial client render (so there's no hydration
 // flicker), then disable it after mount if the API isn't there.
 const [voiceSupported, setVoiceSupported] = useState(true);
 const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening">("idle");
 const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
 // Snapshot of the textarea contents at the moment Voice was clicked, so the
 // dictated text appends to (rather than replaces) anything already typed.
 const voiceBaseRef = useRef("");

 useEffect(() => {
   if (typeof window === "undefined") return;
   setVoiceSupported(!!getSpeechRecognitionCtor());
 }, []);

 // If Controls unmounts mid-dictation (e.g. user navigates away), stop the
 // recognizer so the mic indicator doesn't get stuck.
 useEffect(() => {
   return () => {
     try {
       recognitionRef.current?.stop?.();
     } catch {}
   };
 }, []);

 function toggleVoice() {
   if (!voiceSupported) return;
   if (voiceStatus === "listening") {
     try {
       recognitionRef.current?.stop?.();
     } catch {}
     return;
   }
   const Ctor = getSpeechRecognitionCtor();
   if (!Ctor) {
     setVoiceSupported(false);
     return;
   }
   const rec = new Ctor();
   rec.lang = "en-US";
   rec.continuous = true;
   rec.interimResults = true;

   voiceBaseRef.current = transcript;

   rec.onresult = (event) => {
     let voiceText = "";
     for (let i = 0; i < event.results.length; i++) {
       voiceText += event.results[i][0].transcript;
     }
     const base = voiceBaseRef.current;
     const sep = base && !/\s$/.test(base) ? " " : "";
     setTranscript(base + sep + voiceText);
   };

   rec.onerror = (e) => {
     // Permission denied, no-speech, network, etc. — fall back to idle.
     // Logging only; no toast/popup so failures stay quiet for the demo.
     console.warn("SpeechRecognition error:", e?.error);
     setVoiceStatus("idle");
     recognitionRef.current = null;
   };

   rec.onend = () => {
     setVoiceStatus("idle");
     recognitionRef.current = null;
   };

   try {
     rec.start();
     setVoiceStatus("listening");
     recognitionRef.current = rec;
   } catch (err) {
     console.warn("Failed to start SpeechRecognition:", err);
     setVoiceStatus("idle");
   }
 }

 return (
   <div className="space-y-5">
     <div className="flex flex-col sm:flex-row gap-3">
       <SeededButton
         disabled={loading}
         onClick={() => onSeeded("dizziness")}
         label="Dizziness check-in"
         sub="JA · dose skipped"
         icon={<SpiralIcon className="w-14 h-14" />}
       />
       <SeededButton
         disabled={loading}
         onClick={() => onSeeded("knee")}
         label="Knee pain check-in"
         sub="JA · after gardening"
         icon={<JointIcon className="w-14 h-14" />}
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
         <div className="flex gap-1.5">
           <InputMethodPill
             label="Type"
             title="Type"
             icon={<KeyboardIcon className="w-4 h-4" />}
             active={voiceStatus !== "listening"}
           />
           <InputMethodPill
             label={voiceStatus === "listening" ? "Listening" : "Voice"}
             icon={<MicIcon className="w-4 h-4" />}
             active={voiceStatus === "listening"}
             onClick={toggleVoice}
             disabled={!voiceSupported}
             title={
               !voiceSupported
                 ? "Voice input isn't supported in this browser"
                 : voiceStatus === "listening"
                   ? "Click to stop listening"
                   : "Click to dictate into the transcript"
             }
             indicator={
               voiceStatus === "listening" ? (
                 <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse" />
               ) : null
             }
           />
         </div>
         <div className="flex-1" />
         <button
           onClick={onAnalyze}
           disabled={loading || !transcript.trim()}
           className="rounded-full bg-clay px-6 py-2 text-sm font-medium text-white hover:bg-clay-deep disabled:bg-ink-quiet/40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
         >
           {loading ? "Analyzing…" : "Analyze"}
           <SparklesIcon className="w-4 h-4" />
         </button>
       </div>
     </div>
   </div>
 );
}

// Minimal structural typing for the Web Speech API so we don't pull in extra
// @types dependencies. Covers only the surface this component touches.
interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}


function InputMethodPill({
  label,
  active,
  onClick,
  disabled,
  title,
  indicator,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  indicator?: React.ReactNode;
  // When provided, the pill shows the icon and keeps `label` only as
  // sr-only text so screen readers still announce "Type" / "Voice".
  icon?: React.ReactNode;
}) {
  const base = `rounded-full px-3 py-1 text-xs border select-none transition-colors inline-flex items-center gap-1.5 ${
    active
      ? "border-clay/40 bg-clay-soft/60 text-clay-deep"
      : "border-edge text-ink-quiet"
  }`;
  const interactive =
    onClick && !disabled ? " hover:border-clay/40 hover:text-ink-deep cursor-pointer" : "";
  const dim = disabled ? " opacity-50 cursor-not-allowed" : "";
  const visual = icon ? (
    <>
      {indicator}
      {icon}
      <span className="sr-only">{label}</span>
    </>
  ) : (
    <>
      {indicator}
      {label}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title ?? label}
        aria-label={label}
        aria-pressed={active}
        className={base + interactive + dim}
      >
        {visual}
      </button>
    );
  }
  return (
    <div className={base} title={title ?? label} aria-label={label} role="img">
      {visual}
    </div>
  );
}


function SeededButton({
 label,
 sub,
 onClick,
 disabled,
 icon,
}: {
 label: string;
 sub: string;
 onClick: () => void;
 disabled?: boolean;
 icon?: React.ReactNode;
}) {
 return (
   <button
     onClick={onClick}
     disabled={disabled}
     className="flex-1 group rounded-2xl border border-edge bg-paper px-5 py-4 text-left hover:border-clay/40 hover:bg-clay-soft/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-3"
   >
     {icon && (
       <span className="shrink-0 text-sage group-hover:text-clay/80 transition-colors">
         {icon}
       </span>
     )}
     <div className="flex-1 min-w-0">
       <div className="text-sm font-medium text-ink-deep group-hover:text-clay-deep transition-colors">
         {label}
       </div>
       <div className="mt-0.5 text-xs uppercase tracking-wider text-ink-quiet">{sub}</div>
     </div>
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
          Medication Summary
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
type TrendsTab = "overview" | "med-response" | "recovery";

function TrendsView() {
  const { profile } = useProfile();
  const [tab, setTab] = useState<TrendsTab>("overview");

  return (
    <>
      <div className="text-sm text-ink-quiet mb-1">Trends</div>
      <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink-deep">
        Mom&rsquo;s year at a glance.
      </h1>
      <p className="mt-2 text-ink-soft text-sm md:text-base leading-relaxed max-w-xl">
        Scored by the same rules engine that ran today&rsquo;s check-in.
      </p>

      <TrendsTabBar tab={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab history={profile.checkInHistory} />}
      {tab === "med-response" && <MedResponseTab profile={profile} />}
      {tab === "recovery" && <RecoveryTab history={profile.checkInHistory} />}
    </>
  );
}

function TrendsTabBar({
  tab,
  onChange,
}: {
  tab: TrendsTab;
  onChange: (t: TrendsTab) => void;
}) {
  const items: { id: TrendsTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "med-response", label: "Medication response" },
    { id: "recovery", label: "Recovery time" },
  ];
  return (
    <div className="mt-7 flex gap-1 border-b border-edge overflow-x-auto">
      {items.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 px-4 py-2 text-sm transition-colors -mb-px ${
              active
                ? "border-b-2 border-clay text-clay-deep font-medium"
                : "border-b-2 border-transparent text-ink-soft hover:text-ink-deep"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function OverviewTab({ history }: { history: CheckIn[] }) {
  const months = useMemo(() => buildMonthlyBuckets(history), [history]);
  const patterns = useMemo(() => derivePatterns(history), [history]);
  const maxTotal = useMemo(
    () => Math.max(1, ...months.map((m) => m.total)),
    [months],
  );

  return (
    <>
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

// ─────────────────────────────────────────────────────────────────────────────
// Medication response tab — pick a med, show ±30 days around its startedOn as
// a horizontal strip of verdict-colored squares. Pre/post tallies make the
// onset-cluster pattern numerically obvious; the bar makes it visually so.
// ─────────────────────────────────────────────────────────────────────────────

const MED_RESPONSE_WINDOW = 30; // days each side of startedOn

function MedResponseTab({ profile }: { profile: Profile }) {
  // Default to the most recently started med — for SEED_MOM that's Amlodipine,
  // which gives the cleanest demo (dizziness right after the start date).
  const medsByRecency = useMemo(
    () =>
      [...profile.medications].sort((a, b) =>
        b.startedOn.localeCompare(a.startedOn),
      ),
    [profile.medications],
  );
  const [selectedMedId, setSelectedMedId] = useState<string>(
    medsByRecency[0]?.id ?? "",
  );
  const med =
    profile.medications.find((m) => m.id === selectedMedId) ??
    medsByRecency[0];

  const data = useMemo(
    () =>
      med
        ? buildMedResponseTimeline(med, profile.checkInHistory)
        : null,
    [med, profile.checkInHistory],
  );

  if (!med || !data) {
    return (
      <div className="mt-8 text-ink-quiet text-sm">No medications to plot.</div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Med selector */}
      <div className="flex flex-wrap gap-2">
        {medsByRecency.map((m) => {
          const active = m.id === selectedMedId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMedId(m.id)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                active
                  ? "bg-clay text-cream font-medium"
                  : "border border-edge text-ink-soft hover:border-clay/40 hover:text-ink-deep"
              }`}
            >
              {m.name}
            </button>
          );
        })}
      </div>

      <p className="text-ink-soft text-sm md:text-base leading-relaxed">
        Symptoms flagged within {MED_RESPONSE_WINDOW} days of starting{" "}
        <span className="font-medium text-ink-deep">
          {med.name} {med.dose}
        </span>
        .
      </p>

      {/* Pre/post comparison — escalate count is the salient signal, with
          total flagged (escalate + monitor) below for context. Highlight the
          post box when escalates went UP after starting the med. */}
      <div className="grid grid-cols-2 gap-3">
        <ResponseStat
          label={`${MED_RESPONSE_WINDOW} days before`}
          escalates={data.preEscalates}
          flagged={data.preFlagged}
          covered={data.preCovered}
        />
        <ResponseStat
          label={`${MED_RESPONSE_WINDOW} days after`}
          escalates={data.postEscalates}
          flagged={data.postFlagged}
          covered={data.postCovered}
          highlight={data.postEscalates > data.preEscalates}
        />
      </div>

      {/* Timeline strip */}
      <div className="rounded-2xl border border-edge bg-paper p-5 md:p-6">
        <div className="h-10 flex items-stretch gap-px">
          {data.days.map((d) => (
            <div
              key={d.dayKey}
              title={`${d.dayKey} · ${d.level ?? "no check-in"}${d.symptomLabel ? ` · ${d.symptomLabel}` : ""}`}
              className={`flex-1 min-w-0 ${dayClass(d.level)} ${d.isStart ? "outline outline-2 outline-clay -outline-offset-1 z-10 relative" : ""}`}
            />
          ))}
        </div>

        {/* Caret under the start day */}
        <div className="mt-1 flex gap-px text-[10px] text-clay-deep">
          {data.days.map((d) => (
            <div key={d.dayKey} className="flex-1 min-w-0 text-center leading-none">
              {d.isStart ? "▲" : ""}
            </div>
          ))}
        </div>

        {/* Axis labels: left edge, start, right edge */}
        <div className="mt-1 flex justify-between text-[10px] text-ink-quiet">
          <span>{shortMd(data.days[0].dayKey)}</span>
          <span className="text-clay-deep font-medium">
            Start: {prettyDate(med.startedOn)}
          </span>
          <span>{shortMd(data.days[data.days.length - 1].dayKey)}</span>
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
          <LegendSwatch className="bg-clay" label="Escalate" />
          <LegendSwatch className="bg-stone-warm/75" label="Monitor" />
          <LegendSwatch className="bg-stone-warm/25" label="Fine" />
          <LegendSwatch className="bg-edge/30" label="No check-in" />
        </div>
      </div>
    </div>
  );
}

function ResponseStat({
  label,
  escalates,
  flagged,
  covered,
  highlight,
}: {
  label: string;
  escalates: number;
  flagged: number;
  covered: number;
  highlight?: boolean;
}) {
  const monitors = flagged - escalates;
  return (
    <div
      className={`rounded-xl border p-4 ${highlight ? "border-clay/40 bg-clay-soft/40" : "border-edge bg-paper"}`}
    >
      <div className="text-[10px] uppercase tracking-widest text-ink-quiet mb-1">
        {label}
      </div>
      <div className={`font-serif text-2xl ${highlight ? "text-clay-deep" : "text-ink-deep"}`}>
        {escalates}
        <span className="text-ink-quiet text-base ml-1">escalate{escalates === 1 ? "" : "s"}</span>
      </div>
      <div className="text-xs text-ink-quiet mt-1">
        {monitors} monitor day{monitors === 1 ? "" : "s"} · {covered} of {MED_RESPONSE_WINDOW} days had check-ins
      </div>
    </div>
  );
}

interface MedTimelineDay {
  dayKey: string;
  isStart: boolean;
  level: "escalate" | "monitor" | "fine" | null;
  symptomLabel: string;
}

interface MedTimeline {
  days: MedTimelineDay[];
  preFlagged: number;
  postFlagged: number;
  preEscalates: number;
  postEscalates: number;
  preCovered: number;
  postCovered: number;
}

function buildMedResponseTimeline(
  med: Medication,
  history: CheckIn[],
): MedTimeline {
  const byDay = new Map<string, CheckIn>();
  for (const ci of history) byDay.set(ci.timestamp.slice(0, 10), ci);

  const startMs = Date.UTC(
    +med.startedOn.slice(0, 4),
    +med.startedOn.slice(5, 7) - 1,
    +med.startedOn.slice(8, 10),
  );
  const dayMs = 24 * 60 * 60 * 1000;

  const days: MedTimelineDay[] = [];
  let preFlagged = 0;
  let preEscalates = 0;
  let preCovered = 0;
  let postFlagged = 0;
  let postEscalates = 0;
  let postCovered = 0;

  for (let offset = -MED_RESPONSE_WINDOW; offset <= MED_RESPONSE_WINDOW; offset++) {
    const t = startMs + offset * dayMs;
    const d = new Date(t);
    const dayKey = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    const ci = byDay.get(dayKey);
    const level = ci ? decide(ci, baseline).level : null;
    const symptomLabel = ci
      ? ci.extracted.symptoms.map((s) => s.term).join(", ")
      : "";
    days.push({ dayKey, isStart: offset === 0, level, symptomLabel });

    if (offset === 0) continue;
    const isFlagged = level === "escalate" || level === "monitor";
    const isEscalate = level === "escalate";
    const covered = ci != null;
    if (offset < 0) {
      if (covered) preCovered++;
      if (isFlagged) preFlagged++;
      if (isEscalate) preEscalates++;
    } else {
      if (covered) postCovered++;
      if (isFlagged) postFlagged++;
      if (isEscalate) postEscalates++;
    }
  }

  return {
    days,
    preFlagged,
    postFlagged,
    preEscalates,
    postEscalates,
    preCovered,
    postCovered,
  };
}

function dayClass(level: "escalate" | "monitor" | "fine" | null): string {
  switch (level) {
    case "escalate":
      return "bg-clay";
    case "monitor":
      return "bg-stone-warm/75";
    case "fine":
      return "bg-stone-warm/25";
    default:
      return "bg-edge/30";
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function shortMd(iso: string): string {
  const m = +iso.slice(5, 7);
  const d = +iso.slice(8, 10);
  return `${SHORT_MONTH_NAMES[m - 1]} ${d}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recovery tab — one row per escalate cluster from recovery.ts. The cluster
// algorithm + recovery-day math live in that module and are unit-tested; this
// component is presentational only.
// ─────────────────────────────────────────────────────────────────────────────

function RecoveryTab({ history }: { history: CheckIn[] }) {
  const episodes = useMemo(
    () => findEpisodes(history, baseline),
    [history],
  );

  const resolved = episodes.filter((e) => e.recoveryDays !== null);
  const avgRecovery =
    resolved.length > 0
      ? Math.round(
          resolved.reduce((s, e) => s + (e.recoveryDays ?? 0), 0) /
            resolved.length,
        )
      : null;
  const ongoingCount = episodes.length - resolved.length;

  return (
    <div className="mt-8 space-y-5">
      <p className="text-ink-soft text-sm md:text-base leading-relaxed">
        {avgRecovery !== null ? (
          <>
            Average recovery:{" "}
            <span className="font-medium text-ink-deep">
              {avgRecovery} day{avgRecovery === 1 ? "" : "s"}
            </span>{" "}
            across {resolved.length} resolved episode
            {resolved.length === 1 ? "" : "s"}
            {ongoingCount > 0 ? `, ${ongoingCount} ongoing.` : "."}
          </>
        ) : (
          <>No fully recovered episodes yet.</>
        )}
      </p>

      {episodes.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-paper p-6 text-sm text-ink-quiet">
          No escalate episodes in this history.
        </div>
      ) : (
        <div className="rounded-2xl border border-edge bg-paper overflow-hidden">
          {episodes.map((ep) => (
            <RecoveryRow key={ep.id} episode={ep} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecoveryRow({ episode }: { episode: Episode }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-edge/60 last:border-b-0">
      <div className="pt-1.5">
        <Dot level="escalate" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-ink-deep font-medium leading-tight">
          {episode.cause}
        </div>
        {episode.symptoms.length > 0 && (
          <div className="text-xs text-ink-quiet mt-0.5">
            {episode.symptoms.join(", ")}
          </div>
        )}
        <div className="text-xs text-ink-quiet mt-1 tabular-nums">
          Started {prettyDate(episode.startIso)} ·{" "}
          {episode.flaggedDays} flagged day{episode.flaggedDays === 1 ? "" : "s"}
        </div>
      </div>
      <div className="shrink-0 text-right w-28">
        {episode.ongoing ? (
          <span className="inline-block text-[10px] uppercase tracking-widest font-medium text-clay-deep bg-clay-soft border border-clay/30 px-2.5 py-1 rounded-full">
            Ongoing
          </span>
        ) : (
          <>
            <div className="font-serif text-2xl text-ink-deep tabular-nums leading-none">
              {episode.recoveryDays}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-ink-quiet mt-1">
              days to recovery
            </div>
          </>
        )}
      </div>
    </div>
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
           <div className="flex items-start justify-between gap-3">
             <div className={`text-[10px] uppercase tracking-[0.22em] font-medium ${v.ink}`}>
               {v.tag}
             </div>
             {decision.level === "escalate" && (
               <PhoneIcon className="w-5 h-5 text-clay" />
             )}
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


     {/* Needs clarification — mirrors the Recommended Follow-up card shape:
         rounded-2xl shell + colored side bar + flex p-5 with a header row
         (title left, icon top-right) and content below. */}
     {checkIn.ambiguity.length > 0 && (
       <div className="rounded-2xl bg-amber-bg/60 ring-1 ring-amber-warm/25 overflow-hidden">
         <div className="flex">
           <div className="w-1.5 bg-amber-warm shrink-0" />
           <div className="flex-1 p-5">
             <div className="flex items-start justify-between gap-3">
               <div className="text-[10px] uppercase tracking-[0.22em] font-medium text-amber-deep">
                 Needs clarification
               </div>
               <LightbulbIcon className="w-5 h-5 text-amber-warm" />
             </div>
             <div className="mt-4 space-y-4">
               {checkIn.ambiguity.map((a, i) => (
                 <div
                   key={i}
                   className={i > 0 ? "pt-4 border-t border-amber-warm/20" : ""}
                 >
                   <div
                     className="font-serif text-lg text-amber-deep"
                     lang={checkIn.language}
                   >
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
                     <p className="text-ink-deep text-sm leading-relaxed">
                       {a.followUp}
                     </p>
                   </div>
                 </div>
               ))}
             </div>
           </div>
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
