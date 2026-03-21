import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const DISTANCES = {
  2027: 97.7,
  2029: 81.5,
  2031: 101.2,
  2033: 62.1,
  2035: 95.4,
};

const BASE_ROCKETS = {
  chemical: { label: 'Chemical', isp: 450, exhaustVelocity: 4414.5, transit: 247, propellant: 311147, radiation: 236, cost: 10.8, launches: 4, success: 52.5, crewHealth: 70.4, color: '#E24B4A' },
  nuclear:  { label: 'Nuclear',  isp: 900, exhaustVelocity: 8829,   transit: 123.5, propellant: 79394, radiation: 149.4, cost: 5.4, launches: 1, success: 67.4, crewHealth: 79.8, color: '#3B8BD4' },
  starship: { label: 'Starship', isp: 363, exhaustVelocity: 3561,   transit: 288, propellant: 582455, radiation: 264.7, cost: 1.8, launches: 6, success: 47.6, crewHealth: 67.3, color: '#1D9E75' },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const calcRocket = ({ rocket, crewSize, distance, risk }) => {
  const distFactor = distance / 97.7;
  const riskMult = 1 - (risk - 1) * 0.03;
  const crewFactor = 1 + (crewSize - 4) * 0.08;
  const crewCrew = 1 + (crewSize - 4) * 0.015;
  const transit = +(rocket.transit * distFactor).toFixed(1);
  const propellant = +(rocket.propellant * distFactor * crewFactor).toFixed(1);
  const radiation = +(rocket.radiation * distFactor * crewCrew).toFixed(1);
  const cost = +(rocket.cost * (1 + (crewSize - 4) * 0.075)).toFixed(2);
  const success = +clamp((rocket.success * riskMult - (crewSize - 4) * 1.2).toFixed(1), 20, 99.9).toFixed(1);
  const crewHealth = +clamp((rocket.crewHealth * riskMult - (crewSize - 4) * 1.1).toFixed(1), 30, 99.9).toFixed(1);
  return { ...rocket, transit, propellant, radiation, cost, success, crewHealth, launches: rocket.launches };
};

const radiationColor = (val) => {
  if (val < 150) return '#2bd946';
  if (val < 200) return '#ffc107';
  return '#ff5555';
};

const METRIC_CONFIG = {
  transit:    { label: 'Transit',    unit: 'days' },
  radiation:  { label: 'Radiation',  unit: 'mSv'  },
  propellant: { label: 'Propellant', unit: 'kg'   },
  cost:       { label: 'Cost',       unit: '$B'   },
  success:    { label: 'Success',    unit: '%'    },
  crewHealth: { label: 'Crew Health', unit: '%'   },
};

// Y positions for the 3 rocket lanes in SVG (viewBox 1200×320)
const TIERS = [70, 160, 250];

function App() {
  const [crewSize, setCrewSize] = useState(4);
  const [year, setYear] = useState(2027);
  const [risk, setRisk] = useState(5);
  const [missionData, setMissionData] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [raceProgress, setRaceProgress] = useState(0);
  const [raceRunning, setRaceRunning] = useState(false);
  const [arrivals, setArrivals] = useState({});
  const [showDebrief, setShowDebrief] = useState(false);
  const [statusText, setStatusText] = useState('Configure mission parameters and initiate launch');
  const [clock, setClock] = useState('00:00:00');

  const intervalRef = useRef(null);
  const distance = DISTANCES[year];

  const rockets = useMemo(() => {
    const data = {};
    Object.entries(BASE_ROCKETS).forEach(([key, rocket]) => {
      data[key] = calcRocket({ rocket, crewSize, distance, risk });
    });
    return data;
  }, [crewSize, distance, risk]);

  // Deterministic stars so they don't re-randomize on every render
  const svgStars = useMemo(() =>
    [...Array(95)].map((_, i) => ({
      cx: (i * 127.3 + 41) % 1200,
      cy: (i * 83.7 + 19) % 320,
      r: ((i * 31) % 18) / 10 + 0.2,
      op: ((i * 53) % 7) / 10 + 0.3,
      dur: (((i * 17) % 40) / 10 + 2).toFixed(1),
    })), []);

  // Live UTC clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        `${String(d.getUTCHours()).padStart(2, '0')}:` +
        `${String(d.getUTCMinutes()).padStart(2, '0')}:` +
        `${String(d.getUTCSeconds()).padStart(2, '0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Race animation loop
  useEffect(() => {
    if (!missionData || !raceRunning) return;
    const stepTime = 100;
    const totalTime = 17500;
    const start = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = clamp(elapsed / totalTime, 0, 1);
      setRaceProgress(progress);

      const newArrivals = {};
      Object.entries(rockets).forEach(([key, rocket]) => {
        const hold = rocket.transit / 124;
        const finishAt = clamp(hold, 0.18, 1);
        if (progress >= finishAt) newArrivals[key] = true;
      });
      setArrivals(newArrivals);

      if (progress >= 1) {
        clearInterval(intervalRef.current);
        setRaceRunning(false);
        setShowDebrief(true);
        setStatusText('All rockets arrived. Mission debrief ready.');
      }
    }, stepTime);

    return () => clearInterval(intervalRef.current);
  }, [missionData, raceRunning, rockets]);

  const startMission = async () => {
    setShowDebrief(false);
    setRaceProgress(0);
    setArrivals({});
    setStatusText('Initializing launch sequence...');
    const payload = { crew_size: crewSize, year, risk };

    try {
      const resp = await axios.post('http://localhost:8000/api/mission', payload, { timeout: 3000 });
      setMissionData(resp.data);
      setStatusText('Mission parameters verified. Countdown commencing.');
    } catch {
      setMissionData({ rockets, distance, year, crew_size: crewSize, risk });
      setStatusText('Local simulation mode. Countdown commencing.');
    }

    let count = 5;
    setCountdown(count);
    const cd = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(cd);
        setCountdown(null);
        setRaceRunning(true);
        setStatusText('LAUNCH SEQUENCE INITIATED — Race to Mars in progress...');
        return;
      }
      setCountdown(count);
    }, 1000);
  };

  const runAgain = () => {
    setShowDebrief(false);
    setMissionData(null);
    setRaceProgress(0);
    setArrivals({});
    setStatusText('Configure mission parameters and initiate launch');
  };

  const activeMetrics = missionData ? missionData.rockets : rockets;

  const bestMetrics = useMemo(() => {
    const best = {};
    Object.keys(METRIC_CONFIG).forEach((metric) => {
      const values = Object.values(activeMetrics).map((v) => Number(v[metric]));
      best[metric] = metric === 'success' || metric === 'crewHealth'
        ? Math.max(...values)
        : Math.min(...values);
    });
    return best;
  }, [activeMetrics]);

  const bestColorByMetric = useMemo(() => {
    const result = {};
    Object.keys(METRIC_CONFIG).forEach((metric) => {
      const entries = Object.values(activeMetrics).map((v) => ({ color: v.color, v: Number(v[metric]) }));
      result[metric] = (metric === 'success' || metric === 'crewHealth'
        ? entries.reduce((a, b) => b.v > a.v ? b : a)
        : entries.reduce((a, b) => b.v < a.v ? b : a)
      ).color;
    });
    return result;
  }, [activeMetrics]);

  const statusDotClass = raceRunning ? 'active' : countdown !== null ? 'countdown' : '';

  return (
    <div className="app">
      <div className="scanlines" />
      <div className="vignette" />

      <div className="panel">

        {/* ── HEADER ── */}
        <header className="mcc-header">
          <div className="mcc-header-left">
            <div className="mcc-logo-mark">◈</div>
            <div>
              <h1 className="mcc-title">Mars Mission Control</h1>
              <div className="mcc-subtitle">NUCLEAR PROPULSION COMPARATIVE ANALYSIS SYSTEM · REV 2.0</div>
            </div>
          </div>
          <div className="mcc-header-right">
            <div className="mcc-clock-block">
              <div className="mcc-clock-label">UTC</div>
              <div className="mcc-clock">{clock}</div>
            </div>
            <div className="mcc-watermark">NASA JPL</div>
          </div>
        </header>

        {/* ── STATUS BAR ── */}
        <div className="status-bar">
          <span className={`status-dot ${statusDotClass}`} />
          <span className="status-text">{statusText}</span>
        </div>

        {/* ── MISSION PARAMETERS ── */}
        <section className="config">
          <div className="config-header">
            <span className="section-title">■ MISSION PARAMETERS</span>
            <span className="mission-phase-badge">PHASE 01 · CONFIGURATION</span>
          </div>

          <div className="controls-grid">
            <div className="control">
              <label className="control-label">CREW SIZE</label>
              <div className="control-row">
                <input type="range" min="2" max="8" value={crewSize} onChange={(e) => setCrewSize(+e.target.value)} />
                <span className="control-value">{crewSize}</span>
              </div>
            </div>
            <div className="control">
              <label className="control-label">LAUNCH WINDOW</label>
              <select value={year} onChange={(e) => setYear(+e.target.value)}>
                {Object.entries(DISTANCES).map(([y, d]) => (
                  <option value={y} key={y}>{y} — {d}M km</option>
                ))}
              </select>
            </div>
            <div className="control">
              <label className="control-label">RISK TOLERANCE</label>
              <div className="control-row">
                <input type="range" min="1" max="10" value={risk} onChange={(e) => setRisk(+e.target.value)} />
                <span className="control-value">{risk}</span>
              </div>
            </div>
          </div>

          {/* Rocket Spec Cards */}
          <div className="spec-cards">
            {Object.entries(rockets).map(([key, item]) => (
              <div className="spec-card" key={key} style={{ borderColor: item.color + '44' }}>
                <div className="spec-card-topbar" style={{ background: `linear-gradient(90deg, ${item.color}, ${item.color}88)` }} />
                <div className="spec-card-body">
                  <h3 className="spec-card-name" style={{ color: item.color }}>{item.label}</h3>
                  <div className="spec-data-grid">
                    <div className="spec-data-item">
                      <div className="spec-label">ISP</div>
                      <div className="spec-value" style={{ color: item.color }}>{item.isp}</div>
                      <div className="spec-unit">sec</div>
                    </div>
                    <div className="spec-data-item">
                      <div className="spec-label">EXHAUST VEL</div>
                      <div className="spec-value" style={{ color: item.color }}>{item.exhaustVelocity.toLocaleString()}</div>
                      <div className="spec-unit">m/s</div>
                    </div>
                  </div>
                  <div className="spec-isp-label">ISP EFFICIENCY</div>
                  <div className="spec-isp-track">
                    <div className="spec-isp-fill" style={{ width: `${(item.isp / 900) * 100}%`, background: item.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className={`launch ${!raceRunning ? 'launch-ready' : ''}`}
            onClick={startMission}
            disabled={raceRunning}
          >
            {raceRunning ? '⚡ LAUNCH IN PROGRESS' : '▶ INITIATE LAUNCH'}
          </button>
        </section>

        {/* ── COUNTDOWN OVERLAY ── */}
        {countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-label-top">LAUNCHING IN</div>
            <div className="countdown">{countdown}</div>
            <div className="countdown-label-bottom">SECONDS</div>
          </div>
        )}

        {/* ── RACE AREA ── */}
        <section className="race-area">
          <div className="section-header-row">
            <span className="section-title">■ EARTH → MARS TRAJECTORY SIMULATION</span>
            <span className="mission-phase-badge">PHASE 02 · TRANSIT</span>
          </div>

          <svg className="race-track" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="earthGrad" cx="45%" cy="40%" r="65%">
                <stop offset="0%" stopColor="#88c8ff" />
                <stop offset="60%" stopColor="#2255a0" />
                <stop offset="100%" stopColor="#0d1f45" />
              </radialGradient>
              <radialGradient id="marsGrad" cx="40%" cy="38%" r="65%">
                <stop offset="0%" stopColor="#ffa070" />
                <stop offset="60%" stopColor="#b03520" />
                <stop offset="100%" stopColor="#6e1a0a" />
              </radialGradient>
              <radialGradient id="earthAtmos" cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor="transparent" />
                <stop offset="100%" stopColor="#3388ff" stopOpacity="0.22" />
              </radialGradient>
              <radialGradient id="marsAtmos" cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor="transparent" />
                <stop offset="100%" stopColor="#ff5522" stopOpacity="0.18" />
              </radialGradient>
              <linearGradient id="spaceBg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#04071a" />
                <stop offset="50%" stopColor="#020510" />
                <stop offset="100%" stopColor="#030611" />
              </linearGradient>
            </defs>

            {/* Space background */}
            <rect x="0" y="0" width="1200" height="320" fill="url(#spaceBg)" />

            {/* Stars — deterministic positions */}
            {svgStars.map((s, i) => (
              <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.op}>
                <animate attributeName="opacity" dur={`${s.dur}s`} repeatCount="indefinite"
                  values={`${s.op};${Math.min(1, s.op + 0.45)};${s.op}`} />
              </circle>
            ))}

            {/* Per-rocket colored trajectory guide lines */}
            {Object.entries(activeMetrics).map(([key, rocket], idx) => (
              <line key={`traj-${key}`}
                x1="162" y1={TIERS[idx]}
                x2="1048" y2={TIERS[idx]}
                stroke={rocket.color} strokeDasharray="6 16" strokeWidth="0.9" opacity="0.2" />
            ))}

            {/* ── EARTH ── */}
            <g transform="translate(100, 160)">
              <circle cx="0" cy="0" r="80" fill="url(#earthAtmos)" />
              <ellipse cx="0" cy="0" rx="74" ry="15" fill="none" stroke="#4488bb" strokeWidth="0.9" opacity="0.22" />
              <circle cx="0" cy="0" r="55" fill="url(#earthGrad)" />
              <path d="M-20 -20 q18 -12 36 -4 q8 6 10 18 q-18 10 -38 6 Z" fill="#2a6ab8" opacity="0.55" />
              <path d="M-18 12 q14 -8 28 2 q4 10 -6 16 q-14 4 -22 -2 Z" fill="#2a6ab8" opacity="0.45" />
              <path d="M14 -8 q8 -6 14 2 q2 8 -4 12 q-8 2 -12 -4 Z" fill="#2a6ab8" opacity="0.4" />
              <ellipse cx="10" cy="-30" rx="22" ry="5" fill="#cce4ff" opacity="0.26" transform="rotate(-15 10 -30)" />
              <ellipse cx="-22" cy="22" rx="16" ry="4" fill="#cce4ff" opacity="0.2" transform="rotate(10 -22 22)" />
              <path d="M0 -55 q-20 28 0 55" stroke="#0a1830" strokeWidth="3" fill="none" opacity="0.32" />
              <rect x="-36" y="44" width="72" height="20" rx="3" fill="#060e22" stroke="#2a4a90" strokeWidth="1.5" opacity="0.92" />
              <text x="0" y="58" fill="#5599ee" fontSize="9" textAnchor="middle" fontFamily="Orbitron" fontWeight="700" letterSpacing="1">NASA LP</text>
            </g>

            {/* ── MARS ── */}
            <g transform="translate(1090, 160)">
              <circle cx="0" cy="0" r="66" fill="url(#marsAtmos)" />
              <circle cx="0" cy="0" r="48" fill="url(#marsGrad)" />
              <circle cx="-16" cy="-12" r="9" fill="#8a2010" opacity="0.55" />
              <circle cx="18" cy="16" r="6" fill="#8a2010" opacity="0.45" />
              <circle cx="-5" cy="22" r="4" fill="#8a2010" opacity="0.35" />
              <ellipse cx="0" cy="-44" rx="14" ry="5" fill="#ffe8d8" opacity="0.5" transform="rotate(-5 0 -44)" />
              <path d="M-30 0 q20 4 40 -2" stroke="#6a1808" strokeWidth="2" fill="none" opacity="0.4" />
              <path d="M0 -48 q18 24 0 48" stroke="#1a0606" strokeWidth="3" fill="none" opacity="0.28" />
              <rect x="-40" y="34" width="80" height="20" rx="3" fill="#120404" stroke="#7c2a14" strokeWidth="1.5" opacity="0.92" />
              <text x="0" y="48" fill="#ee7744" fontSize="8" textAnchor="middle" fontFamily="Orbitron" fontWeight="700" letterSpacing="1">MARS BASE</text>
            </g>

            {/* ── ROCKETS ── */}
            {Object.entries(activeMetrics).map(([key, rocket], idx) => {
              const tierY = TIERS[idx];
              const speedFactor = 1 + (rockets[key].transit / 123.5 - 1) * 0.9;
              const rocketProgress = clamp(raceProgress * speedFactor, 0, 1);
              const x = clamp(162 + rocketProgress * 876, 162, 1038);
              const arrived = arrivals[key];
              const daysElapsed = Math.round(raceProgress * rocket.transit);

              return (
                <g key={key} transform={`translate(${x}, ${tierY})`}>

                  {/* Exhaust flames — behind rocket (left side) */}
                  {!arrived && raceRunning && (
                    <>
                      <ellipse cx="-30" cy="0" rx="22" ry="7" fill="#ff5500" opacity="0.7">
                        <animate attributeName="rx" dur="0.14s" repeatCount="indefinite" values="22;32;22" />
                        <animate attributeName="opacity" dur="0.2s" repeatCount="indefinite" values="0.7;0.45;0.7" />
                      </ellipse>
                      <ellipse cx="-24" cy="0" rx="15" ry="4.5" fill="#ffaa00" opacity="0.88">
                        <animate attributeName="rx" dur="0.11s" repeatCount="indefinite" values="15;22;15" />
                      </ellipse>
                      <ellipse cx="-16" cy="0" rx="7" ry="2.5" fill="#fffde0" opacity="0.96" />
                    </>
                  )}

                  {/* Engine nozzle */}
                  <rect x="-22" y="-6" width="12" height="12" rx="2" fill="#555" />
                  <rect x="-22" y="-3" width="12" height="6" rx="1" fill="#888" opacity="0.5" />

                  {/* Main body */}
                  <rect x="-10" y="-12" width="38" height="24" rx="6" fill={rocket.color} />
                  {/* Body top highlight */}
                  <rect x="-7" y="-10" width="30" height="8" rx="4" fill="white" opacity="0.13" />
                  {/* Body bottom shadow */}
                  <rect x="-7" y="4" width="30" height="4" rx="2" fill="black" opacity="0.14" />

                  {/* Nose cone */}
                  <polygon points="28,-12 28,12 48,0" fill="#e8eeff" opacity="0.9" />
                  <polygon points="28,-12 28,0 48,0" fill="white" opacity="0.14" />

                  {/* Porthole window */}
                  <circle cx="8" cy="0" r="6" fill="#aadeFF" stroke="white" strokeWidth="1.5" opacity="0.9" />
                  <circle cx="8" cy="0" r="3.5" fill="#ddf5ff" opacity="0.55" />
                  <circle cx="6" cy="-2" r="1.5" fill="white" opacity="0.7" />

                  {/* Top fin */}
                  <polygon points="-10,-12 -22,-28 10,-12" fill={rocket.color} opacity="0.7" />
                  {/* Bottom fin */}
                  <polygon points="-10,12 -22,28 10,12" fill={rocket.color} opacity="0.7" />

                  {/* Panel detail lines */}
                  <line x1="4" y1="-12" x2="4" y2="12" stroke="white" strokeWidth="0.9" opacity="0.18" />
                  <line x1="18" y1="-12" x2="18" y2="12" stroke="white" strokeWidth="0.9" opacity="0.11" />

                  {/* Rocket name */}
                  <text x="14" y="-20" fill={rocket.color} fontSize="9" fontFamily="Orbitron" textAnchor="middle" fontWeight="700" opacity="0.95">
                    {rocket.label.toUpperCase()}
                  </text>

                  {/* Days elapsed / final transit */}
                  <text x="14" y="32" fill={rocket.color} fontSize="8" fontFamily="Share Tech Mono" textAnchor="middle" opacity="0.72">
                    {arrived ? `${rocket.transit} DAYS ✓` : raceRunning ? `${daysElapsed} DAYS` : ''}
                  </text>

                  {/* Arrival glow pulse ring */}
                  {arrived && (
                    <circle cx="14" cy="0" r="32" fill="none" stroke={rocket.color} strokeWidth="2" opacity="0.55">
                      <animate attributeName="r" dur="1.2s" repeatCount="indefinite" values="28;44;28" />
                      <animate attributeName="opacity" dur="1.2s" repeatCount="indefinite" values="0.55;0.08;0.55" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── TELEMETRY CARDS ── */}
          <div className="telemetry-grid">
            {Object.entries(activeMetrics).map(([key, rocket]) => {
              const arrived = arrivals[key];
              const overallPct = Math.min(100, raceProgress * 100);
              const radColor = radiationColor(rocket.radiation);

              return (
                <div
                  className="telemetry-card"
                  key={key}
                  style={{
                    borderColor: arrived ? rocket.color : rocket.color + '55',
                    boxShadow: arrived
                      ? `0 0 22px ${rocket.color}44, inset 0 0 14px ${rocket.color}0e`
                      : undefined,
                  }}
                >
                  <div className="telemetry-header">
                    <h4 style={{ color: rocket.color }}>{rocket.label}</h4>
                    <span
                      className={`telemetry-status-dot ${arrived ? 'arrived' : raceRunning ? 'transit' : ''}`}
                      style={arrived ? { background: rocket.color, boxShadow: `0 0 8px ${rocket.color}` } : {}}
                    />
                  </div>

                  <div className="telemetry-data-grid">
                    <span className="td-label">TRANSIT</span>
                    <span className="td-value">{rocket.transit} <small>days</small></span>

                    <span className="td-label">RADIATION</span>
                    <span className="td-value" style={{ color: radColor }}>
                      {rocket.radiation} <small>mSv</small>
                    </span>

                    <span className="td-label">PROPELLANT</span>
                    <span className="td-value">{rocket.propellant.toLocaleString()} <small>kg</small></span>

                    <span className="td-label">COST</span>
                    <span className="td-value">${rocket.cost}B</span>

                    <span className="td-label">LAUNCHES REQ</span>
                    <span className="td-value">{rocket.launches}</span>
                  </div>

                  <div className="telemetry-bars">
                    <div className="telemetry-bar-row">
                      <span className="td-label">CREW HEALTH</span>
                      <span className="td-value" style={{ color: rocket.crewHealth >= 70 ? '#2bd946' : '#ffc107' }}>
                        {rocket.crewHealth}%
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{
                        width: `${rocket.crewHealth}%`,
                        background: rocket.crewHealth >= 70 ? '#2bd946' : '#ffc107',
                      }} />
                    </div>

                    <div className="telemetry-bar-row">
                      <span className="td-label">SUCCESS PROB</span>
                      <span className="td-value" style={{ color: rocket.success >= 60 ? '#3B8BD4' : '#ffc107' }}>
                        {rocket.success}%
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{
                        width: `${rocket.success}%`,
                        background: rocket.success >= 60 ? '#3B8BD4' : '#ffc107',
                      }} />
                    </div>

                    <div className="telemetry-bar-row">
                      <span className="td-label">MISSION PROGRESS</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${overallPct}%`, background: rocket.color }} />
                    </div>
                  </div>

                  {arrived && (
                    <div
                      className="arrived-tag"
                      style={{ color: rocket.color, borderColor: rocket.color }}
                    >
                      ✓ ARRIVED AT MARS
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── MISSION DEBRIEF ── */}
        {showDebrief && (
          <section className="debrief">
            <div className="config-header">
              <span className="section-title">◈ MISSION DEBRIEF — COMPARATIVE ANALYSIS</span>
              <span className="mission-phase-badge">PHASE 03 · DEBRIEF</span>
            </div>

            <table className="debrief-table">
              <thead>
                <tr>
                  <th className="metric-col">METRIC</th>
                  {Object.entries(activeMetrics).map(([key, rocket]) => (
                    <th key={key} style={{ color: rocket.color }}>{rocket.label.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(METRIC_CONFIG).map(([metric, cfg]) => (
                  <tr key={metric}>
                    <td className="metric-col">
                      <span className="metric-name">{cfg.label}</span>
                      <span className="metric-unit">{cfg.unit}</span>
                    </td>
                    {Object.entries(activeMetrics).map(([key, rocket]) => {
                      const value = rocket[metric];
                      const isBest = value === bestMetrics[metric];
                      const bestColor = bestColorByMetric[metric];
                      return (
                        <td
                          key={key}
                          className={isBest ? 'best-cell' : ''}
                          style={isBest ? {
                            background: `${bestColor}1e`,
                            color: bestColor,
                            boxShadow: `inset 0 0 16px ${bestColor}22`,
                          } : {}}
                        >
                          {metric === 'propellant' ? Number(value).toLocaleString() : value}
                          {isBest && <span className="best-marker"> ★</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="insights">
              <div className="insights-header">
                <span className="insights-icon">⚛</span>
                <h3>Key Insight</h3>
              </div>
              <p>
                Nuclear Thermal wins again:{' '}
                <strong style={{ color: '#3B8BD4' }}>~{activeMetrics.nuclear.transit} days transit</strong>,{' '}
                <strong style={{ color: '#3B8BD4' }}>lowest propellant mass</strong>,{' '}
                lower radiation exposure, and highest mission success/crew health — all in a single launch.
                Backed by NERVA 1969 test data and NASA Mars DRA 5.0 architecture.
              </p>
            </div>

            <div className="sources">
              <div className="sources-title">DATA SOURCES</div>
              <div className="sources-list">
                NASA Mars DRA 5.0 · NERVA Program 1969 · NASA Curiosity RAD Instrument · NASA STD-3001 ·
                NASA ECLSS · NASA DSN · SpaceX Raptor Engine Specs · NASA JPL · NASA Inspector General 2022
              </div>
            </div>

            <button className="launch launch-ready new-mission-btn" onClick={runAgain}>
              ↺ NEW MISSION
            </button>
          </section>
        )}

      </div>
    </div>
  );
}

export default App;
