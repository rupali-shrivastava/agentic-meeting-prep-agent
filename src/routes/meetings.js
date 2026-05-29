import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { runMeetingAgent, generateNextAgenda } from "../agent/meetingAgent.js";
import { sendMeetingSummary } from "../services/mailService.js";
import { dispatchBriefForType } from "../services/scheduler.js";
import { MEETING_TYPES } from "../constants/meetingTypes.js";

const router = express.Router();

const VALID_FOLDERS = new Set(MEETING_TYPES.map(t => t.folder));

async function loadMeetingsFromFolder(type = "daily-standups") {
  const folder = VALID_FOLDERS.has(type) ? type : "daily-standups";
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const folderPath = path.join(__dirname, "..", "data", "mock-data", folder);

  try {
    const files = await fs.readdir(folderPath);
    const meetings = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await fs.readFile(path.join(folderPath, file), "utf8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) meetings.push(...parsed);
        else if (parsed && typeof parsed === "object") meetings.push(parsed);
      } catch (e) {
        console.warn(`Failed to parse ${file}:`, e.message || e);
      }
    }

    return meetings;
  } catch (e) {
    return [];
  }
}

// GET /meetings?type=daily-standups — sorted newest first
router.get("/meetings", async (req, res) => {
  try {
    const type = req.query.type || "daily-standups";
    const meetings = await loadMeetingsFromFolder(type);
    meetings.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: "Failed to load meetings", details: String(err) });
  }
});

// POST /prepare/batch — accepts array of transcripts, returns one unified next-meeting agenda
router.post("/prepare/batch", async (req, res) => {
  try {
    const meetings = req.body;
    if (!Array.isArray(meetings) || meetings.length === 0) {
      return res.status(400).json({ error: "Expected a non-empty array of meeting transcripts" });
    }
    const result = await generateNextAgenda(meetings);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate next agenda", details: String(err) });
  }
});

// POST /send-mail — generate preparation for a single meeting and email the summary
router.post("/send-mail", async (req, res) => {
  try {
    const { meeting, emails } = req.body;

    if (!meeting) return res.status(400).json({ error: "Meeting is required" });
    if (!emails || !emails.length) return res.status(400).json({ error: "Recipient emails are required" });

    const result = await runMeetingAgent(meeting);
    const prep = result.preparation || {};

    await sendMeetingSummary({
      to: emails,
      subject: `Meeting Summary - ${meeting.project || "Meeting"}`,
      html: `<h2>Meeting Summary</h2><p>${prep.summary || ""}</p>`
    });

    res.json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send email", details: String(err) });
  }
});

// POST /send-brief?type=daily-standups — send already-generated brief via email (no second AI call)
// Body: { prep, project, participants }
router.post("/send-brief", async (req, res) => {
  try {
    const typeId = req.query.type || "daily-standups";
    const meetingType = MEETING_TYPES.find(t => t.id === typeId);
    if (!meetingType) return res.status(400).json({ error: `Unknown meeting type: ${typeId}` });
    if (!meetingType.time) return res.status(400).json({ error: `No meeting time configured for "${meetingType.label}"` });

    const { prep, project, participants } = req.body;
    if (!prep) return res.status(400).json({ error: "Missing prep data in request body" });

    const { getNextMeetingDateForType, formatDateLabel, formatTimeLabel } = await import("../services/scheduler.js");
    const nextDate     = getNextMeetingDateForType(meetingType);
    const meetingDate  = nextDate ? formatDateLabel(nextDate) : "Upcoming";
    const meetingTime  = formatTimeLabel(meetingType.time);

    await sendMeetingBrief({ participants, meetingType: meetingType.label, meetingDate, meetingTime, project, prep });

    res.json({ success: true, message: `Brief emailed for "${meetingType.label}"` });
  } catch (err) {
    console.error("[send-brief]", err);
    res.status(500).json({ error: "Failed to send brief", details: String(err) });
  }
});

export default router;
