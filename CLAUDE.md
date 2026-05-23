# CLAUDE.md — Throughline (working name)

## What we're building
A bilingual medication-response app for family caregivers. When an aging parent starts a new
medication or comes home from the hospital, we check in with them by voice in their own language,
figure out whether the medication is helping / hurting / being misunderstood, and hand the
adult-child caregiver a plain-language brief: what changed, why it matters, what to ask the doctor,
and whether to act or just monitor.

Hackathon: Caltech Longevity Hackathon, Entrepreneurship Track. 2-person team, ~14 build hours.
The judges include a Calico (aging science) scientist and longevity VCs. Optimize for a flawless
live demo and a defensible safety story, not feature count.

## THE NON-NEGOTIABLE PRINCIPLE
**The LLM NEVER decides medical urgency. Deterministic rules decide urgency.**
The LLM only: transcribes, translates, extracts structured fields, detects ambiguity, and writes
the brief in plain language. The `level` field (escalate/monitor/fine) is set ONLY by the rules
engine — never by a model. Never diagnose. Always show the parent's original words. Always defer
the final call to a human.

## Stack
- Next.js (App Router) + TypeScript + Tailwind, deploy on Vercel.
- Anthropic API for all LLM tasks.
- Voice: record in-browser (MediaRecorder) -> transcribe via Whisper API (good Japanese support).
- No database. Baseline is seeded JSON; session check-ins kept in a simple in-memory/file store.
- No auth, no settings, no multi-user. One demo persona.

## Pipeline (the spine)
check-in -> transcribe -> translate -> extract signals -> compare to baseline
-> red-flag check -> escalation decision (RULES) -> caregiver brief (LLM) -> display

## The rules-vs-LLM split
- LLM tasks: transcription, translation, structured extraction from free speech, ambiguity
  detection, writing the CaregiverBrief prose.
- RULES tasks: baseline comparison, red-flag matching, the escalate/monitor/fine decision.

## Core types (define in types.ts FIRST, before any logic)
- CheckIn, Baseline, EscalationDecision, CaregiverBrief (see project notes).
- EscalationDecision.level and .reasons come from the rules engine only.

## Escalation rules (deterministic, readable, auditable)
- Hard red-flag term (e.g., chest pain, fainting, difficulty breathing) -> escalate immediately.
- New symptom NOT in baseline.knownSymptoms + within N days of a med change -> escalate.
- Missed dose + any new symptom -> escalate.
- comprehensionFlag true (parent misunderstands what the med is for) -> escalate.
- Symptom present in baseline.knownSymptoms and no new pattern -> monitor.
- Nothing new -> fine.
Keep rules in one file, each rule named and commented. We read these aloud to judges.

## Build conventions
- Build and TEST the deterministic rules engine in isolation FIRST, with seeded test cases,
  before wiring any LLM. The rules are the IP and the safety story.
- Use structured outputs / strict schemas for every LLM call. No free-text parsing.
- Wire the whole pipeline with TEXT input end-to-end before adding voice.
- Commit after every working step so we can roll back at 3am.
- Two seeded demo scenarios must always work: (1) ESCALATE — new BP med, dizziness, skipped dose;
  (2) MONITOR — "knee hurts after gardening" (in baseline). Protect these two paths.

## Do NOT build (roadmap, pitch only)
Real outbound phone calls, EHR/FHIR, wearables, cognitive-decline detection, pharmacogenomics,
appointment booking, care-circle permissions, auth, more than 2 languages, native mobile app.

## Demo persona
Parent: Japanese-speaking, day 5 of a new blood-pressure medication.
Caregiver: English-speaking adult child (the primary user / dashboard viewer).