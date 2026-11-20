/** Text summaries of mission results for live-region announcements. */

/** One-sentence result summary for the live region. */
export function resultSummary(rockets) {
  const flying = rockets.filter((r) => !r.failed && !r.aborted);
  if (flying.length === 0) return 'Mission debrief ready. No vehicle completed this mission.';
  const fastest = flying.reduce((a, b) => (b.transit < a.transit ? b : a));
  const cheapest = flying.reduce((a, b) => (b.cost < a.cost ? b : a));
  return `Mission debrief ready. ${flying.length} of ${rockets.length} vehicles reached Mars. Fastest: ${fastest.label}, ${fastest.transit} days. Lowest cost: ${cheapest.label}, $${cheapest.cost} billion.`;
}
