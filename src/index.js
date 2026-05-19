import express from "express";
import meetingData from "./data/mockData.json" assert { type: "json" };
import { runMeetingAgent } from "./agent/meetingAgent.js";

const app = express();

app.get("/", async (req, res) => {
  const result = await runMeetingAgent(meetingData);
  res.json(result);
});

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});