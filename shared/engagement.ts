export type AchievementDefinition = {
  key: string;
  title: string;
  description: string;
  icon: "spark" | "flame" | "target" | "crown" | "star";
  threshold: number;
};

export const PRACTICE_POINTS = 60;
export const POINTS_PER_LEVEL = 240;

export const achievements: AchievementDefinition[] = [
  { key: "first_signal", title: "First Signal", description: "Complete your first deliberate practice.", icon: "spark", threshold: 1 },
  { key: "steady_voice", title: "Steady Voice", description: "Complete three distinct daily practices.", icon: "flame", threshold: 3 },
  { key: "seven_day_arc", title: "Seven-Day Arc", description: "Complete seven distinct daily practices.", icon: "target", threshold: 7 },
  { key: "midpoint", title: "Midpoint", description: "Reach the halfway mark in your 28-day program.", icon: "star", threshold: 14 },
  { key: "mastery_showcase", title: "Mastery Showcase", description: "Complete every lesson in the program.", icon: "crown", threshold: 28 },
];

export function levelFromPoints(points: number) {
  return Math.max(1, Math.floor(points / POINTS_PER_LEVEL) + 1);
}
