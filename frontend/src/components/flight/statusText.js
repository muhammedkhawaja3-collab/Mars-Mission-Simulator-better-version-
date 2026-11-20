/** Human-readable status for a vehicle state from model/flight.js. */
export function statusText(rocket, state) {
  switch (state.status) {
    case 'no-go':
      return 'No-go: cannot fly this mission';
    case 'aborted':
      return `Aborted on day ${Math.round(state.day)} (gameplay model)`;
    case 'arrived':
      return `Arrived at Mars · ${rocket.transit} days`;
    default:
      return `Day ${Math.round(state.day)} of ${rocket.transit} · ${Math.round(state.progress * 100)}%`;
  }
}
