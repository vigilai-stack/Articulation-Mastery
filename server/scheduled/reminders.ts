import type { Request, Response } from "express";
import { and, eq, gte } from "drizzle-orm";
import { notificationEvents, notificationSchedules, practiceSessions, userProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";

function sameUtcDate(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export async function sendPracticeReminder(req: Request, res: Response) {
  try {
    const caller = await sdk.authenticateRequest(req);
    if (!caller.isCron || !caller.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database-unavailable" });
    const schedule = (await db.select().from(notificationSchedules).where(eq(notificationSchedules.scheduleCronTaskUid, caller.taskUid)).limit(1))[0];
    if (!schedule || schedule.enabled === "false") return res.json({ ok: true, skipped: "orphan-or-disabled" });
    if (schedule.lastSentAt && sameUtcDate(schedule.lastSentAt, new Date())) return res.json({ ok: true, skipped: "already-delivered" });
    const profile = (await db.select().from(userProfiles).where(eq(userProfiles.userId, schedule.userId)).limit(1))[0];
    if (!profile || profile.notificationEnabled === "false") return res.json({ ok: true, skipped: "preference-disabled" });
    const completed = await db.select({ lessonDay: practiceSessions.lessonDay }).from(practiceSessions).where(and(eq(practiceSessions.userId, schedule.userId), eq(practiceSessions.status, "reviewed")));
    const completedDays = new Set(completed.map(item => item.lessonDay)).size;
    const isMilestone = completedDays > 0 && completedDays % 7 === 0;
    const message = isMilestone
      ? `Milestone reached: you have completed ${completedDays} deliberate practices. Take a moment to notice what is becoming easier.`
      : "Your next articulation practice is ready. Ten focused minutes can change how your next important message lands.";
    await db.insert(notificationEvents).values({ userId: schedule.userId, type: isMilestone ? "milestone" : "daily_reminder", message });
    await db.update(notificationSchedules).set({ lastSentAt: new Date() }).where(eq(notificationSchedules.id, schedule.id));
    return res.json({ ok: true, delivered: isMilestone ? "milestone" : "daily_reminder" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scheduled reminder error";
    console.error("[Scheduled reminder]", error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
