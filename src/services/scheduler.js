import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { MEETING_TYPES } from "../constants/meetingTypes.js";
import { generateNextAgenda } from "../agent/meetingAgent.js";
import { sendMeetingBrief } from "./mailService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

function isLastFridayOfMonth() {
  const today = new Date();
  if (today.getDay() !== 5) return false;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + 7);
  return nextFriday.getMonth() !== today.getMonth();
}

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
      } catch {
        // skip unreadable files
      }
    }

    // Oldest → newest, take last `limit` meetings
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

export async function dispatchBriefForType(meetingType) {
  console.log(`[Scheduler] Generating brief for "${meetingType.label}"...`);

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
    meetingType: meetingType.label,
    meetingTime: meetingType.time,
    project: latest.project || "Project",
    prep,
  });

  console.log(`[Scheduler] Brief sent to: ${participants.map(p => p.email).join(", ")}`);
}

export function startScheduler() {
  for (const meetingType of MEETING_TYPES) {
    if (!meetingType.cronNotify) continue;

    cron.schedule(
      meetingType.cronNotify,
      async () => {
        if (meetingType.id === "retrospectives" && !isLastFridayOfMonth()) return;

        try {
          await dispatchBriefForType(meetingType);
        } catch (err) {
          console.error(`[Scheduler] Error sending brief for "${meetingType.label}":`, err.message || err);
        }
      },
      { timezone: "Asia/Kolkata" }
    );

    console.log(`[Scheduler] Registered: "${meetingType.label}" → cron "${meetingType.cronNotify}" (IST)`);
  }
}
