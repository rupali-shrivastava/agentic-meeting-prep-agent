import express from "express";
import dotenv from "dotenv";
import meetingData from "./data/mockData.json" with { type: "json" };
import { runMeetingAgent } from "./agent/meetingAgent.js";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());

app.get("/", async (req, res) => {
  const result = await runMeetingAgent(meetingData);
  res.json(result);
});

app.get("/meetings", (req, res) => {
  res.json(meetingData);
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});