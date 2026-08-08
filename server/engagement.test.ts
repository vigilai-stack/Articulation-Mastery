import { describe, expect, it } from "vitest";
import { achievements, levelFromPoints, POINTS_PER_LEVEL, PRACTICE_POINTS } from "../shared/engagement";

describe("engagement rules", () => {
  it("uses stable points thresholds for learner levels", () => {
    expect(PRACTICE_POINTS).toBe(60);
    expect(levelFromPoints(0)).toBe(1);
    expect(levelFromPoints(POINTS_PER_LEVEL - 1)).toBe(1);
    expect(levelFromPoints(POINTS_PER_LEVEL)).toBe(2);
  });

  it("defines a complete progression path from first practice through program completion", () => {
    expect(achievements.map(item => item.key)).toEqual(["first_signal", "steady_voice", "seven_day_arc", "midpoint", "mastery_showcase"]);
    expect(achievements.at(-1)?.threshold).toBe(28);
  });
});
