import { describe, it, expect } from "vitest";
import { generateSuggestions } from "./suggestions";
import { SEED_MOM } from "./profile";

// CLAUDE.md pins the demo's "today" at 2026-05-24. Tests pass a fixed Date so
// they stay stable as wall-clock time advances. With that anchor:
//   - Amlodipine started 2026-05-17 → 7 days ago (≤14)             → medStartedRecently
//   - Dizziness check-in on 2026-05-21 → 3 days ago (≤3)           → recentSymptom
//   - Cardiology with Yamamoto on 2026-05-26 → 2 days out (≤3)     → upcomingAppointment
//   - Protein recommendation 2026-05-03 → 21 days ago (≥14)        → olderRecommendation
const NOW = new Date("2026-05-24T12:00:00Z");

describe("generateSuggestions on SEED_MOM @ 2026-05-24", () => {
  const sugs = generateSuggestions(SEED_MOM, NOW);
  const sources = sugs.map((s) => s.source);
  const byText = sugs.map((s) => s.text);

  it("returns 3–4 suggestions", () => {
    expect(sugs.length).toBeGreaterThanOrEqual(3);
    expect(sugs.length).toBeLessThanOrEqual(4);
  });

  it("fires medStartedRecently for Amlodipine", () => {
    expect(sources).toContain("medStartedRecently");
    const sug = sugs.find((s) => s.source === "medStartedRecently")!;
    expect(sug.text).toContain("Amlodipine");
    expect(sug.text).toContain("7 days ago");
    expect(sug.text).toMatch(/helping.*hurting.*about the same/);
  });

  it("fires recentSymptom for the dizziness on 2026-05-21", () => {
    expect(sources).toContain("recentSymptom");
    const sug = sugs.find((s) => s.source === "recentSymptom")!;
    expect(sug.text).toContain("dizziness");
    expect(sug.text).toMatch(/3 days ago|yesterday|today/);
  });

  it("fires upcomingAppointment for Dr. Yamamoto / cardiology", () => {
    expect(sources).toContain("upcomingAppointment");
    const sug = sugs.find((s) => s.source === "upcomingAppointment")!;
    expect(sug.text).toContain("Dr. Kenji Yamamoto");
    expect(sug.text.toLowerCase()).toContain("cardiology");
    expect(sug.text).toMatch(/in 2 days|tomorrow|today/);
  });

  it("fires olderRecommendation for the protein/energy suggestion", () => {
    expect(sources).toContain("olderRecommendation");
    const sug = sugs.find((s) => s.source === "olderRecommendation")!;
    expect(sug.text.toLowerCase()).toContain("protein");
    expect(sug.text).toContain("energy");
    expect(sug.text).toMatch(/\d+ weeks ago/);
  });

  it("every suggestion carries a prefill the textarea can adopt", () => {
    for (const s of sugs) {
      expect(s.prefill.length).toBeGreaterThan(0);
      expect(s.id.length).toBeGreaterThan(0);
    }
    // No duplicate ids — prevents React-key collisions in the rendered list.
    expect(new Set(sugs.map((s) => s.id)).size).toBe(sugs.length);
    // Ensure all four expected sources appear (sanity for the byText log).
    expect(byText.length).toBeGreaterThanOrEqual(3);
  });
});
