import { MEETING_TYPES } from "./constants.js";

const API = `/api`;
let meetingsData = [];
let selectedType = null;

// Populate the dropdown from constants
function initDropdown() {
  const select = document.getElementById("meeting-type");
  MEETING_TYPES.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    selectedType = select.value;
    const label = MEETING_TYPES.find(t => t.id === selectedType)?.label || "";
    document.getElementById("meetings-heading").textContent = `Meetings – ${label}`;
    document.getElementById("main-layout").style.display = "grid";
    document.getElementById("empty-state").style.display = "none";
    document.getElementById("brief").innerHTML = `
      <div class="brief-placeholder">
        <span class="placeholder-icon">📋</span>
        <p>Click <strong>Generate Next Agenda</strong> to get an AI-powered brief based on all meeting history.</p>
      </div>`;
    loadMeetings(selectedType);
  });
}

async function loadMeetings(type) {
  const container = document.getElementById("meetings");
  container.innerHTML = `<div class="loading-cards"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;

  try {
    const res = await fetch(`${API}/meetings?type=${encodeURIComponent(type)}`);
    const data = await res.json();
    meetingsData = data;
    container.innerHTML = "";

    if (!data.length) {
      container.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#6b7280;text-align:center;padding:20px">
          <div style="font-size:48px">📭</div>
          <p style="font-weight:600;color:#374151;font-size:15px;margin:0">No meetings found</p>
          <p style="font-size:13px;margin:0;max-width:220px">There are no recorded meetings for this type yet.</p>
        </div>`;
      document.getElementById("generate-btn").disabled = true;
      return;
    }
    document.getElementById("generate-btn").disabled = false;

    data.forEach((meeting, index) => {
      const div = document.createElement("div");
      div.className = "meeting-card";

      const participantsHtml = Array.isArray(meeting.participants)
        ? meeting.participants.map(p => {
            const name = typeof p === "object" ? p.name : p;
            return `<span class="participant">${escapeHtml(name)}</span>`;
          }).join(", ")
        : escapeHtml(String(meeting.participants || ""));

      const transcriptPreview = Array.isArray(meeting.transcript)
        ? meeting.transcript.slice(0, 3).map(t => `<li><strong>${escapeHtml(t.speaker)}</strong> — ${escapeHtml(t.text)}</li>`).join("")
        : "";

      const dateTime = meeting.dateTime
        ? new Date(meeting.dateTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : meeting.date || "";

      div.innerHTML = `
        <p class="card-meta"><span class="badge">${escapeHtml(meeting.sprint || "")}</span> <span class="card-date">${escapeHtml(meeting.date || "")} (${escapeHtml(meeting.day || "")})</span></p>
        <p class="card-datetime">🕐 ${escapeHtml(dateTime)}</p>
        <p class="card-label"><b>Participants:</b></p>
        <p class="card-participants">${participantsHtml}</p>
        <details>
          <summary>Transcript preview</summary>
          <ul class="transcript-preview">${transcriptPreview}</ul>
        </details>
      `;

      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = `<p style="color:#f87171">Failed to load meetings: ${escapeHtml(err.message)}</p>`;
  }
}

async function generateBrief() {
  const briefEl = document.getElementById("brief");
  if (!briefEl) return;

  const btn = document.getElementById("generate-btn");
  btn.disabled = true;
  btn.textContent = "Generating...";
  briefEl.innerHTML = `<div class="brief-loading"><div class="spinner"></div><p>Reading all ${meetingsData.length} meeting notes and generating next meeting agenda...</p></div>`;

  try {
    const res = await fetch(`${API}/prepare/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meetingsData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      briefEl.innerHTML = `<span style="color:#f87171">Error: ${escapeHtml(err.error || err.message || JSON.stringify(err))}</span>`;
      return;
    }

    const data = await res.json();
    const prep = data.preparation || data;
    const latest = meetingsData[0] || {};
    const typeLabel = MEETING_TYPES.find(t => t.id === selectedType)?.label || selectedType || "";

    let html = `
      <div class="brief-header">
        <h3>Next Meeting Agenda</h3>
        <span class="brief-meta">${escapeHtml(typeLabel)} &nbsp;·&nbsp; Based on ${data.meetingCount || meetingsData.length} meetings &nbsp;·&nbsp; Last: ${escapeHtml(latest.date || "")}</span>
      </div>`;

    if (prep && typeof prep === "object") {
      const summary           = prep.summary || prep.notes || "";
      const preparationPoints = prep.preparation_points || prep.preparationPoints || [];
      const agenda            = prep.agenda_suggestions || prep.agendaSuggestions || [];
      const followUps         = prep.follow_ups || prep.followUps || [];
      const risks             = prep.key_risks || prep.keyRisks || [];

      if (summary) {
        html += `<div class="brief-section"><div class="section-title">📋 Status Summary</div><p>${escapeHtml(summary)}</p></div>`;
      }
      if (agenda.length) {
        html += `<div class="brief-section"><div class="section-title">📌 Agenda for Next Meeting</div><ol>${agenda.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ol></div>`;
      }
      if (preparationPoints.length) {
        html += `<div class="brief-section"><div class="section-title">✅ Preparation Points</div><ul>${preparationPoints.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>`;
      }
      if (followUps.length) {
        html += `<div class="brief-section"><div class="section-title">🔁 Open Follow-ups</div><ul>${followUps.map(f => {
          if (typeof f === "string") return `<li>${escapeHtml(f)}</li>`;
          const item     = escapeHtml(f.item || f.action || "");
          const owner    = f.owner    ? `<span class="fu-owner"> — ${escapeHtml(f.owner)}</span>` : "";
          const deadline = f.deadline ? `<span class="fu-deadline"> (Due: ${escapeHtml(f.deadline)})</span>` : "";
          return `<li>${item}${owner}${deadline}</li>`;
        }).join("")}</ul></div>`;
      }
      if (risks.length) {
        html += `<div class="brief-section"><div class="section-title">⚠️ Key Risks / Blockers</div><ul>${risks.map(r => `<li>${escapeHtml(typeof r === "string" ? r : JSON.stringify(r))}</li>`).join("")}</ul></div>`;
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

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = (type === "success" ? "✅  " : "❌  ") + message;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove("show"); }, 4000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmailBrief() {
  const btn = document.getElementById("email-btn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const type = selectedType || "daily-standups";
    const res = await fetch(`${API}/send-brief?type=${encodeURIComponent(type)}`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || data.details || res.statusText, "error");
    } else {
      const label = MEETING_TYPES.find(t => t.id === type)?.label || type;
      showToast(`Email brief sent for "${label}"`, "success");
    }
  } catch (err) {
    showToast(`Request failed: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send Email Brief";
  }
}

// Make functions available globally for onclick
window.generateBrief  = generateBrief;
window.sendEmailBrief = sendEmailBrief;

initDropdown();
