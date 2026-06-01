import axios from "axios";

// Reads all meetings chronologically and generates ONE next-meeting agenda
export async function generateNextAgenda(meetings = [], options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "OPENAI_API_KEY environment variable is not set" };

  const deployment = process.env.OPENAI_MODEL || "gpt-35-turbo";
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://hackathon-gptmodels.openai.azure.com";
  const apiVersion = process.env.AZURE_API_VERSION || "2024-08-01-preview";
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  // Sort old → newest so the model reads history in order
  const sorted = [...meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
  const prompt = buildMultiMeetingPrompt(sorted);

  try {
    const response = await axios.post(
      url,
      {
        messages: [
          {
            role: "system",
            content:
              "You are a concise meeting intelligence assistant. You read a series of past meeting transcripts in chronological order and generate a comprehensive agenda and preparation brief for the NEXT upcoming meeting. Return valid JSON only."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: options.max_tokens || 2000,
        temperature: 0.2
      },
      {
        headers: { "api-key": apiKey, "Content-Type": "application/json" }
      }
    );

    const text = response.data?.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { notes: text };
    }

    return { preparation: parsed, raw: text, meetingCount: sorted.length };
  } catch (err) {
    const errData = err?.response?.data || err?.message || String(err);
    return { error: "OpenAI request failed", details: errData };
  }
}

function buildMultiMeetingPrompt(meetings = []) {
  const history = meetings.map((m, i) => {
    const rawTranscript = m.transcript || m.previousDiscussion || "";
    const transcript = Array.isArray(rawTranscript)
      ? rawTranscript.map(t => `  [${t.time || ""}] ${t.speaker}${t.role ? ` (${t.role})` : ""}: ${t.text}`).join("\n")
      : String(rawTranscript);

    const participants = Array.isArray(m.participants)
      ? m.participants.map(p => typeof p === "object" ? p.name : p).join(", ")
      : m.participants || "";

    return `--- Meeting ${i + 1}: ${m.date || ""}${m.day ? ` (${m.day})` : ""} | ${m.project || ""} ${m.sprint ? `| ${m.sprint}` : ""} ---
Participants: ${participants}
Transcript:
${transcript}`;
  }).join("\n\n");

  const latest = meetings[meetings.length - 1] || {};

  return `Below are all past meeting transcripts for this project in chronological order (oldest → most recent).

${history}

Based on ALL of the above meeting history, generate the preparation brief for the NEXT upcoming meeting.

Respond with a valid JSON object and nothing else with these keys:
- summary: a concise paragraph summarising the overall progress and current status across all meetings.
- preparation_points: array of 5-8 actionable preparation points team members should do before the next meeting.
- agenda_suggestions: array of 4-5 specific agenda items for the next meeting derived from unresolved issues and progress.
- follow_ups: array of open follow-up items with owner names and suggested deadlines (infer from context if not explicit).
- key_risks: array of 2-4 risks or blockers identified across the meeting history that need attention.

Project: ${latest.project || ""}
Most recent meeting: ${latest.date || ""}
Total meetings analysed: ${meetings.length}

Return only valid JSON.`;
}
