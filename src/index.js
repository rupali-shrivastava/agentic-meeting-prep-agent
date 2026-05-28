import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import meetingsRouter from "./routes/meetings.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend static files so visiting '/' loads frontend/index.html
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// Use meetings router for API endpoints
app.use("/api", meetingsRouter);

// Backwards-compatible shorter routes for frontend (optional)
app.get("/meetings", (req, res) => res.redirect("/api/meetings"));
app.post("/prepare", (req, res, next) => res.redirect(307, "/api/prepare"));
app.post("/prepare/batch", (req, res, next) => res.redirect(307, "/api/prepare/batch"));
app.post("/send-mail", (req, res, next) => res.redirect(307, "/api/send-mail"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});