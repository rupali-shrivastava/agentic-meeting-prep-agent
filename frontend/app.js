const API = `http://localhost:4000`;
let meetingsData = [];

async function loadMeetings() {
  const res = await fetch(`${API}/meetings`);
  const data = await res.json();
  meetingsData = data;
  
  const container = document.getElementById("meetings");
  container.innerHTML = ""; // clear existing

  data.forEach((meeting, index) => {
    const div = document.createElement("div");
    div.className = "meeting-card";

    const participantsHtml = Array.isArray(meeting.participants)
      ? meeting.participants.map(p => `<span class="participant">${escapeHtml(p)}</span>`).join(' ')
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

      <div id="brief-${index}" class="brief" style="white-space:pre-wrap;margin-top:8px;"></div>
    `;

    container.appendChild(div);
  });
}


async function generateBrief(meetingId) {
  const briefEl = document.getElementById(`brief-${meetingId}`);
  if (!briefEl) return;
  briefEl.innerText = "Generating Meeting brief...";

  const meeting = meetingsData[meetingId];
  if (!meeting) {
    briefEl.innerText = "Meeting not found";
    return;
  }

  try {
    const res = await fetch(`${API}/prepare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(meeting)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      briefEl.innerText = `Error: ${err.error || err.message || JSON.stringify(err)}`;
      return;
    }

    const data = await res.json();

    // Render structured result
    const prep = data.preparation || data;
    let html = "";

    if (prep && typeof prep === "object") {
      const preparationPoints = prep.preparation_points || prep.preparationPoints || [];
      const agenda = prep.agenda_suggestions || prep.agendaSuggestions || [];
      const followUps = prep.follow_ups || prep.followUps || [];
      const summary = prep.summary || prep.notes || "";

      html += `<strong>Summary</strong>\n<p>${escapeHtml(summary)}</p>`;

      if (preparationPoints.length) {
        html += `<strong>Preparation Points</strong>\n<ul>${preparationPoints.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
      }

      if (agenda.length) {
        html += `<strong>Agenda Suggestions</strong>\n<ul>${agenda.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`;
      }

      if (followUps.length) {
        html += `<strong>Follow ups</strong>\n<ul>${followUps.map(f => `<li>${escapeHtml(typeof f === 'string' ? f : JSON.stringify(f))}</li>`).join("")}</ul>`;
      }
    } else if (data.raw) {
      html = `<pre>${escapeHtml(data.raw)}</pre>`;
    } else {
      html = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }

    briefEl.innerHTML = html;
  } catch (err) {
    briefEl.innerText = `Request failed: ${err.message || err}`;
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