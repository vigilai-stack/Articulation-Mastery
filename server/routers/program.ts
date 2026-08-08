import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import {
  journalEntries,
  managerAssignments,
  notificationEvents,
  notificationSchedules,
  practiceSessions,
  userProfiles,
  users,
} from "../../drizzle/schema";
import { bonusModules, curriculum } from "../../shared/curriculum";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { createHeartbeatJob, deleteHeartbeatJob } from "../_core/heartbeat";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "../../shared/const";
import { awardPracticeProgression, getEngagementSnapshot } from "../engagement";

const profileInput = z.object({
  goals: z.array(z.string().trim().min(2).max(100)).min(1).max(5),
  baselineSelfAssessment: z.string().trim().min(10).max(3000),
  baselineClarity: z.number().int().min(1).max(10),
  baselineConciseness: z.number().int().min(1).max(10),
  baselineConfidence: z.number().int().min(1).max(10),
  baselineStructure: z.number().int().min(1).max(10),
  notificationEnabled: z.boolean().default(true),
  reminderHour: z.number().int().min(5).max(22).default(9),
  timezone: z.string().trim().min(2).max(100).default("UTC"),
});

const feedbackSchema = {
  type: "object",
  properties: {
    clarityScore: { type: "integer", minimum: 1, maximum: 100 },
    concisenessScore: { type: "integer", minimum: 1, maximum: 100 },
    confidenceScore: { type: "integer", minimum: 1, maximum: 100 },
    structureScore: { type: "integer", minimum: 1, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    nextTakePrompt: { type: "string" },
  },
  required: [
    "clarityScore",
    "concisenessScore",
    "confidenceScore",
    "structureScore",
    "summary",
    "strengths",
    "improvements",
    "nextTakePrompt",
  ],
  additionalProperties: false,
};

type Feedback = {
  clarityScore: number;
  concisenessScore: number;
  confidenceScore: number;
  structureScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextTakePrompt: string;
};

function basicFeedback(text: string): Feedback {
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const hasStructure = /first|second|because|therefore|recommend|next step|in summary/i.test(text);
  const hasConfidentLanguage = /will|recommend|can|clear|ready|plan|decide/i.test(text);
  const clarity = Math.min(88, 54 + Math.min(words.length, 90) / 3 + (sentences.length > 1 ? 5 : 0));
  const conciseness = Math.max(52, Math.min(88, 92 - Math.max(0, words.length - 95) / 2));
  const confidence = Math.min(86, 55 + (hasConfidentLanguage ? 16 : 4) + (words.length > 30 ? 8 : 0));
  const structure = Math.min(88, 50 + (hasStructure ? 25 : 4) + (sentences.length >= 3 ? 8 : 0));
  return {
    clarityScore: Math.round(clarity),
    concisenessScore: Math.round(conciseness),
    confidenceScore: Math.round(confidence),
    structureScore: Math.round(structure),
    summary: "Your response has been saved and scored using the lesson’s communication framework.",
    strengths: ["You delivered a complete response to the prompt.", "Your language contains a usable core message."],
    improvements: ["Lead with the one idea you want the listener to remember.", "End with a clear recommendation, request, or next step."],
    nextTakePrompt: "Record a second take that starts with your conclusion, supports it with one proof point, and ends with a direct close.",
  };
}

async function analyzePractice(lessonDay: number, response: string): Promise<Feedback> {
  const lesson = curriculum.find(item => item.day === lessonDay);
  if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found." });
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a rigorous but encouraging executive communication coach. Assess only the submitted practice against the lesson objective. Return precise, constructive feedback. Do not diagnose a person or make unsupported claims about voice quality when only text is available.",
        },
        {
          role: "user",
          content: `Lesson: ${lesson.title}\nObjective: ${lesson.objective}\nPractice prompt: ${lesson.prompt}\n\nSubmitted response:\n${response}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "articulation_feedback", strict: true, schema: feedbackSchema },
      },
    });
    const raw = result.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return basicFeedback(response);
    const parsed = JSON.parse(raw) as Feedback;
    return parsed;
  } catch (error) {
    console.warn("[Practice feedback] AI feedback fell back to standard scoring", error);
    return basicFeedback(response);
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The learning workspace is temporarily unavailable." });
  return db;
}

function parseGoals(value: string | null) {
  try {
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
}

function completeDates(rows: { completedAt: Date | null }[]) {
  return Array.from(new Set(rows.filter(row => row.completedAt).map(row => row.completedAt!.toISOString().slice(0, 10))));
}

function calculateStreak(dates: string[]) {
  const unique = new Set(dates);
  let current = 0;
  const cursor = new Date();
  for (let index = 0; index < 28; index += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!unique.has(key)) break;
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return current;
}

function scoreAverage(rows: { clarityScore: number | null; concisenessScore: number | null; confidenceScore: number | null; structureScore: number | null }[]) {
  const completed = rows.filter(row => row.clarityScore !== null);
  if (!completed.length) return { clarity: 0, conciseness: 0, confidence: 0, structure: 0 };
  const sum = (key: "clarityScore" | "concisenessScore" | "confidenceScore" | "structureScore") =>
    Math.round(completed.reduce((total, row) => total + (row[key] ?? 0), 0) / completed.length);
  return { clarity: sum("clarityScore"), conciseness: sum("concisenessScore"), confidence: sum("confidenceScore"), structure: sum("structureScore") };
}

function weeklyScoreTrend(rows: { completedAt: Date | null; clarityScore: number | null; concisenessScore: number | null; confidenceScore: number | null; structureScore: number | null }[]) {
  const groups = new Map<string, typeof rows>();
  rows.filter(row => row.completedAt && row.clarityScore !== null).forEach(row => {
    const date = row.completedAt!;
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const weekday = monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate() - weekday + 1);
    const weekStart = monday.toISOString().slice(0, 10);
    groups.set(weekStart, [...(groups.get(weekStart) ?? []), row]);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-4).map(([weekStart, entries]) => {
    const scores = scoreAverage(entries);
    const values = Object.values(scores).filter(Boolean);
    return { week: new Date(`${weekStart}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }), score: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 };
  });
}

export const programRouter = router({
  library: protectedProcedure
    .input(z.object({ category: z.string().optional(), query: z.string().optional() }).optional())
    .query(({ input }) => {
      const query = input?.query?.trim().toLowerCase();
      const lessons = curriculum.filter(lesson => {
        const categoryMatches = !input?.category || input.category === "All" || lesson.category === input.category;
        const queryMatches = !query || [lesson.title, lesson.category, lesson.objective].join(" ").toLowerCase().includes(query);
        return categoryMatches && queryMatches;
      });
      return { lessons, bonusModules };
    }),
  lesson: protectedProcedure.input(z.object({ day: z.number().int().min(1).max(28) })).query(({ input }) => {
    const lesson = curriculum.find(item => item.day === input.day);
    if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found." });
    return lesson;
  }),
  profile: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const profile = (await db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.user.id)).limit(1))[0];
    return profile ? { ...profile, goals: parseGoals(profile.goals) } : null;
  }),
  completeOnboarding: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const values = {
      userId: ctx.user.id,
      goals: JSON.stringify(input.goals),
      baselineSelfAssessment: input.baselineSelfAssessment,
      baselineClarity: input.baselineClarity,
      baselineConciseness: input.baselineConciseness,
      baselineConfidence: input.baselineConfidence,
      baselineStructure: input.baselineStructure,
      notificationEnabled: input.notificationEnabled ? "true" as const : "false" as const,
      reminderHour: input.reminderHour,
      timezone: input.timezone,
      onboardingCompleted: "true" as const,
    };
    await db.insert(userProfiles).values(values).onDuplicateKeyUpdate({ set: values });
    return { success: true };
  }),
  updatePreferences: protectedProcedure
    .input(z.object({ notificationEnabled: z.boolean(), reminderHour: z.number().int().min(5).max(22), timezone: z.string().min(2).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(userProfiles).set({
        notificationEnabled: input.notificationEnabled ? "true" : "false",
        reminderHour: input.reminderHour,
        timezone: input.timezone,
      }).where(eq(userProfiles.userId, ctx.user.id));
      return { success: true };
    }),
  activateReminder: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    const profile = (await db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.user.id)).limit(1))[0];
    if (!profile) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete your onboarding before activating reminders." });
    const existing = (await db.select().from(notificationSchedules).where(eq(notificationSchedules.userId, ctx.user.id)).limit(1))[0];
    if (existing?.scheduleCronTaskUid) return { active: true, nextExecutionAt: null };
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "A signed-in session is required to activate reminders." });
    const hour = profile.reminderHour.toString().padStart(2, "0");
    const job = await createHeartbeatJob({
      name: `practice-reminder-${ctx.user.id}`,
      cron: `0 0 ${hour} * * *`,
      path: "/api/scheduled/practice-reminder",
      payload: {},
      description: "Daily Articulation Mastery practice reminder",
    }, sessionToken);
    const values = { userId: ctx.user.id, scheduleCronTaskUid: job.taskUid, cronExpression: `0 0 ${hour} * * *`, enabled: "true" as const };
    await db.insert(notificationSchedules).values(values).onDuplicateKeyUpdate({ set: values });
    return { active: true, nextExecutionAt: job.nextExecutionAt ?? null };
  }),
  deactivateReminder: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    const existing = (await db.select().from(notificationSchedules).where(eq(notificationSchedules.userId, ctx.user.id)).limit(1))[0];
    if (!existing?.scheduleCronTaskUid) return { active: false };
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    if (sessionToken) await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken);
    await db.update(notificationSchedules).set({ enabled: "false", scheduleCronTaskUid: null }).where(eq(notificationSchedules.id, existing.id));
    return { active: false };
  }),
  notifications: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db.select().from(notificationEvents).where(eq(notificationEvents.userId, ctx.user.id)).orderBy(desc(notificationEvents.createdAt)).limit(5);
  }),
  reminderStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const schedule = (await db.select().from(notificationSchedules).where(eq(notificationSchedules.userId, ctx.user.id)).limit(1))[0];
    return { active: Boolean(schedule?.scheduleCronTaskUid && schedule.enabled === "true") };
  }),
  overview: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.user.id)).limit(1);
    const sessions = await db.select().from(practiceSessions).where(and(eq(practiceSessions.userId, ctx.user.id), eq(practiceSessions.status, "reviewed"))).orderBy(desc(practiceSessions.completedAt));
    const daysCompleted = new Set(sessions.map(session => session.lessonDay)).size;
    const completionDates = completeDates(sessions);
    const scores = scoreAverage(sessions);
    const activeDay = Math.min(28, Math.max(1, curriculum.find(item => !sessions.some(session => session.lessonDay === item.day))?.day ?? 28));
    const mostRecent = sessions[0] ?? null;
    return {
      profile: profile ? { ...profile, goals: parseGoals(profile.goals) } : null,
      activeDay,
      daysCompleted,
      completionRate: Math.round((daysCompleted / curriculum.length) * 100),
      streak: calculateStreak(completionDates),
      completionDates,
      scores,
      mostRecent,
      recentSessions: sessions.slice(0, 7),
      weeklyTrend: weeklyScoreTrend(sessions),
      engagement: await getEngagementSnapshot(ctx.user.id),
    };
  }),
  submitPractice: protectedProcedure
    .input(z.object({ lessonDay: z.number().int().min(1).max(28), responseMode: z.enum(["text", "audio"]), responseText: z.string().max(12000).optional(), audioDataUrl: z.string().max(24_000_000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      let responseText = input.responseText?.trim() ?? "";
      let transcript: string | null = null;
      let audioKey: string | null = null;
      let audioUrl: string | null = null;
      if (input.responseMode === "audio") {
        if (!input.audioDataUrl?.startsWith("data:audio/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Please record an audio response before submitting." });
        const [metadata, base64] = input.audioDataUrl.split(",");
        if (!base64) throw new TRPCError({ code: "BAD_REQUEST", message: "The audio recording could not be read." });
        const mimeType = metadata.match(/data:(audio\/[\w.+-]+);base64/)?.[1] ?? "audio/webm";
        const audio = Buffer.from(base64, "base64");
        if (audio.byteLength > 16 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Audio recordings must be 16 MB or smaller." });
        const extension = mimeType.includes("wav") ? "wav" : mimeType.includes("mpeg") ? "mp3" : "webm";
        const stored = await storagePut(`users/${ctx.user.id}/practice/day-${input.lessonDay}-${Date.now()}.${extension}`, audio, mimeType);
        audioKey = stored.key;
        audioUrl = stored.url;
        const transcribed = await transcribeAudio({ audioUrl: stored.url, language: "en", prompt: "Professional articulation practice response" });
        if ("error" in transcribed) throw new TRPCError({ code: "BAD_REQUEST", message: transcribed.error });
        transcript = transcribed.text?.trim() ?? "";
        responseText = transcript;
      }
      if (responseText.length < 12) throw new TRPCError({ code: "BAD_REQUEST", message: "Please provide a fuller practice response before requesting feedback." });
      const feedback = await analyzePractice(input.lessonDay, responseText);
      const [session] = await db.insert(practiceSessions).values({
        userId: ctx.user.id,
        lessonDay: input.lessonDay,
        responseMode: input.responseMode,
        responseText,
        transcript,
        audioKey,
        audioUrl,
        status: "reviewed",
        clarityScore: feedback.clarityScore,
        concisenessScore: feedback.concisenessScore,
        confidenceScore: feedback.confidenceScore,
        structureScore: feedback.structureScore,
        feedbackJson: feedback,
        completedAt: new Date(),
      });
      const engagement = await awardPracticeProgression(ctx.user.id, session.insertId);
      return { sessionId: session.insertId, feedback, transcript, engagement };
    }),
  engagement: protectedProcedure.query(async ({ ctx }) => getEngagementSnapshot(ctx.user.id)),
  journal: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db.select().from(journalEntries).where(eq(journalEntries.userId, ctx.user.id)).orderBy(desc(journalEntries.createdAt));
  }),
  addJournalEntry: protectedProcedure.input(z.object({ body: z.string().trim().min(2).max(5000) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [result] = await db.insert(journalEntries).values({ userId: ctx.user.id, body: input.body });
    return { id: result.insertId };
  }),
  teamReport: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "manager" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Manager access is required to view team reporting." });
    const db = await requireDb();
    const assigned = ctx.user.role === "admin"
      ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, "learner"))
      : await db.select({ id: users.id, name: users.name, email: users.email }).from(managerAssignments).innerJoin(users, eq(managerAssignments.learnerId, users.id)).where(eq(managerAssignments.managerId, ctx.user.id));
    const learnerIds = assigned.map(user => user.id);
    if (!learnerIds.length) return { learners: [], completionRate: 0, skillGaps: { clarity: 0, conciseness: 0, confidence: 0, structure: 0 }, reviewedPracticeCount: 0 };
    const sessions = await db.select().from(practiceSessions).where(and(inArray(practiceSessions.userId, learnerIds), eq(practiceSessions.status, "reviewed")));
    const learnerRows = assigned.map(learner => {
      const entries = sessions.filter(session => session.userId === learner.id);
      const completed = new Set(entries.map(entry => entry.lessonDay)).size;
      return { id: learner.id, name: learner.name || learner.email || "Learner", email: learner.email, completed, completionRate: Math.round((completed / 28) * 100), scores: scoreAverage(entries), lastPracticeAt: entries.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0]?.completedAt ?? null };
    });
    const scores = scoreAverage(sessions);
    return { learners: learnerRows, completionRate: Math.round(learnerRows.reduce((sum, learner) => sum + learner.completionRate, 0) / learnerRows.length), skillGaps: scores, reviewedPracticeCount: sessions.length };
  }),
  learnerReport: protectedProcedure.input(z.object({ learnerId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    if (ctx.user.role !== "manager" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Manager access is required to view learner reporting." });
    const db = await requireDb();
    if (ctx.user.role === "manager") {
      const assignment = (await db.select().from(managerAssignments).where(and(eq(managerAssignments.managerId, ctx.user.id), eq(managerAssignments.learnerId, input.learnerId))).limit(1))[0];
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN", message: "This learner is not assigned to you." });
    }
    const learner = (await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, input.learnerId)).limit(1))[0];
    if (!learner) throw new TRPCError({ code: "NOT_FOUND", message: "Learner not found." });
    const sessions = await db.select().from(practiceSessions).where(and(eq(practiceSessions.userId, input.learnerId), eq(practiceSessions.status, "reviewed"))).orderBy(desc(practiceSessions.completedAt));
    const completed = new Set(sessions.map(session => session.lessonDay)).size;
    return { learner, completed, completionRate: Math.round((completed / 28) * 100), scores: scoreAverage(sessions), weeklyTrend: weeklyScoreTrend(sessions), sessions: sessions.slice(0, 10) };
  }),
  exportTeamCsv: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "manager" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Manager access is required to export reporting." });
    const db = await requireDb();
    const assigned = ctx.user.role === "admin"
      ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, "learner"))
      : await db.select({ id: users.id, name: users.name, email: users.email }).from(managerAssignments).innerJoin(users, eq(managerAssignments.learnerId, users.id)).where(eq(managerAssignments.managerId, ctx.user.id));
    const learnerIds = assigned.map(user => user.id);
    const sessions = learnerIds.length ? await db.select().from(practiceSessions).where(and(inArray(practiceSessions.userId, learnerIds), eq(practiceSessions.status, "reviewed"))) : [];
    const header = "Learner,Email,Lessons Completed,Completion Rate,Clarity,Conciseness,Confidence,Structure\n";
    const rows = assigned.map(learner => {
      const entries = sessions.filter(session => session.userId === learner.id);
      const complete = new Set(entries.map(entry => entry.lessonDay)).size;
      const scores = scoreAverage(entries);
      const escaped = (value: string | null) => `"${(value ?? "").replaceAll('"', '""')}"`;
      return [escaped(learner.name), escaped(learner.email), complete, `${Math.round((complete / 28) * 100)}%`, scores.clarity, scores.conciseness, scores.confidence, scores.structure].join(",");
    });
    return { csv: header + rows.join("\n"), fileName: `articulation-team-report-${new Date().toISOString().slice(0, 10)}.csv` };
  }),
  assignLearner: protectedProcedure.input(z.object({ learnerId: z.number().int().positive(), managerId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required to assign learners." });
    const db = await requireDb();
    await db.insert(managerAssignments).values(input).onDuplicateKeyUpdate({ set: input });
    return { success: true };
  }),
});
