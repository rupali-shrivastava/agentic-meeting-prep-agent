export async function runMeetingAgent(data) {
  console.log("Running Meeting Prep Agent...");

  return {
    meeting: data.meeting,
    summary: `Discussion about ${data.previousDiscussion}`,
    actions: data.pendingActions
  };
}
