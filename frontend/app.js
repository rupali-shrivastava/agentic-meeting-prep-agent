
const API = "http://localhost:3000";


async function loadMeetings() {

  const res = await fetch(`${API}/meetings`);

  const data = await res.json();

  console.log(data);

  const container =
    document.getElementById("meetings");

  data.forEach((meeting, index) => {

    const div = document.createElement("div");

    div.className = "meeting-card";

    div.innerHTML = `
      <h3>${meeting.meeting}</h3>

      <p>
        <b>Time:</b> ${meeting.time}
      </p>

      <p>
        <b>Previous Discussion:</b>
        ${meeting.previousDiscussion}
      </p>

      <ul>
        ${meeting.pendingActions
          .map(action => `<li>${action}</li>`)
          .join("")}
      </ul>

      <button onclick="generateBrief(${index})">
        Generate Brief
      </button>
    `;

    container.appendChild(div);
  });
}


async function generateBrief(meetingId) {
  document.getElementById("brief").innerText =
    "Generating Meeting brief...";

  const res = await fetch(
    `${API}/generate-brief`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ meetingId })
    }
  );

  const data = await res.json();

  document.getElementById("brief").innerText =
    data.brief;
}

loadMeetings();