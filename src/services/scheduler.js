import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { MEETING_TYPES } from "../constants/meetingTypes.js";
import { generateNextAgenda } from "../agent/meetingAgent.js";
import { sendMeetingBrief } from "./mailService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Date helpers ────────────────────────────────────────────────────────────

function isLastFridayOfMonthDate(date) {
  if (date.getDay() !== 5) return false;
  const next = new Date(date);
  next.setDate(date.getDate() + 7);
  return next.getMonth() !== date.getMonth();
}

/**
 * Compute the next meeting date for a given meeting type.
 * Returns a Date object (IST) representing when the meeting will occur.
 */
function getNextMeetingDate(meetingType) {
  if (!meetingType.time) return null;

  const [hour, minute] = meetingType.time.split(":").map(Number);

  // Current time in IST
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  const candidateAt = (date) => {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const isWeekday = (d) => d.getDay() >= 1 && d.getDay() <= 5;

  const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  if (meetingType.id === "daily-standups") {
    // Next weekday (Mon–Fri) at meeting time
    let d = candidateAt(now);
    if (d <= now || !isWeekday(d)) {
      d = addDays(d, 1);
      while (!isWeekday(d)) d = addDays(d, 1);
      d = candidateAt(d);
    }
    return d;
  }

  if (meetingType.id === "weekly-calls") {
    // Next Friday at meeting time
    let d = candidateAt(now);
    const daysUntilFriday = (5 - now.getDay() + 7) % 7;
    d = candidateAt(addDays(now, daysUntilFriday));
    // If that Friday's meeting time has already passed today, move to next Friday
    if (d <= now) d = candidateAt(addDays(d, 7));
    return d;
  }

  if (meetingType.id === "retrospectives") {
    // Next last-Friday of any month at meeting time
    let d = candidateAt(now);
    const daysUntilFriday = (5 - now.getDay() + 7) % 7;
    d = candidateAt(addDays(now, daysUntilFriday === 0 ? 7 : daysUntilFriday));
    while (!isLastFridayOfMonthDate(d)) d = candidateAt(addDays(d, 7));
    if (d <= now) {
      d = candidateAt(addDays(d, 7));
      while (!isLastFridayOfMonthDate(d)) d = candidateAt(addDays(d, 7));
    }
    return d;
  }

  return null;
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function loadRecentMeetings(folder, limit = 10) {
  const folderPath = path.join(__dirname, "..", "data", "mock-data", folder);
  try {
    const files = await fs.readdir(folderPath);
    const meetings = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await fs.readFile(path.join(folderPath, file), "utf8");
        const parsed  = JSON.parse(content);
        if (Array.isArray(parsed)) meetings.push(...parsed);
        else if (parsed && typeof parsed === "object") meetings.push(parsed);
      } catch { /* skip unreadable files */ }
    }
    meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
    return meetings.slice(-limit);
  } catch {
    return [];
  }
}

function extractParticipants(meetings) {
  const seen = new Map();
  for (const m of meetings) {
    if (!Array.isArray(m.participants)) continue;
    for (const p of m.participants) {
      if (typeof p === "object" && p.email && !seen.has(p.email)) {
        seen.set(p.email, { name: p.name || p.email, email: p.email });
      }
    }
  }
  return [...seen.values()];
}

// ─── Core dispatch ────────────────────────────────────────────────────────────

export async function dispatchBriefForType(meetingType) {
  const nextDate = getNextMeetingDate(meetingType);
  const meetingDateLabel = nextDate ? formatDate(nextDate) : "Today";
  const meetingTimeLabel = formatTime(meetingType.time);

  console.log(`[Scheduler] Generating brief for "${meetingType.label}" — ${meetingDateLabel} at ${meetingTimeLabel}`);

  const meetings = await loadRecentMeetings(meetingType.folder);
  if (!meetings.length) {
    console.log(`[Scheduler] No meetings found for "${meetingType.label}", skipping.`);
    return;
  }

  const participants = extractParticipants(meetings);
  if (!participants.length) {
    console.log(`[Scheduler] No participant emails found for "${meetingType.label}", skipping.`);
    return;
  }

  const result = await generateNextAgenda(meetings);
  const prep   = result.preparation || {};
  const latest = meetings[meetings.length - 1] || {};

  await sendMeetingBrief({
    participants,
    meetingType:  meetingType.label,
    meetingDate:  meetingDateLabel,
    meetingTime:  meetingTimeLabel,
    project:      latest.project || "Project",
    prep,
  });

  console.log(`[Scheduler] Brief sent to: ${participants.map(p => p.email).join(", ")}`);
}

// ─── Startup ──────────────────────────────────────────────────────────────────

export function startScheduler() {
  console.log("\n[Scheduler] ─── Registered jobs ───────────────────────────");

  for (const meetingType of MEETING_TYPES) {
    if (!meetingType.cronNotify) continue;

    const nextMeeting  = getNextMeetingDate(meetingType);
    const nextEmailAt  = nextMeeting ? new Date(nextMeeting.getTime() - 15 * 60 * 1000) : null;
    const nextLabel    = nextMeeting
      ? `${formatDate(nextMeeting)} at ${formatTime(meetingType.time)} → email at ${nextEmailAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}`
      : "no upcoming date computed";

    console.log(`[Scheduler] "${meetingType.label}"`);
    console.log(`            Next meeting : ${nextLabel}`);

    cron.schedule(
      meetingType.cronNotify,
      async () => {
        if (meetingType.id === "retrospectives" && !isLastFridayOfMonthDate(new Date())) return;
        try {
          await dispatchBriefForType(meetingType);
        } catch (err) {
          console.error(`[Scheduler] Error for "${meetingType.label}":`, err.message || err);
        }
      },
      { timezone: "Asia/Kolkata" }
    );
  }

  console.log("[Scheduler] ────────────────────────────────────────────────\n");
}
