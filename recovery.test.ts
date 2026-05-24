import { describe, it, expect } from "vitest";
import { findEpisodes } from "./recovery";
import { SEED_MOM } from "./profile";
import baselineJson from "./baseline.json";
import type { Baseline } from "./types";

const baseline = baselineJson as Baseline;

// SEED_MOM's escalate clusters (anchored 2026-05-24):
//   1. Lisinopril onset: dry cough + headache, Nov 17–22, 2025. Two trailing
//      monitor days (Nov 23–24, cough isNew=false), then fine from Nov 25.
//      → 6 flagged days, recovery on Nov 25 = 8 days.
//   2. Winter-cold missed-dose: single escalate on Dec 22, 2025 (cough +
//      taken="no"). Cold lingers as monitor through Jan 5, then fine from
//      Jan 6 → 1 flagged day, recovery on Jan 6 = 15 days.
//   3. Amlodipine onset: dizziness May 20–21, 2026. History ends 2026-05-21
//      → 2 flagged days, ongoing.
describe("findEpisodes on SEED_MOM", () => {
  const eps = findEpisodes(SEED_MOM.checkInHistory, baseline);

  it("identifies exactly three escalate episodes", () => {
    expect(eps).toHaveLength(3);
    expect(eps.map((e) => e.startIso)).toEqual([
      "2025-11-17",
      "2025-12-22",
      "2026-05-20",
    ]);
  });

  it("Lisinopril cluster: 6 flagged days, recovers in 8 days", () => {
    const lis = eps.find((e) => e.startIso === "2025-11-17")!;
    expect(lis.cause).toBe("Lisinopril 10mg");
    expect(lis.triggerRule).toBe("newSymptomAfterMedChange");
    expect(lis.flaggedDays).toBe(6);
    expect(lis.endIso).toBe("2025-11-22");
    expect(lis.recoveryIso).toBe("2025-11-25");
    expect(lis.recoveryDays).toBe(8);
    expect(lis.ongoing).toBe(false);
    expect(lis.symptoms).toEqual(expect.arrayContaining(["dry cough", "headache"]));
  });

  it("missed-dose cluster: 1 flagged day, recovers when the cold clears", () => {
    const md = eps.find((e) => e.startIso === "2025-12-22")!;
    expect(md.cause).toBe("Missed dose");
    expect(md.triggerRule).toBe("missedDosePlusNewSymptom");
    expect(md.flaggedDays).toBe(1);
    expect(md.endIso).toBe("2025-12-22");
    // Cold runs through 2026-01-05 as monitor; first fine is 2026-01-06.
    expect(md.recoveryIso).toBe("2026-01-06");
    expect(md.recoveryDays).toBe(15);
    expect(md.ongoing).toBe(false);
  });

  it("Amlodipine cluster: 2 flagged days, still ongoing at end of history", () => {
    const amlo = eps.find((e) => e.startIso === "2026-05-20")!;
    expect(amlo.cause).toBe("Amlodipine 5mg");
    expect(amlo.triggerRule).toBe("newSymptomAfterMedChange");
    expect(amlo.flaggedDays).toBe(2);
    expect(amlo.endIso).toBe("2026-05-21");
    expect(amlo.recoveryIso).toBeNull();
    expect(amlo.recoveryDays).toBeNull();
    expect(amlo.ongoing).toBe(true);
    expect(amlo.symptoms).toContain("dizziness");
  });

  it("average recovery across resolved episodes is 11 days", () => {
    // (8 + 15) / 2 = 11.5 — caller rounds to 12; this test pins the raw average.
    const resolved = eps.filter((e) => e.recoveryDays !== null);
    expect(resolved).toHaveLength(2);
    const avg =
      resolved.reduce((s, e) => s + (e.recoveryDays ?? 0), 0) / resolved.length;
    expect(avg).toBeCloseTo(11.5, 5);
  });
});
