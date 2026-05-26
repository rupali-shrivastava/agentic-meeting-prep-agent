import express from "express";
import dotenv from "dotenv";
import meetingData from "./data/mockData.json" with { type: "json" };
import { runMeetingAgent } from "./agent/meetingAgent.js";

dotenv.config();

const app = express();

app.get("/", async (req, res) => {
  const result = await runMeetingAgent(meetingData);
  res.json(result);
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});