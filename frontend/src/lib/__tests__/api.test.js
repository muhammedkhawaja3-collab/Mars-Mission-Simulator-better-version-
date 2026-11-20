import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('axios', () => ({ default: { post: (...args) => post(...args) } }));

import { crossCheckMission, missionRequestBody } from '../api.js';
import { initialState } from '../../state/missionReducer.js';
import { buildMissionResults } from '../../model/fleet.js';

const config = initialState.config;
const rocket = buildMissionResults(config).rockets.find((r) => r.key === 'nuclear');

describe('optional API cross-check', () => {
  beforeEach(() => post.mockReset());

  it('posts the engine inputs to the relative /api/mission path', async () => {
    post.mockResolvedValue({ data: { transitTime: rocket.mission.transitTime } });
    await expect(crossCheckMission(config, rocket)).resolves.toBe('agrees');
    const [url, body, opts] = post.mock.calls[0];
    expect(url).toBe('/api/mission');
    expect(body).toEqual({
      vehicle: 'nuclear',
      launch_vehicle: 'sls-block1',
      crew_size: 4,
      risk_tolerance: 5,
      window_id: '2028-12',
      transfer: { kind: 'fastest' },
      seed: 42,
    });
    expect(opts.timeout).toBeGreaterThan(0);
  });

  it('maps the fixed 200-day transfer to {kind: timeOfFlight, time_of_flight} in seconds', () => {
    const body = missionRequestBody(
      { ...config, transferChoice: 'tof200' },
      'starship',
      'starship',
    );
    expect(body.transfer).toEqual({ kind: 'timeOfFlight', time_of_flight: 200 * 86400 });
    expect(body.launch_vehicle).toBe('starship');
    expect(body).not.toHaveProperty('year');
  });

  it('never rejects: offline or malformed responses resolve to "offline"', async () => {
    post.mockRejectedValue(new Error('network'));
    await expect(crossCheckMission(config, rocket)).resolves.toBe('offline');
    post.mockResolvedValue({ data: {} });
    await expect(crossCheckMission(config, rocket)).resolves.toBe('offline');
  });

  it('flags a disagreement', async () => {
    post.mockResolvedValue({ data: { transitTime: rocket.mission.transitTime * 1.5 } });
    await expect(crossCheckMission(config, rocket)).resolves.toBe('differs');
  });

  it('skips custom or infeasible rockets without a request', async () => {
    await expect(crossCheckMission(config, { key: 'player', failed: false })).resolves.toBe(
      'offline',
    );
    await expect(crossCheckMission(config, { key: 'chemical', failed: true })).resolves.toBe(
      'offline',
    );
    expect(post).not.toHaveBeenCalled();
  });
});
