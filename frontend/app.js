const API = `/api`;
let meetingsData = [];

async function loadMeetings() {
  const res = await fetch(`${API}/meetings`);  // → GET /api/meetings
  const data = await res.json();
  meetingsData = data;
  
  const container = document.getElementById("meetings");
  container.innerHTML = ""; // clear existing

  data.forEach((meeting, index) => {
    const div = document.createElement("div");
    div.className = "meeting-card";

    const participantsHtml = Array.isArray(meeting.participants)
      ? meeting.participants.map(p => `<span class="participant">${escapeHtml(p)}</span>`).join(', ')
      : escapeHtml(String(meeting.participants || ''));

    // transcript preview: first 3 entries
    const transcriptPreview = Array.isArray(meeting.transcript)
      ? meeting.transcript.slice(0, 3).map(t => `
        <li><strong>${escapeHtml(t.speaker)}</strong> — ${escapeHtml(t.text)}</li>
      `).join('')
      : '';

    div.innerHTML = `
      <h3>${escapeHtml(meeting.project || meeting.meeting || meeting.meeting_id || 'Untitled')}</h3>
      <p><b>Sprint:</b> ${escapeHtml(meeting.sprint || '—')}</p>
      <p><b>Date:</b> ${escapeHtml(meeting.date || '')} ${meeting.day ? '(' + escapeHtml(meeting.day) + ')' : ''}</p>
      <p><b>Participants:</b><br/>${participantsHtml}</p>
      <details>
        <summary>Transcript preview</summary>
        <ul class="transcript-preview">${transcriptPreview}</ul>
      </details>
    `;

    container.appendChild(div);
  });
}


async function generateBrief() {
  const briefEl = document.getElementById("brief");
  if (!briefEl) return;

  const btn = document.getElementById("generate-btn");
  btn.disabled = true;
  btn.textContent = "Generating...";
  briefEl.innerHTML = `<span style="color:#94a3b8">Reading all ${meetingsData.length} meeting notes and generating next meeting agenda...</span>`;

  try {
    const res = await fetch(`${API}/prepare/next-agenda`, { method: "POST" });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      briefEl.innerHTML = `<span style="color:#f87171">Error: ${escapeHtml(err.error || err.message || JSON.stringify(err))}</span>`;
      return;
    }

    const data = await res.json();
    const prep = data.preparation || data;

    const latest = meetingsData[0] || {};
    let html = `<h3 style="margin-top:0;color:#93c5fd">Next Meeting Agenda — ${escapeHtml(latest.project || "")}</h3>`;
    html += `<p style="color:#6b7280;font-size:12px;margin-top:-8px">Based on ${data.meetingCount || meetingsData.length} past meetings</p>`;

    if (prep && typeof prep === "object") {
      const summary           = prep.summary || prep.notes || "";
      const preparationPoints = prep.preparation_points || prep.preparationPoints || [];
      const agenda            = prep.agenda_suggestions || prep.agendaSuggestions || [];
      const followUps         = prep.follow_ups || prep.followUps || [];
      const risks             = prep.key_risks || prep.keyRisks || [];

      if (summary) {
        html += `<strong>Status Summary</strong><p>${escapeHtml(summary)}</p>`;
      }
      if (agenda.length) {
        html += `<strong>Agenda for Next Meeting</strong><ol>${agenda.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ol>`;
      }
      if (preparationPoints.length) {
        html += `<strong>Preparation Points</strong><ul>${preparationPoints.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
      }
      if (followUps.length) {
        html += `<strong>Open Follow-ups</strong><ul>${followUps.map(f => `<li>${escapeHtml(typeof f === "string" ? f : JSON.stringify(f))}</li>`).join("")}</ul>`;
      }
      if (risks.length) {
        html += `<strong>Key Risks / Blockers</strong><ul>${risks.map(r => `<li>${escapeHtml(typeof r === "string" ? r : JSON.stringify(r))}</li>`).join("")}</ul>`;
      }
    } else if (data.raw) {
      html += `<pre>${escapeHtml(data.raw)}</pre>`;
    }

    briefEl.innerHTML = html;
  } catch (err) {
    briefEl.innerHTML = `<span style="color:#f87171">Request failed: ${escapeHtml(err.message || String(err))}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate Next Agenda";
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

loadMeetings();