import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import meetingDataSample from "../data/mockData.json" assert { type: "json" };
import { runMeetingAgent, generateNextAgenda } from "../agent/meetingAgent.js";

const router = express.Router();

// Helper to load all JSON meeting files from data/mock-data/daily-standups
async function loadMeetingsFromFolder() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const folder = path.join(__dirname, "..", "data", "mock-data", "daily-standups");

  try {
    const files = await fs.readdir(folder);
    const meetings = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await fs.readFile(path.join(folder, file), "utf8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          meetings.push(...parsed);
        } else if (parsed && typeof parsed === "object") {
          meetings.push(parsed);
        }
      } catch (e) {
        // skip invalid files but continue
        console.warn(`Failed to parse ${file}:`, e.message || e);
      }
    }

    // Fallback to sample mockData.json if folder is empty
    if (meetings.length === 0 && Array.isArray(meetingDataSample)) {
      return meetingDataSample;
    }

    return meetings;
  } catch (e) {
    // If folder doesn't exist or can't be read, return sample data
    console.warn("Could not read mock-standups folder, falling back to sample mockData.json", e.message || e);
    return meetingDataSample;
  }
}

// GET /meetings -> list all meetings, sorted newest first for display
router.get("/meetings", async (req, res) => {
  try {
    const meetings = await loadMeetingsFromFolder();
    meetings.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: "Failed to load meetings", details: String(err) });
  }
});

// POST /prepare -> generate preparation for a single meeting object
router.post("/prepare", async (req, res) => {
  try {
    const meeting = req.body;
    if (!meeting) return res.status(400).json({ error: "Missing meeting in request body" });
    const result = await runMeetingAgent(meeting);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate preparation", details: String(err) });
  }
});

// POST /prepare/next-agenda -> reads ALL meetings and returns ONE unified next-meeting agenda
router.post("/prepare/next-agenda", async (req, res) => {
  try {
    const meetings = await loadMeetingsFromFolder();
    if (!meetings.length) return res.status(404).json({ error: "No meeting data found" });
    const result = await generateNextAgenda(meetings);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate next agenda", details: String(err) });
  }
});

// POST /prepare/batch -> generate for array of meetings
router.post("/prepare/batch", async (req, res) => {
  try {
    const meetings = req.body;
    if (!Array.isArray(meetings)) return res.status(400).json({ error: "Expected an array of meetings" });
    const result = await runMeetingAgent(meetings);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate batch preparation", details: String(err) });
  }
});

export default router;
