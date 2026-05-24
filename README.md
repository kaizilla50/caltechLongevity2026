# CuraPhi

**Bringing words. Caring better.**

A bilingual companion that interprets an aging parent's health over time — and tells the family what to do.

When a parent starts a new medication or comes home from the hospital, the first two weeks decide whether it helps or harms. Their adult child is the safety net — often across a language gap, with no medical training. CuraPhi listens to the parent's daily check-in (in their own language), interprets it, and hands the family a plain-language, doctor-ready brief: what changed, why it matters, and what to ask the doctor.

The design principle that makes it safe: **the AI reads language — it never decides medical urgency.** Urgency is decided by a deterministic, tested rules engine, with a clinician always in the loop. That is also why CuraPhi is not a medical device, and ships in months rather than years.

---

## Quick start

> **Requires Node.js 22.10 or newer** (for the system-CA TLS flag below) and an Anthropic API key.

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file (see the IMPORTANT note below)
#    Create a file named .env.local in the project root containing:
#    ANTHROPIC_API_KEY=sk-ant-...your-key...

# 3. One-time TLS config (see "Antivirus / TLS" note below)
npm config set node-options "--use-system-ca"

# 4. Run the dev server
npm run dev
```

Then open **http://localhost:3000**.

The app opens on the **Check-in** page. Click the **"Dizziness check-in"** button to see the full pipeline end to end (translate → interpret → decide → doctor brief).

---

## How to demo it

CuraPhi runs in two modes:

- **Cached mode (default).** The seeded **Dizziness** and **Knee pain** check-in buttons, and the dizziness follow-up suggestion, return pre-computed results instantly (~1 second). This is the reliable demo path — no network call, identical every time.
- **Live mode.** Add `?live=1` to the URL (e.g. `http://localhost:3000/?live=1`) to force the real pipeline: the app sends free text to the Anthropic API, which translates the parent's words, extracts symptoms, and flags ambiguous medical language. The deterministic rules engine then decides the verdict. You can type a fresh check-in (in English or Japanese) and watch it work.

Voice input (the microphone pill on the check-in page) uses the browser's built-in speech recognition and **works in Chrome and Edge** (not Firefox).

---

## IMPORTANT setup notes

These two gotchas will stop the app from running if missed. Both are one-time fixes.

### 1. The `.env.local` file must be UTF-8 (not UTF-16)

If you create `.env.local` with PowerShell's `>` redirect, it saves as UTF-16, and the key is read as garbage — you'll get `Could not resolve authentication method`. Create the file in a normal text editor (VS Code, Notepad) saved as **UTF-8**, or in PowerShell use:

```powershell
Set-Content -Encoding utf8 .env.local "ANTHROPIC_API_KEY=sk-ant-...your-key..."
```

### 2. Antivirus / TLS interception (the `--use-system-ca` flag)

Some antivirus suites (e.g. AVG, Avast) intercept HTTPS with their own root certificate that Node.js doesn't trust by default, causing `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on the API call. The fix is the one-time command in the Quick Start:

```bash
npm config set node-options "--use-system-ca"
```

This tells Node (22.10+) to trust the operating system's certificate store, which already trusts the antivirus cert. If you are not behind such antivirus, this flag is harmless.

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS**
- **Anthropic API** (Claude) for translation, symptom extraction, and brief generation — language interpretation only
- A hand-written, deterministic **rules engine** for all urgency decisions (no AI in the decision path)
- No database — the seeded patient profile and ~12 months of check-in history live in memory

## Project structure

| Path | What it does |
|------|--------------|
| `app/page.tsx` | The full UI: check-in, history calendar, trends, medications, care team |
| `app/api/checkin/route.ts` | The pipeline endpoint: analyze → decide → brief |
| `rules.ts` | Deterministic escalation rules — **decides urgency** |
| `extract.ts` | Claude call: translate + extract symptoms + flag ambiguity |
| `brief.ts` | Claude call: write the plain-language doctor brief |
| `suggestions.ts` | Deterministic "what to check on today" suggestions |
| `recovery.ts` | Deterministic recovery-time / episode detection for Trends |
| `profile.ts` | Seeded patient (Yuki Tanaka) + ~12 months of check-in history |
| `demo-cache.json` | Pre-computed responses for the reliable demo path |
| `components/CuraphiMark.tsx` | The brand logo mark |
| `*.test.ts` | Test suite for the rules, suggestions, and recovery engines |

## Tests

```bash
npm test
```

15 tests covering the deterministic engines (rules, suggestions, recovery-time). The decision logic is fully tested precisely because it is the part that must never be wrong.

---

*Built for the Caltech Longevity Hackathon 2026 — Startup Launchpad track.*