import { describe, expect, it } from "vitest";
import { curriculum } from "../../shared/curriculum";

describe("articulation curriculum", () => {
  it("provides a complete, uniquely numbered 28-day sequence", () => {
    expect(curriculum).toHaveLength(28);
    expect(new Set(curriculum.map(lesson => lesson.day)).size).toBe(28);
    expect(curriculum[0]?.title).toBe("Confident introductions");
    expect(curriculum[27]?.title).toBe("Mastery showcase");
  });

  it("gives every lesson learning, coaching, and practice content", () => {
    curriculum.forEach(lesson => {
      expect(lesson.reading.length).toBeGreaterThan(50);
      expect(lesson.videoTip.length).toBeGreaterThan(20);
      expect(lesson.prompt.length).toBeGreaterThan(25);
    });
  });
});
