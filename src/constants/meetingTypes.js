export const MEETING_TYPES = [
  {
    id: "daily-standups",
    label: "Daily Standup Meeting",
    folder: "daily-standups",
    time: "11:00",
    cronNotify: "45 10 * * 1-5", // 10:45 AM Mon–Fri
  },
  {
    id: "weekly-calls",
    label: "Weekly Call",
    folder: "weekly-calls",
    time: "13:00",
    cronNotify: "45 12 * * 5", // 12:45 PM every Friday
  },
  {
    id: "eos-meetings",
    label: "EOS Meeting",
    folder: "eos-meetings",
    time: null,
    cronNotify: null,
  },
];
