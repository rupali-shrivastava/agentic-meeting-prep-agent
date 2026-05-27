import axios from "axios";

export async function runMeetingAgent(meetings, options = {}) {
  // Accept a single meeting object or an array of meetings
  const items = Array.isArray(meetings) ? meetings : [meetings];
  const results = [];

  for (const meeting of items) {
    const res = await generatePreparationForMeeting(meeting, options);
    results.push(res);
  }

  return Array.isArray(meetings) ? results : results[0];
}

async function generatePreparationForMeeting(meeting = {}, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "OPENAI_API_KEY environment variable is not set" };
  }

  const model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
  const prompt = buildPrompt(meeting);

  try {
    const response = await axios.post(
      "https://hackathon-gptmodels.openai.azure.com/v1/chat/completions",
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a concise assistant that creates meeting preparation materials (actionable prep points, agenda suggestions, and follow-ups) based on prior meeting transcripts and context. Return valid JSON only."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: options.max_tokens || 800,
        temperature: typeof options.temperature === "number" ? options.temperature : 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const text =
      response.data?.choices?.[0]?.message?.content || response.data?.choices?.[0]?.text || "";

    // Try to parse JSON returned by the model. Fall back to returning raw text inside a notes field.
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { notes: text };
    }

    return {
      meeting: meeting.meeting || null,
      preparation: parsed,
      raw: text
    };
  } catch (err) {
    // Return helpful error information but avoid leaking internal error objects
    const errData = err?.response?.data || err?.message || String(err);
    return { error: "OpenAI request failed", details: errData };
  }
}

function buildPrompt(meeting = {}) {
  const transcript = meeting.transcript || meeting.previousDiscussion || "";
  const participants = Array.isArray(meeting.participants) ? meeting.participants.join(", ") : meeting.participants || "Unknown participants";
  const pendingActions = Array.isArray(meeting.pendingActions) ? meeting.pendingActions : (meeting.pendingActions ? [meeting.pendingActions] : []);

  return `You are given the details of a previous meeting. Using the transcript/context and participant list, generate concise preparation materials for the NEXT meeting.

Respond with a valid JSON object and nothing else. The JSON should have these keys:
- preparation_points: an array of 3-8 bullet points describing what to prepare (include responsible participant if applicable).
- agenda_suggestions: an array of 3 suggested agenda items for the next meeting.
- follow_ups: an array of follow-up items derived from pending actions, with suggested owners and deadlines if inferable.
- summary: a one-paragraph summary of the previous meeting.

Meeting: ${meeting.meeting || "Untitled"}
Time: ${meeting.time || "Unknown"}
Participants: ${participants}

Previous transcript/context:
${transcript}

Pending actions:
${pendingActions.map((a) => `- ${a}`).join("\n")}

Return only valid JSON. Do not add extra commentary.`;
}
