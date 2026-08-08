import { and, eq, inArray } from "drizzle-orm";
import { engagementEvents, practiceSessions, userAchievements, userEngagement } from "../drizzle/schema";
import { achievements, levelFromPoints, PRACTICE_POINTS } from "../shared/engagement";
import { getDb } from "./db";

export type EngagementSnapshot = {
  totalPoints: number;
  currentLevel: number;
  pointsIntoLevel: number;
  pointsToNextLevel: number;
  unlockedKeys: string[];
  newlyUnlocked: string[];
};

export async function getEngagementSnapshot(userId: number): Promise<EngagementSnapshot> {
  const db = await getDb();
  if (!db) return { totalPoints: 0, currentLevel: 1, pointsIntoLevel: 0, pointsToNextLevel: 240, unlockedKeys: [], newlyUnlocked: [] };
  const [engagement] = await db.select().from(userEngagement).where(eq(userEngagement.userId, userId)).limit(1);
  const unlocked = await db.select({ achievementKey: userAchievements.achievementKey }).from(userAchievements).where(eq(userAchievements.userId, userId));
  const totalPoints = engagement?.totalPoints ?? 0;
  const pointsIntoLevel = totalPoints % 240;
  return { totalPoints, currentLevel: engagement?.currentLevel ?? levelFromPoints(totalPoints), pointsIntoLevel, pointsToNextLevel: 240 - pointsIntoLevel, unlockedKeys: unlocked.map(item => item.achievementKey), newlyUnlocked: [] };
}

export async function awardPracticeProgression(userId: number, practiceSessionId: number): Promise<EngagementSnapshot> {
  const db = await getDb();
  if (!db) return getEngagementSnapshot(userId);
  const existing = (await db.select().from(engagementEvents).where(and(eq(engagementEvents.userId, userId), eq(engagementEvents.eventType, "practice_completed"), eq(engagementEvents.practiceSessionId, practiceSessionId))).limit(1))[0];
  if (existing) return getEngagementSnapshot(userId);
  await db.insert(engagementEvents).values({ userId, practiceSessionId, eventType: "practice_completed", points: PRACTICE_POINTS, description: "Completed a guided articulation practice" });
  const [current] = await db.select().from(userEngagement).where(eq(userEngagement.userId, userId)).limit(1);
  const totalPoints = (current?.totalPoints ?? 0) + PRACTICE_POINTS;
  const currentLevel = levelFromPoints(totalPoints);
  if (current) await db.update(userEngagement).set({ totalPoints, currentLevel }).where(eq(userEngagement.id, current.id));
  else await db.insert(userEngagement).values({ userId, totalPoints, currentLevel });
  const completed = await db.select({ lessonDay: practiceSessions.lessonDay }).from(practiceSessions).where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.status, "reviewed")));
  const completedDays = new Set(completed.map(item => item.lessonDay)).size;
  const definitions = achievements.filter(item => completedDays >= item.threshold);
  const existingAchievements = await db.select({ achievementKey: userAchievements.achievementKey }).from(userAchievements).where(eq(userAchievements.userId, userId));
  const existingKeys = new Set(existingAchievements.map(item => item.achievementKey));
  const newlyUnlocked = definitions.filter(item => !existingKeys.has(item.key));
  if (newlyUnlocked.length) await db.insert(userAchievements).values(newlyUnlocked.map(item => ({ userId, achievementKey: item.key })));
  const snapshot = await getEngagementSnapshot(userId);
  return { ...snapshot, newlyUnlocked: newlyUnlocked.map(item => item.key) };
}
