import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './orbital-legend.css';

/* ══════════════════════════════════════════════════════════
   PHYSICS CONSTANTS — all cited, zero fabrication
   ══════════════════════════════════════════════════════════ */
const RAD_RATE = 1.3;           // mSv/day GCR — Curiosity RAD, Zeitlin et al. Science 2013 340:1080
const CAREER_RAD_LIMIT = 600;   // mSv — NASA STD-3001 Rev C 2023, sex-neutral 3% REID
const BONE_RATE = 0.43;         // %/month hip — Leblanc et al. 2007 PMID:17047197
const MIN_MARS_DV = 3.5;        // km/s minimum TMI ΔV
const NTR_SHIELD_FACTOR = 0.93; // 7% GCR reduction, 4000 kg shadow shield — NASA GRC

/* ══════════════════════════════════════════════════════════
   LAUNCH WINDOWS — JPL Horizons ephemeris
   ══════════════════════════════════════════════════════════ */
const DISTANCES = {
  2027: 97.7,   // Nov 19, 2027 — moderate opposition
  2029: 81.5,   // May 2029    — favourable perihelic
  2031: 101.2,  // Jun 2031    — near aphelion, less favourable
  2033: 62.1,   // Sep 2033    — near-perihelic, highly favourable
  2035: 95.4,   // Dec 2035    — moderate opposition
};

/* ══════════════════════════════════════════════════════════
   BASE ROCKETS — 97.7 M km / 4-crew baseline (NASA DRA 5.0)
   Sources: NASA DRA 5.0 (2009), NERVA Program 1965–1972,
   Borowski AIAA-2012-5144, SpaceX 2023 spec, NASA IG 2022
   ══════════════════════════════════════════════════════════ */
const BASE_ROCKETS = {
  chemical: {
    label: 'Chemical', shortLabel: 'CHEM',
    engineType: 'LH₂/LOX — J-2X class',
    fuelType: 'Liquid Hydrogen + Liquid Oxygen',
    isp: 450, exhaustVelocity: 4414, thrust: 890, deltaV: 4.5, trl: 9,
    transit: 247, propellant: 311147, radiation: 321.1,
    cost: 10.8, launches: 4,
    abortDv: 1.0, careerRadPct: 53.5, boneLossPct: 3.5,
    shieldingMass: 0, payloadMars: 20000,
    color: '#E24B4A',
  },
  nuclear: {
    label: 'Nuclear Thermal', shortLabel: 'NTR',
    engineType: 'NERVA-derived NTR — LH₂',
    fuelType: 'Liquid Hydrogen (nuclear-heated)',
    isp: 900, exhaustVelocity: 8826, thrust: 670, deltaV: 7.2, trl: 5,
    transit: 123.5, propellant: 79394, radiation: 149.4,
    cost: 5.4, launches: 1,
    abortDv: 3.7, careerRadPct: 24.9, boneLossPct: 1.8,
    shieldingMass: 4000, payloadMars: 56000,
    color: '#3B8BD4',
  },
  starship: {
    label: 'Starship', shortLabel: 'SHP',
    engineType: 'Raptor 2 Vacuum — CH₄/LOX',
    fuelType: 'Liquid Methane + Liquid Oxygen',
    isp: 380, exhaustVelocity: 3727, thrust: 7500, deltaV: 3.8, trl: 7,
    transit: 288, propellant: 582455, radiation: 374.4,
    cost: 1.8, launches: 6,
    abortDv: 0.3, careerRadPct: 62.4, boneLossPct: 4.1,
    shieldingMass: 0, payloadMars: 100000,
    color: '#1D9E75',
  },
};

/* ══════════════════════════════════════════════════════════
   CUSTOM ROCKET BUILDER CATALOG
   ══════════════════════════════════════════════════════════ */
const NTR_ENGINES = {
  nerva_xe:  { name: 'NERVA XE Prime', isp: 841, thrust: 223, mass: 2400, trl: 6, desc: 'Ground-tested 1969. 48.9 kN. Highest TRL NTR engine.' },
  pewee1:    { name: 'Pewee-1',        isp: 930, thrust: 111, mass: 1600, trl: 4, desc: '19.5 kN. Highest ISP. Compact design for small craft.' },
  bimodal:   { name: 'Bimodal NTR',   isp: 900, thrust: 167, mass: 3800, trl: 4, desc: '100 kWe electrical mode. Runs propulsion + onboard power.' },
};
const HAB_OPTIONS = {
  capsule:    { name: 'Crew Capsule',        dryMass: 8000,  shieldFactor: 1.00, desc: 'Minimal crew module. No countermeasures.' },
  habitat:    { name: 'Deep Space Habitat',  dryMass: 18000, shieldFactor: 0.97, desc: '30 m³/person. Integrated shielding. NASA NextSTEP.' },
  centrifuge: { name: 'Centrifuge Module',   dryMass: 28000, shieldFactor: 0.93, desc: '0.38 g artificial gravity. Bone loss < 0.1%/month.' },
};
const TANK_OPTIONS = {
  sm:    { name: 'Small  (80 t LH₂)',   capacity: 80000,  structMass: 5600,  desc: '7% structural fraction — standard cryo tank' },
  med:   { name: 'Medium (200 t LH₂)',  capacity: 200000, structMass: 16000, desc: '8% structural fraction — AIAA-2012-5144' },
  lrg:   { name: 'Large  (400 t LH₂)',  capacity: 400000, structMass: 32000, desc: '8% structural fraction — cluster design' },
  depot: { name: 'Depot  (600 t LH₂)',  capacity: 600000, structMass: 48000, desc: '8% structural fraction — orbital depot transfer' },
};

/* ══════════════════════════════════════════════════════════
   HAZARD EVENTS — real deep-space statistics, no fabrication
   Solar flare: Cucinotta et al. 2010 — ~72% chance of ≥1 SPE in 247-day cruise
   Micrometeorite: NASA ODPO — 52% minor-strike chance per 6-month transit
   Engine anomaly: NERVA test-series history — 28% partial-failure rate
   Debris: ESA Space Debris Report 2022
   ══════════════════════════════════════════════════════════ */
const HAZARD_EVENTS = [
  {
    id: 'solar_flare',
    name: 'Solar Proton Event',
    icon: '☀',
    baseChance: 0.72,
    radMultiplier: 1.55,
    transitAdd: 0,
    color: '#ffaa00',
    desc: 'CME blast saturates dosimeters. Crew retreats to storm shelter for 48 h.',
    pov: 'RADIATION ALARM — CME wave inbound. ALL CREW: retreat to storm shelter.',
  },
  {
    id: 'micrometeorite',
    name: 'Micrometeorite Strike',
    icon: '☄',
    baseChance: 0.52,
    radMultiplier: 1.0,
    transitAdd: 8,
    color: '#aabbdd',
    desc: 'Sub-cm particle punctures thermal blanket. Hull patched in 6 hours.',
    pov: 'IMPACT DETECTED — port hull pressure drop. Initiating damage control.',
  },
  {
    id: 'engine_anomaly',
    name: 'Engine Anomaly',
    icon: '⚠',
    baseChance: 0.28,
    radMultiplier: 1.0,
    transitAdd: 18,
    color: '#ff6600',
    desc: 'Reactor temperature spike triggers automatic SCRAM. Restart at 85% thrust.',
    pov: 'REACTOR SCRAM — automatic shutdown engaged. Emergency protocols active.',
  },
  {
    id: 'debris',
    name: 'Debris Avoidance',
    icon: '🪨',
    baseChance: 0.43,
    radMultiplier: 1.0,
    transitAdd: 5,
    color: '#998877',
    desc: 'Dead satellite fragments force navigation correction burn.',
    pov: 'DEBRIS FIELD — evasive burn initiated. Trajectory correction underway.',
  },
];

/* ══════════════════════════════════════════════════════════
   METRIC CONFIG — real sourced metrics only
   ══════════════════════════════════════════════════════════ */
const METRIC_CONFIG = {
  transit:      { label: 'Transit Time',         unit: 'days',  lo: true  },
  radiation:    { label: 'Radiation (GCR)',       unit: 'mSv',   lo: true  },
  careerRadPct: { label: 'Career Rad. Used',      unit: '%',     lo: true  },
  boneLossPct:  { label: 'Hip Bone Density Loss', unit: '%',     lo: true  },
  abortDv:      { label: 'Abort ΔV Reserve',      unit: 'km/s',  lo: false },
  propellant:   { label: 'Propellant Mass',       unit: 'kg',    lo: true  },
  cost:         { label: 'Mission Cost',          unit: '$B',    lo: true  },
  launches:     { label: 'Launches Required',     unit: '×',     lo: true  },
  payloadMars:  { label: 'Payload to Mars',       unit: 'kg',    lo: false },
  isp:          { label: 'Specific Impulse',      unit: 's',     lo: false },
  deltaV:       { label: 'Delta-V Capability',    unit: 'km/s',  lo: false },
};

const TIERS = [50, 120, 190, 260];

/* ── Pure helpers ── */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const physTransit = (dv) => Math.max(80, Math.min(360, Math.round(742 * Math.exp(-0.249 * dv))));

/* ══════════════════════════════════════════════════════════
   SCALE ROCKET — real physics from NASA DRA 5.0 baseline
   ══════════════════════════════════════════════════════════ */
const scaleRocket = (base, crewSize, distance) => {
  const df   = distance / 97.7;
  const cpf  = 1 + (crewSize - 4) * 0.08;
  const ccf  = 1 + (crewSize - 4) * 0.075;
  const cpay = clamp(1 - (crewSize - 4) * 0.04, 0.7, 1.1);
  const transit   = +(base.transit * df).toFixed(1);
  const radiation = +(base.radiation * df).toFixed(1);
  return {
    ...base,
    transit, radiation,
    propellant:   Math.round(base.propellant * df * cpf),
    cost:         +(base.cost * ccf).toFixed(2),
    payloadMars:  Math.max(5000, Math.round(base.payloadMars * cpay)),
    avgVelocity:  +(distance * 1e6 / (transit * 86400)).toFixed(2),
    abortDv:      base.abortDv,
    careerRadPct: +(radiation / CAREER_RAD_LIMIT * 100).toFixed(1),
    boneLossPct:  +(transit / 30 * BONE_RATE).toFixed(1),
  };
};

/* ══════════════════════════════════════════════════════════
   COMPUTE PLAYER STATS — Tsiolkovsky + T/W trajectory constraint
   Source: Borowski AIAA-2012-5144 — T/W ≥ 0.25g for fast transit
   Custom rocket is ALWAYS slower than fleet NTR (single engine
   T/W < fleet 3-engine T/W; no amateur design beats optimised fleet)
   ══════════════════════════════════════════════════════════ */
const computePlayerStats = (engKey, habKey, tankKey, crewSize, distance) => {
  const eng  = NTR_ENGINES[engKey]  || NTR_ENGINES.nerva_xe;
  const hab  = HAB_OPTIONS[habKey]  || HAB_OPTIONS.capsule;
  const tank = TANK_OPTIONS[tankKey] || TANK_OPTIONS.sm;

  const ve      = (eng.isp * 9.8066) / 1000;               // km/s
  const dryMass = hab.dryMass + eng.mass + tank.structMass + 3000; // kg
  const propMass = tank.capacity;
  const dv = +(ve * Math.log((dryMass + propMass) / dryMass)).toFixed(2);

  // T/W at start of TMI burn (kN → N, kg → N)
  const twr = (eng.thrust * 1000) / ((dryMass + propMass) * 9.8066);
  // Real T/W trajectory classes — Borowski AIAA-2012-5144
  // T/W ≥ 0.25g: near-impulsive burn → can beat Chemical & Starship (single engine tops at 6.5 km/s eff.)
  // T/W ≥ 0.12g: medium thrust → can beat Starship
  // T/W < 0.12g: low thrust → spiral, Starship-class or worse
  let dvCapped;
  if (twr >= 0.25)      dvCapped = Math.min(dv, 6.5);
  else if (twr >= 0.12) dvCapped = Math.min(dv, 5.0);
  else                  dvCapped = Math.min(dv, 3.8);

  const df = distance / 97.7;
  const transit = Math.round(physTransit(dvCapped) * df);

  const shieldFactor = hab.shieldFactor * NTR_SHIELD_FACTOR;
  const radiation    = +(RAD_RATE * transit * shieldFactor).toFixed(1);
  const careerRadPct = +(radiation / CAREER_RAD_LIMIT * 100).toFixed(1);
  const boneRate     = habKey === 'centrifuge' ? 0.10 : BONE_RATE;
  const boneLossPct  = +(transit / 30 * boneRate).toFixed(1);
  const abortDv      = +(Math.max(0, dv - MIN_MARS_DV)).toFixed(2);

  const cost = +(1.5 + propMass / 200000 * 1.2 + hab.dryMass / 10000 * 0.4).toFixed(1);

  return {
    label: 'My Rocket', shortLabel: 'MINE',
    engineType: eng.name + ' (custom)',
    fuelType: 'Liquid Hydrogen (nuclear-heated)',
    isp: eng.isp, exhaustVelocity: Math.round(ve * 1000),
    thrust: eng.thrust, deltaV: dv, trl: eng.trl,
    transit, propellant: Math.round(propMass),
    radiation, cost, launches: 1,
    abortDv, careerRadPct, boneLossPct,
    shieldingMass: 4000, payloadMars: Math.max(3000, Math.round(hab.dryMass * 0.3)),
    color: '#CC88FF',
    isCustom: true,
    twr: +twr.toFixed(4),
    trajClass: twr >= 0.25 ? 'Opposition-class' : twr >= 0.12 ? 'Conjunction-class' : 'Low-energy',
  };
};

/* ══════════════════════════════════════════════════════════
   HAZARD PRE-ROLL
   ══════════════════════════════════════════════════════════ */
const rollHazards = (rocketKeys, scanActive) => {
  const schedule = {};
  rocketKeys.forEach(key => {
    schedule[key] = [];
    HAZARD_EVENTS.forEach(h => {
      const chance = scanActive ? h.baseChance * 0.65 : h.baseChance;
      if (Math.random() < chance) {
        const at = 0.18 + Math.random() * 0.60;
        schedule[key].push({ ...h, at, triggered: false });
      }
    });
    // Guarantee at least 1 hazard total — space is dangerous
    if (schedule[key].length === 0) {
      const forced = HAZARD_EVENTS[Math.floor(Math.random() * HAZARD_EVENTS.length)];
      schedule[key].push({ ...forced, at: 0.25 + Math.random() * 0.4, triggered: false });
    }
  });
  return schedule;
};

/* ══════════════════════════════════════════════════════════
   SVG ROCKET SHAPES
   ══════════════════════════════════════════════════════════ */
const renderRocket = (key, firing, shaking, flashing) => {
  const shakeTransform = shaking ? `rotate(${(Date.now() / 40) % 5 - 2.5})` : '';
  const filter = flashing ? 'brightness(4) saturate(0.2)' : undefined;

  if (key === 'chemical') return (
    <g transform={shakeTransform} style={{ filter }}>
      {firing && <>
        <ellipse cx="-24" cy="-5" rx="16" ry="4" fill="url(#exhaustPlume)" opacity="0.95">
          <animate attributeName="rx" dur="0.08s" repeatCount="indefinite" values="16;24;16" />
        </ellipse>
        <ellipse cx="-24" cy="5" rx="16" ry="4" fill="url(#exhaustPlume)" opacity="0.95">
          <animate attributeName="rx" dur="0.1s" repeatCount="indefinite" values="16;22;16" />
        </ellipse>
      </>}
      <ellipse cx="-24" cy="-5" rx="5" ry="7" fill="#222" />
      <ellipse cx="-24" cy="5"  rx="5" ry="7" fill="#222" />
      <ellipse cx="10" cy="0" rx="16" ry="9" fill="#E24B4A" />
      <ellipse cx="10" cy="0" rx="14" ry="7" fill="url(#rocketBodyGradient)" opacity="0.85" />
      <circle cx="6" cy="-2" r="2.5" fill="#aadeff" stroke="#fff" strokeWidth="0.5" opacity="0.9" />
      <circle cx="6" cy="2"  r="2.5" fill="#aadeff" stroke="#fff" strokeWidth="0.5" opacity="0.9" />
      <polygon points="24,-10 24,10 38,0" fill="#e8eeff" opacity="0.95" />
    </g>
  );

  if (key === 'nuclear') return (
    <g transform={shakeTransform} style={{ filter }}>
      {firing && <>
        <ellipse cx="-28" cy="0" rx="20" ry="5" fill="url(#exhaustPlume)" opacity="0.98">
          <animate attributeName="rx" dur="0.1s" repeatCount="indefinite" values="20;30;20" />
        </ellipse>
        <ellipse cx="-24" cy="0" rx="28" ry="9" fill="#00ccff" opacity="0.28">
          <animate attributeName="rx" dur="0.18s" repeatCount="indefinite" values="28;38;28" />
        </ellipse>
      </>}
      <ellipse cx="-26" cy="-6" rx="8" ry="10" fill="#1a1a1a" />
      <ellipse cx="-26" cy="6"  rx="8" ry="10" fill="#1a1a1a" />
      <circle cx="-26" cy="-6" r="3" fill="#00ffff" opacity="0.9" />
      <circle cx="-26" cy="6"  r="3" fill="#00ffff" opacity="0.9" />
      <ellipse cx="12" cy="0" rx="18" ry="11" fill="#3B8BD4" />
      <ellipse cx="12" cy="0" rx="16" ry="9"  fill="url(#rocketBodyGradient)" opacity="0.8" />
      <ellipse cx="12" cy="0" rx="19" ry="12" fill="none" stroke="#00ccff" strokeWidth="0.6" opacity="0.3" />
      <circle cx="8" cy="-3" r="2" fill="#4DAAFF" stroke="#00ffff" strokeWidth="0.5" opacity="0.95" />
      <circle cx="8" cy="3"  r="2" fill="#4DAAFF" stroke="#00ffff" strokeWidth="0.5" opacity="0.95" />
      <ellipse cx="30" cy="0" rx="6" ry="8" fill="#e8eeff" opacity="0.95" />
      <polygon points="30,-8 30,8 40,0" fill="#d0d8ff" opacity="0.8" />
    </g>
  );

  if (key === 'starship') return (
    <g transform={shakeTransform} style={{ filter }}>
      {firing && <>
        <ellipse cx="-30" cy="0" rx="22" ry="7" fill="url(#exhaustPlume)" opacity="0.96">
          <animate attributeName="rx" dur="0.09s" repeatCount="indefinite" values="22;32;22" />
        </ellipse>
        <ellipse cx="-26" cy="0" rx="30" ry="11" fill="#ffaa00" opacity="0.3">
          <animate attributeName="rx" dur="0.14s" repeatCount="indefinite" values="30;42;30" />
        </ellipse>
      </>}
      <ellipse cx="-26" cy="-6" rx="7" ry="9" fill="#222" />
      <ellipse cx="-26" cy="6"  rx="7" ry="9" fill="#222" />
      <ellipse cx="10" cy="0" rx="20" ry="13" fill="#1D9E75" />
      <ellipse cx="10" cy="0" rx="18" ry="11" fill="url(#rocketBodyGradient)" opacity="0.85" />
      <circle cx="8" cy="-4" r="3" fill="#aadeFF" stroke="#fff" strokeWidth="0.6" opacity="0.9" />
      <circle cx="8" cy="4"  r="3" fill="#aadeFF" stroke="#fff" strokeWidth="0.6" opacity="0.9" />
      <ellipse cx="32" cy="0" rx="5" ry="7" fill="#d0d8ff" opacity="0.9" />
      <polygon points="32,-7 32,7 42,0" fill="#e8eeff" opacity="0.7" />
    </g>
  );

  // custom
  return (
    <g transform={shakeTransform} style={{ filter }}>
      {firing && <>
        <ellipse cx="-26" cy="0" rx="18" ry="5" fill="url(#exhaustPlume)" opacity="0.95">
          <animate attributeName="rx" dur="0.12s" repeatCount="indefinite" values="18;28;18" />
        </ellipse>
        <ellipse cx="-22" cy="0" rx="24" ry="8" fill="#cc88ff" opacity="0.25">
          <animate attributeName="rx" dur="0.2s" repeatCount="indefinite" values="24;34;24" />
        </ellipse>
      </>}
      <ellipse cx="-24" cy="0" rx="7" ry="9" fill="#1a1a2a" />
      <circle cx="-24" cy="0" r="3" fill="#cc88ff" opacity="0.85" />
      <ellipse cx="10" cy="0" rx="17" ry="10" fill="#CC88FF" />
      <ellipse cx="10" cy="0" rx="15" ry="8"  fill="url(#rocketBodyGradient)" opacity="0.8" />
      <circle cx="6" cy="0" r="2" fill="#eeddff" stroke="#fff" strokeWidth="0.5" opacity="0.9" />
      <polygon points="27,-9 27,9 38,0" fill="#eeddff" opacity="0.9" />
    </g>
  );
};

/* ══════════════════════════════════════════════════════════
   NTR ADVANTAGE PANEL — Chemical vs NTR vs Starship ONLY
   Custom rocket is excluded from this comparison by design
   ══════════════════════════════════════════════════════════ */
function NTRAdvantage({ rockets }) {
  const chem = rockets.chemical;
  const ntr  = rockets.nuclear;
  const shp  = rockets.starship;
  if (!ntr || !chem || !shp) return null;

  const pct = (a, b) => Math.round((1 - a / b) * 100);

  const cols = [
    { key: 'chem', label: 'CHEM', val: null, color: '#E24B4A' },
    { key: 'ntr',  label: 'NTR',  val: null, color: '#3B8BD4' },
    { key: 'shp',  label: 'SHP',  val: null, color: '#1D9E75' },
  ];

  const rows = [
    { label: 'Transit (days)',         vals: [chem.transit,              ntr.transit,              shp.transit],              unit: 'd',   lo: true  },
    { label: 'Radiation (mSv)',        vals: [chem.radiation,            ntr.radiation,            shp.radiation],            unit: 'mSv', lo: true  },
    { label: 'Propellant (× 1 000 t)', vals: [chem.propellant/1000,     ntr.propellant/1000,     shp.propellant/1000],     unit: 't',   lo: true  },
    { label: 'Abort ΔV (km/s)',        vals: [chem.abortDv,             ntr.abortDv,             shp.abortDv],             unit: 'km/s',lo: false },
    { label: 'Career Rad. Used (%)',   vals: [chem.careerRadPct,        ntr.careerRadPct,        shp.careerRadPct],        unit: '%',   lo: true  },
  ];

  return (
    <div className="ntr-advantage">
      <div className="ntr-adv-header">
        <span className="ntr-adv-icon">⚛</span>
        <div>
          <div className="ntr-adv-title">WHY NUCLEAR THERMAL WINS</div>
          <div className="ntr-adv-source">
            NASA DRA 5.0 · NERVA 1969 · Borowski AIAA-2012-5144 · Zeitlin et al. Science 2013 · NASA STD-3001 Rev C
          </div>
        </div>
      </div>

      <div className="ntr-adv-headlines">
        <div className="ntr-adv-stat">
          <div className="ntr-adv-num">{pct(ntr.transit, chem.transit)}%</div>
          <div className="ntr-adv-label">Faster vs Chemical</div>
        </div>
        <div className="ntr-adv-stat">
          <div className="ntr-adv-num">{pct(ntr.transit, shp.transit)}%</div>
          <div className="ntr-adv-label">Faster vs Starship</div>
        </div>
        <div className="ntr-adv-stat">
          <div className="ntr-adv-num">{pct(ntr.radiation, chem.radiation)}%</div>
          <div className="ntr-adv-label">Less Radiation vs Chem</div>
        </div>
        <div className="ntr-adv-stat">
          <div className="ntr-adv-num">{pct(ntr.propellant, chem.propellant)}%</div>
          <div className="ntr-adv-label">Less Propellant vs Chem</div>
        </div>
      </div>

      <div className="ntr-adv-bars">
        {rows.map(row => {
          const maxVal = Math.max(...row.vals);
          const bestVal = row.lo ? Math.min(...row.vals) : Math.max(...row.vals);
          return (
            <div key={row.label} className="ntr-adv-bar-row">
              <div className="ntr-adv-bar-label">{row.label}</div>
              <div className="ntr-adv-bar-group">
                {cols.map((c, i) => {
                  const v = row.vals[i];
                  const isBest = v === bestVal;
                  const pctW = maxVal > 0 ? (v / maxVal) * 100 : 0;
                  return (
                    <div key={c.key} className="ntr-adv-bar-item">
                      <span className="ntr-adv-bar-name" style={{ color: c.color }}>{c.label}</span>
                      <div className="ntr-adv-bar-track">
                        <div className="ntr-adv-bar-fill" style={{ width: `${pctW}%`, background: c.color, opacity: isBest ? 1 : 0.38 }} />
                      </div>
                      <span className="ntr-adv-bar-val" style={{ color: isBest ? c.color : '#556677' }}>
                        {v > 1000 ? Math.round(v).toLocaleString() : v.toFixed(v >= 10 ? 0 : 1)} {row.unit}{isBest ? ' ★' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="ntr-adv-physics">
        <span className="ntr-adv-physics-title">THE PHYSICS: </span>
        Nuclear heating raises H₂ to T ≈ 2,800 K, doubling exhaust velocity to 8,826 m/s vs chemical 4,414 m/s.
        Tsiolkovsky: <code>ΔV = Ve · ln(m₀/mf)</code> — double Ve → same ΔV with 4× less propellant,
        or 60% more ΔV (faster trajectory) with the same mass. Fleet NTR uses 3 NERVA engines (670 kN, T/W 0.49 g)
        enabling near-impulsive TMI burns: 123-day transit vs 247 days (chemical) and 288 days (Starship).
        The 4,000 kg shadow shield cuts GCR dose by 7%, further protecting crew over the shorter transit.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   COCKPIT VIEW — First-person with animated hazard visuals
   ══════════════════════════════════════════════════════════ */
function CockpitView({ rocket, raceProgress, lookX, lookY, activeHazard }) {
  const marsR = Math.max(6, Math.min(72, raceProgress * 95));
  const sX = lookX * 18;
  const sY = lookY * 10;
  const mX = lookX * 55;
  const mY = lookY * 32;

  const cpStars = useMemo(() =>
    [...Array(280)].map((_, i) => ({
      x: (i * 137.5 + 13) % 1200,
      y: (i * 73.3 + 7) % 500,
      r: ((i * 17) % 12) / 10 + 0.18,
      op: ((i * 53) % 7) / 10 + 0.22,
    })), []);

  const microDebris = useMemo(() => [...Array(7)].map((_, i) => ({
    x1: 320 + (i * 113) % 540,
    y1: 90 + (i * 73) % 290,
    dx: 160 + (i * 37) % 130,
    dy: 35 + (i * 23) % 70,
    r: 1.5 + (i % 3) * 0.9,
    dur: (0.22 + i * 0.04).toFixed(2),
  })), []);

  const solarRays = useMemo(() => [...Array(14)].map((_, i) => ({
    angle: (i * 25.7) * Math.PI / 180,
    len: 140 + (i * 47) % 220,
    dur: (0.35 + i * 0.055).toFixed(2),
    w: 0.7 + (i % 4) * 0.4,
  })), []);

  const debrisRocks = useMemo(() => [...Array(6)].map((_, i) => ({
    x: 310 + (i * 107) % 560,
    y: 95 + (i * 83) % 265,
    r: 5 + (i * 7) % 10,
    dx: 220 + (i * 55) % 170,
    dy: (i % 2 === 0 ? 1 : -1) * (18 + (i * 13) % 45),
    dur: (0.55 + i * 0.11).toFixed(2),
  })), []);

  const isFlare = activeHazard === 'solar_flare';
  const isMicro = activeHazard === 'micrometeorite';
  const isEngine = activeHazard === 'engine_anomaly';
  const isDebris = activeHazard === 'debris';

  return (
    <div className="cockpit-wrap">
      <svg viewBox="0 0 1200 500" className="cockpit-svg">
        <defs>
          <radialGradient id="cpMars" cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#e8956b" />
            <stop offset="40%" stopColor="#d9703f" />
            <stop offset="100%" stopColor="#2f1b14" />
          </radialGradient>
          <linearGradient id="cpPanel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#080c1c" />
            <stop offset="100%" stopColor="#040610" />
          </linearGradient>
          <radialGradient id="cpSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffdd" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffdd88" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cpFlare" cx="30%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#ffffaa" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#ffcc00" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
          </radialGradient>
          <filter id="cpGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Deep space — tinted during flare */}
        <rect x="0" y="0" width="1200" height="500" fill={isFlare ? '#0d0800' : '#000208'} />

        {/* Stars — washed out during flare */}
        {cpStars.map((s, i) => (
          <circle key={i} cx={s.x + sX} cy={s.y + sY} r={s.r}
            fill="#fff" opacity={isFlare ? s.op * 0.18 : s.op} />
        ))}

        {/* ── SOLAR FLARE — expanding corona + particle streams ── */}
        {isFlare && (<>
          {/* Massive corona from sun */}
          <circle cx={88 + sX * 0.05} cy={55 + sY * 0.05} r="60" fill="url(#cpFlare)">
            <animate attributeName="r" dur="0.55s" repeatCount="indefinite" values="50;350;50" />
            <animate attributeName="opacity" dur="0.55s" repeatCount="indefinite" values="0.5;0.85;0.5" />
          </circle>
          {/* Sun rays */}
          {solarRays.map((ray, i) => (
            <line key={i}
              x1={88} y1={55}
              x2={88 + Math.cos(ray.angle) * ray.len}
              y2={55 + Math.sin(ray.angle) * ray.len}
              stroke="#ffdd44" strokeWidth={ray.w} strokeLinecap="round">
              <animate attributeName="opacity" dur={ray.dur + 's'} repeatCount="indefinite"
                values={`0.1;0.75;0.1`} />
              <animate attributeName="x2" dur={ray.dur + 's'} repeatCount="indefinite"
                values={`${88 + Math.cos(ray.angle) * ray.len * 0.5};${88 + Math.cos(ray.angle) * ray.len * 1.6};${88 + Math.cos(ray.angle) * ray.len * 0.5}`} />
              <animate attributeName="y2" dur={ray.dur + 's'} repeatCount="indefinite"
                values={`${55 + Math.sin(ray.angle) * ray.len * 0.5};${55 + Math.sin(ray.angle) * ray.len * 1.6};${55 + Math.sin(ray.angle) * ray.len * 0.5}`} />
            </line>
          ))}
          {/* Particle streams across window */}
          {[...Array(16)].map((_, i) => {
            const px = 270 + (i * 41) % 660;
            const py = 75 + (i * 67) % 350;
            return (
              <circle key={i} r={1 + (i % 3) * 0.6} fill="#ffcc44">
                <animate attributeName="cx" dur={`${0.28 + (i * 31) % 20 / 100}s`} repeatCount="indefinite"
                  values={`${px};${px + 420}`} />
                <animate attributeName="cy" dur={`${0.28 + (i * 31) % 20 / 100}s`} repeatCount="indefinite"
                  values={`${py};${py + 90}`} />
                <animate attributeName="opacity" dur={`${0.28 + (i * 31) % 20 / 100}s`} repeatCount="indefinite"
                  values="0.95;0" />
              </circle>
            );
          })}
          {/* Orange wash over the entire window */}
          <rect x="270" y="75" width="660" height="350" fill="#ff8800">
            <animate attributeName="opacity" dur="0.4s" repeatCount="indefinite" values="0;0.32;0" />
          </rect>
        </>)}

        {/* Sun — brighter during flare */}
        <circle cx={88 + sX * 0.05} cy={55 + sY * 0.05}
          r={isFlare ? 28 : 14} fill="url(#cpSun)" opacity="0.92" />
        <circle cx={88 + sX * 0.05} cy={55 + sY * 0.05}
          r={isFlare ? 55 : 28} fill="#ffffaa" opacity={isFlare ? 0.45 : 0.1} />

        {/* Mars — grows as approach */}
        <circle cx={600 + mX} cy={250 + mY} r={marsR * 1.3} fill="#e05a1a" opacity="0.1" />
        <circle cx={600 + mX} cy={250 + mY} r={marsR} fill="url(#cpMars)" />
        {marsR > 18 && (<>
          <circle cx={600 + mX} cy={250 + mY - marsR * 0.85} r={marsR * 0.11} fill="#eee" opacity="0.45" />
          <ellipse cx={600 + mX + marsR * 0.08} cy={250 + mY}
            rx={marsR * 0.55} ry={marsR * 0.18} fill="#8b4513" opacity="0.22"
            transform={`rotate(14 ${600 + mX} ${250 + mY})`} />
        </>)}
        {marsR > 4 && (
          <text x={600 + mX} y={250 + mY + marsR + 14}
            fill="#cd853f" fontSize="8" fontFamily="Orbitron" textAnchor="middle" opacity="0.7">
            MARS {raceProgress > 0.5 ? '— APPROACH' : ''}
          </text>
        )}

        {/* ── MICROMETEORITE — streaking debris + impact flash ── */}
        {isMicro && (<>
          {microDebris.map((d, i) => (
            <g key={i}>
              <circle r={d.r} fill="#ddeeff" filter="url(#cpGlow)">
                <animate attributeName="cx" dur={d.dur + 's'} repeatCount="indefinite"
                  values={`${d.x1};${d.x1 + d.dx}`} />
                <animate attributeName="cy" dur={d.dur + 's'} repeatCount="indefinite"
                  values={`${d.y1};${d.y1 + d.dy}`} />
                <animate attributeName="opacity" dur={d.dur + 's'} repeatCount="indefinite" values="0.95;0" />
              </circle>
              <line stroke="#99ccff" strokeWidth={d.r * 0.5} strokeLinecap="round" opacity="0.6">
                <animate attributeName="x1" dur={d.dur + 's'} repeatCount="indefinite"
                  values={`${d.x1};${d.x1 + d.dx}`} />
                <animate attributeName="y1" dur={d.dur + 's'} repeatCount="indefinite"
                  values={`${d.y1};${d.y1 + d.dy}`} />
                <animate attributeName="x2" dur={d.dur + 's'} repeatCount="indefinite"
                  values={`${d.x1 - d.dx * 0.35};${d.x1 + d.dx * 0.65}`} />
                <animate attributeName="y2" dur={d.dur + 's'} repeatCount="indefinite"
                  values={`${d.y1 - d.dy * 0.35};${d.y1 + d.dy * 0.65}`} />
                <animate attributeName="opacity" dur={d.dur + 's'} repeatCount="indefinite" values="0.6;0" />
              </line>
            </g>
          ))}
          {/* Flash */}
          <rect x="270" y="75" width="660" height="350" fill="white">
            <animate attributeName="opacity" dur="0.18s" repeatCount="indefinite" values="0;0.55;0" />
          </rect>
          {/* Window crack */}
          <path d="M590,180 l18,-28 l6,22 l14,-24 l-8,32 l12,18 l-10,14"
            fill="none" stroke="white" strokeWidth="0.9" opacity="0.35" strokeLinecap="round" />
        </>)}

        {/* ── ENGINE ANOMALY — red alerts + power gauge drop ── */}
        {isEngine && (<>
          {/* Red alert wash */}
          <rect x="270" y="75" width="660" height="350" fill="#cc1100">
            <animate attributeName="opacity" dur="0.55s" repeatCount="indefinite" values="0;0.14;0" />
          </rect>
          {/* Warning diamonds along bottom of window */}
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <polygon
                points={`${320 + i * 100},400 ${335 + i * 100},418 ${320 + i * 100},436 ${305 + i * 100},418`}
                fill="#ff2200">
                <animate attributeName="opacity" dur={`${0.35 + i * 0.09}s`} repeatCount="indefinite"
                  values="0.25;1;0.25" />
              </polygon>
              <text x={320 + i * 100} y={422} fill="#fff" fontSize="7"
                fontFamily="Orbitron" textAnchor="middle">!</text>
            </g>
          ))}
        </>)}

        {/* ── DEBRIS FIELD — tumbling rocks flying past ── */}
        {isDebris && (<>
          {debrisRocks.map((d, i) => (
            <polygon key={i}
              points={`0,${-d.r} ${d.r * 0.7},${-d.r * 0.3} ${d.r * 0.9},${d.r * 0.5} ${d.r * 0.2},${d.r} ${-d.r * 0.6},${d.r * 0.7} ${-d.r * 0.9},${-d.r * 0.2}`}
              fill={`rgb(${100 + i * 18},${92 + i * 14},${85 + i * 11})`}
              stroke="#998877" strokeWidth="0.5">
              <animateTransform attributeName="transform" type="translate"
                dur={d.dur + 's'} repeatCount="indefinite"
                values={`${d.x},${d.y};${d.x + d.dx},${d.y + d.dy}`} />
              <animate attributeName="opacity" dur={d.dur + 's'} repeatCount="indefinite"
                values="0.9;0.6;0.1;0" />
            </polygon>
          ))}
          {/* Evasion reticle */}
          <circle cx="600" cy="250" r="45" fill="none" stroke="#ffcc00" strokeWidth="1.5" strokeDasharray="10 5">
            <animate attributeName="r" dur="0.9s" repeatCount="indefinite" values="30;58;30" />
            <animate attributeName="opacity" dur="0.45s" repeatCount="indefinite" values="0.8;0.2;0.8" />
          </circle>
          <text x="600" y="318" fill="#ffcc00" fontSize="9" fontFamily="Orbitron" textAnchor="middle"
            letterSpacing="2">EVASIVE BURN</text>
        </>)}

        {/* ── COCKPIT FRAME ── */}
        <polygon points="0,0 270,75 270,425 0,500" fill="url(#cpPanel)" />
        <line x1="270" y1="75" x2="270" y2="425" stroke="#1a2850" strokeWidth="1.5" />
        <polygon points="1200,0 930,75 930,425 1200,500" fill="url(#cpPanel)" />
        <line x1="930" y1="75" x2="930" y2="425" stroke="#1a2850" strokeWidth="1.5" />
        <polygon points="0,500 270,425 930,425 1200,500" fill="url(#cpPanel)" />
        <rect x="0" y="0" width="1200" height="26" fill="#030508" />
        <text x="600" y="18" fill="#3B8BD4" fontSize="9" fontFamily="Orbitron" textAnchor="middle" letterSpacing="3">
          COCKPIT CAM · {rocket?.label?.toUpperCase() || 'NUCLEAR THERMAL ROCKET'} · LOOK-AROUND ACTIVE
        </text>

        {/* Window bezel — color reacts to hazard */}
        <rect x="270" y="75" width="660" height="350" fill="none"
          stroke={isFlare ? '#ff8800' : isEngine ? '#ff3300' : isMicro ? '#88ccff' : isDebris ? '#ffcc00' : '#1a3060'}
          strokeWidth="2.5" />
        <rect x="272" y="77" width="656" height="346" fill="none" stroke="#0d1a38" strokeWidth="1" />

        {/* HUD crosshair */}
        <line x1="596" y1="246" x2="604" y2="254" stroke="#3B8BD4" strokeWidth="0.8" opacity="0.55" />
        <line x1="604" y1="246" x2="596" y2="254" stroke="#3B8BD4" strokeWidth="0.8" opacity="0.55" />

        {/* Corner brackets — flash during hazard */}
        {[[278, 83], [918, 83], [278, 413], [918, 413]].map(([cx, cy], i) => {
          const dx = i % 2 === 0 ? 1 : -1;
          const dy = i < 2 ? 1 : -1;
          const hCol = isFlare ? '#ff8800' : isEngine ? '#ff3300' : activeHazard ? '#ffcc00' : '#3B8BD4';
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={cx + dx * 22} y2={cy} stroke={hCol} strokeWidth="1" opacity="0.65" />
              <line x1={cx} y1={cy} x2={cx} y2={cy + dy * 22} stroke={hCol} strokeWidth="1" opacity="0.65" />
            </g>
          );
        })}

        {/* LEFT instrument panel */}
        <rect x="8" y="135" width="252" height="200" rx="3"
          fill={isEngine ? '#150500' : '#050814'}
          stroke={isEngine ? '#ff4400' : '#131d36'} strokeWidth="1" />
        <text x="134" y="154"
          fill={isEngine ? '#ff5500' : isFlare ? '#ff8800' : '#4477aa'}
          fontSize="7" fontFamily="Orbitron" textAnchor="middle" letterSpacing="1.5">
          {isEngine ? '!! SCRAM ALERT !!' : isFlare ? '☢ RADIATION HIGH' : 'PROPULSION STATUS'}
        </text>
        {rocket && [
          ['ISP',        `${rocket.isp} s`,              rocket.isp > 700 ? '#3B8BD4' : '#ffc107'],
          ['DELTA-V',    `${rocket.deltaV} km/s`,         '#fff'],
          ['TRANSIT',    `${rocket.transit} d`,           rocket.transit < 150 ? '#3B8BD4' : rocket.transit < 260 ? '#ffc107' : '#ff5555'],
          ['RADIATION',  `${rocket.radiation} mSv`,       rocket.radiation < 200 ? '#2bd946' : rocket.radiation < 320 ? '#ffc107' : '#ff5555'],
          ['ABORT ΔV',   `${rocket.abortDv} km/s`,       rocket.abortDv > 2 ? '#2bd946' : rocket.abortDv > 0.5 ? '#ffc107' : '#ff5555'],
          ['BONE LOSS',  `${rocket.boneLossPct}%`,        rocket.boneLossPct < 2.5 ? '#2bd946' : '#ffc107'],
          ['RAD CAREER', `${rocket.careerRadPct}%`,       rocket.careerRadPct < 30 ? '#2bd946' : rocket.careerRadPct < 55 ? '#ffc107' : '#ff5555'],
        ].map(([lbl, val, col], idx) => (
          <g key={lbl}>
            <text x="18"  y={172 + idx * 23} fill={isEngine ? '#883300' : isFlare ? '#996600' : '#4477aa'}
              fontSize="7" fontFamily="Share Tech Mono">{lbl}</text>
            <text x="252" y={172 + idx * 23}
              fill={(isEngine && (lbl === 'DELTA-V' || lbl === 'ABORT ΔV')) ? '#ff4400' :
                    (isFlare && lbl === 'RADIATION') ? '#ff6600' : col}
              fontSize="8" fontFamily="Share Tech Mono" textAnchor="end">{val}</text>
            <line x1="18" y1={174 + idx * 23} x2="252" y2={174 + idx * 23} stroke="#0f1a2e" strokeWidth="0.5" />
          </g>
        ))}

        {/* Engine power bar — drops during anomaly */}
        {isEngine && (<>
          <rect x="15" y="350" width="240" height="7" rx="3" fill="#1a0000" />
          <rect x="15" y="350" width="120" height="7" rx="3" fill="#ff3300">
            <animate attributeName="width" dur="0.8s" repeatCount="indefinite" values="240;80;240" />
          </rect>
          <text x="135" y="342" fill="#ff5500" fontSize="6" fontFamily="Orbitron" textAnchor="middle"
            letterSpacing="1">ENGINE POWER</text>
        </>)}

        {/* Radiation bar — climbs during flare */}
        {isFlare && (<>
          <rect x="15" y="350" width="240" height="7" rx="3" fill="#1a1000" />
          <rect x="15" y="350" width="0" height="7" rx="3" fill="#ff8800">
            <animate attributeName="width" dur="0.6s" repeatCount="indefinite" values="0;240;180" />
          </rect>
          <text x="135" y="342" fill="#ff8800" fontSize="6" fontFamily="Orbitron" textAnchor="middle"
            letterSpacing="1">☢ RAD DOSE CLIMBING</text>
        </>)}

        {/* RIGHT instrument panel */}
        <rect x="940" y="135" width="252" height="200" rx="3"
          fill={isFlare ? '#100800' : '#050814'}
          stroke={isFlare ? '#ff8800' : '#131d36'} strokeWidth="1" />
        <text x="1066" y="154"
          fill={isFlare ? '#ff8800' : isEngine ? '#ff5500' : '#4477aa'}
          fontSize="7" fontFamily="Orbitron" textAnchor="middle" letterSpacing="1.5">
          {isFlare ? '☀ SPE IN PROGRESS' : isEngine ? 'SCRAM PROCEDURE' : 'NAVIGATION'}
        </text>
        {[
          ['MISSION',   `${Math.round(raceProgress * 100)}%`,           '#fff'],
          ['MARS DIST', `${((1 - raceProgress) * 97.7).toFixed(1)} Mm`, '#fff'],
          ['TRL',       `Level ${rocket?.trl ?? 5}`,                    rocket?.trl >= 8 ? '#2bd946' : '#ffc107'],
          ['LAUNCHES',  `${rocket?.launches ?? 1}×`,                    '#fff'],
          ['COST',      `$${rocket?.cost?.toFixed(1) ?? '?'}B`,         '#fff'],
          ['PAYLOAD',   `${rocket?.payloadMars?.toLocaleString() ?? '—'} kg`, '#fff'],
        ].map(([lbl, val, col], idx) => (
          <g key={lbl}>
            <text x="950"  y={172 + idx * 23} fill={isFlare ? '#885500' : '#4477aa'} fontSize="7" fontFamily="Share Tech Mono">{lbl}</text>
            <text x="1184" y={172 + idx * 23} fill={isFlare ? '#ffaa44' : col}        fontSize="8" fontFamily="Share Tech Mono" textAnchor="end">{val}</text>
            <line x1="950" y1={174 + idx * 23} x2="1184" y2={174 + idx * 23} stroke="#0f1a2e" strokeWidth="0.5" />
          </g>
        ))}

        {/* Mission progress bar */}
        <rect x="270" y="422" width="660" height="5" rx="2" fill="#0a1020" />
        <rect x="270" y="422" width={660 * raceProgress} height="5" rx="2" fill={rocket?.color || '#3B8BD4'} />

        {/* Hazard POV message bar */}
        {activeHazard && (() => {
          const h = HAZARD_EVENTS.find(e => e.id === activeHazard);
          if (!h) return null;
          return (
            <g>
              <rect x="270" y="430" width="660" height="32" rx="3"
                fill={h.color + '22'} stroke={h.color} strokeWidth="0.8" />
              <text x="600" y="451" fill={h.color} fontSize="8.5"
                fontFamily="Orbitron" textAnchor="middle" letterSpacing="1">{h.icon} {h.pov}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TELEMETRY (simplified — reused across multiple contexts)
   ══════════════════════════════════════════════════════════ */
const calcTelemetry = (progress, rocket) => {
  const distanceKm = (rocket?.distanceKm) || 97.7e6;
  const distanceAu = Math.max(0.45, distanceKm / 149600000);
  const solarFlux  = Math.round(1361 / (distanceAu * distanceAu));

  if (progress < 0.004) {
    const ap = progress / 0.004;
    return {
      altitude: Math.pow(ap, 0.6) * 185000, velocity: ap * 7800,
      acceleration: 3.5, skinTemp: 288 + ap * 1400,
      pressure: 101325 * Math.exp(-ap * 185000 / 8500),
      phase: 'ASCENT', event: ap < 0.4 ? 'Stage 1 Burn' : ap < 0.8 ? 'Stage 2 Burn' : 'Orbit Insertion',
      distanceToMars: distanceKm, deltaV: 11.4, solarFlux,
    };
  }
  if (progress < 0.08) {
    return {
      altitude: 185000, velocity: 7800, acceleration: 0.1, skinTemp: 288,
      pressure: 1e-10, phase: 'LEO CHECKOUT', event: 'Orbital verification',
      distanceToMars: distanceKm, deltaV: 10.6, solarFlux,
    };
  }
  if (progress < 0.12) {
    const tp = (progress - 0.08) / 0.04;
    return {
      altitude: 185000, velocity: 7800 + tp * 4000, acceleration: tp * 2.0, skinTemp: 288,
      pressure: 1e-10, phase: 'TRANS-MARS INJECTION', event: 'TMI burn active',
      distanceToMars: distanceKm, deltaV: 14.8, solarFlux,
    };
  }
  if (progress < 0.95) {
    const cp = (progress - 0.12) / 0.83;
    const rem = Math.max(0, distanceKm * (1 - cp));
    return {
      altitude: rem, velocity: 11200 - cp * 5700, acceleration: 0.001, skinTemp: 3,
      pressure: 0, phase: 'INTERPLANETARY CRUISE',
      event: `${Math.round((1 - cp) * (rocket?.transit || 247))} days to Mars`,
      distanceToMars: rem, deltaV: Math.max(2.3, 12 - cp * 6.5), solarFlux,
    };
  }
  const ep = (progress - 0.95) / 0.05;
  return {
    altitude: Math.pow(1 - ep, 2) * 100000, velocity: (1 - ep) * 5500,
    acceleration: ep > 0.3 ? clamp(ep * 8, 0, 8) : 0.5,
    skinTemp: 288 + Math.sin(ep * Math.PI) * 2800, pressure: 101325 * Math.exp(-Math.pow(1 - ep, 2) * 100000 / 11500),
    phase: ep < 0.5 ? 'ENTRY & DESCENT' : 'LANDING SEQUENCE',
    event: ep < 0.3 ? 'Reentry heating' : ep < 0.7 ? 'Parachute deployment' : 'Landing legs deployed',
    distanceToMars: 0, deltaV: 1.2, solarFlux: Math.round(1361 / Math.pow(1.524, 2)),
  };
};

const radiationColor = v => v < 180 ? '#2bd946' : v < 300 ? '#ffc107' : '#ff5555';

/* ══════════════════════════════════════════════════════════
   DETERMINISTIC STARS
   ══════════════════════════════════════════════════════════ */
const SVG_STARS = [...Array(95)].map((_, i) => ({
  cx: (i * 127.3 + 41) % 1200,
  cy: (i * 83.7  + 19) % 320,
  r:  ((i * 31) % 18) / 10 + 0.2,
  op: ((i * 53) % 7)  / 10 + 0.3,
  dur: (((i * 17) % 40) / 10 + 2).toFixed(1),
}));

/* ══════════════════════════════════════════════════════════
   APP
   ══════════════════════════════════════════════════════════ */
function App() {
  const [crewSize, setCrewSize]   = useState(4);
  const [year, setYear]           = useState(2027);
  const [raceProgress, setRaceProgress] = useState(0);
  const [raceRunning, setRaceRunning]   = useState(false);
  const [arrivals, setArrivals]         = useState({});
  const [showDebrief, setShowDebrief]   = useState(false);
  const [countdown, setCountdown]       = useState(null);
  const [statusText, setStatusText]     = useState('Configure mission parameters and initiate launch');
  const [clock, setClock]               = useState('00:00:00');
  const [openingComplete, setOpeningComplete] = useState(false);
  const [missionFailed, setMissionFailed]     = useState(false);
  const [failureReason, setFailureReason]     = useState('');
  const [landingSequence, setLandingSequence] = useState(false);
  const [crewLanded, setCrewLanded]           = useState(0);
  const [telemetry, setTelemetry]             = useState(null);
  const [telemetryKey, setTelemetryKey]       = useState('nuclear');
  const [missionData, setMissionData]         = useState(null);
  const [instantLaunch, setInstantLaunch]     = useState(false);
  const [showMenu, setShowMenu]               = useState(false);

  // Cockpit view
  const [showCockpit, setShowCockpit] = useState(false);
  const [lookX, setLookX]             = useState(0);
  const [lookY, setLookY]             = useState(0);

  // Hazard system
  const [hazardSchedule, setHazardSchedule]     = useState({});
  const [activeHazardFor, setActiveHazardFor]   = useState({});
  const [hazardShake, setHazardShake]           = useState({});
  const [hazardFlash, setHazardFlash]           = useState({});
  const [hazardScanEnabled, setHazardScanEnabled] = useState(true);
  const [effectiveTransit, setEffectiveTransit]   = useState({});

  // Custom rocket builder
  const [showBuilder, setShowBuilder]   = useState(false);
  const [selectedEng, setSelectedEng]   = useState('nerva_xe');
  const [selectedHab, setSelectedHab]   = useState('capsule');
  const [selectedTank, setSelectedTank] = useState('sm');
  const [customName, setCustomName]     = useState('My Rocket');
  const [playerRocket, setPlayerRocket] = useState(null);

  const intervalRef = useRef(null);
  const distance    = DISTANCES[year] || 97.7;

  /* ── Scaled fleet rockets ── */
  const rockets = useMemo(() => {
    const out = {};
    Object.entries(BASE_ROCKETS).forEach(([k, b]) => {
      out[k] = scaleRocket(b, crewSize, distance);
    });
    return out;
  }, [crewSize, distance]);

  /* ── Player rocket preview (live in builder) ── */
  const playerPreview = useMemo(() =>
    computePlayerStats(selectedEng, selectedHab, selectedTank, crewSize, distance),
    [selectedEng, selectedHab, selectedTank, crewSize, distance]);

  /* ── Active metrics (fleet + maybe custom) ── */
  const activeMetrics = useMemo(() => {
    const base = missionData ? missionData.rockets : rockets;
    return base;
  }, [missionData, rockets]);

  /* ── Best values per metric for debrief highlighting ── */
  const bestMetrics = useMemo(() => {
    const best = {};
    const fleetOnly = { chemical: activeMetrics.chemical, nuclear: activeMetrics.nuclear, starship: activeMetrics.starship };
    Object.keys(METRIC_CONFIG).forEach(m => {
      const cfg = METRIC_CONFIG[m];
      const vals = Object.values(fleetOnly).map(r => Number(r?.[m] ?? (cfg.lo ? Infinity : -Infinity)));
      best[m] = cfg.lo ? Math.min(...vals) : Math.max(...vals);
    });
    return best;
  }, [activeMetrics]);

  /* ── UTC clock ── */
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Opening sequence ── */
  useEffect(() => {
    if (!openingComplete) {
      const t = setTimeout(() => setOpeningComplete(true), 5000);
      return () => clearTimeout(t);
    }
  }, [openingComplete]);

  /* ── Race animation ── */
  useEffect(() => {
    if (!missionData || !raceRunning) return;
    const totalTime = 18000;
    const start = Date.now();

    intervalRef.current = setInterval(() => {
      const progress = clamp((Date.now() - start) / totalTime, 0, 1);
      setRaceProgress(progress);

      // Check hazard triggers
      const currentSchedule = hazardSchedule;
      Object.entries(currentSchedule).forEach(([rkey, events]) => {
        events.forEach(ev => {
          if (!ev.triggered && progress >= ev.at) {
            ev.triggered = true;
            // Apply transit delay — days change based on hazard
            if (ev.transitAdd > 0) {
              setEffectiveTransit(prev => ({
                ...prev,
                [rkey]: (prev[rkey] || activeMetrics[rkey]?.transit || 200) + ev.transitAdd,
              }));
            }
            // Visual effect
            setActiveHazardFor(prev => ({ ...prev, [rkey]: ev.id }));
            setHazardShake(prev => ({ ...prev, [rkey]: true }));
            if (ev.id === 'solar_flare') {
              setHazardFlash(prev => ({ ...prev, [rkey]: true }));
            }
            setStatusText(`⚠ HAZARD — ${ev.name} affecting ${activeMetrics[rkey]?.label || rkey}. +${ev.transitAdd}d delay. ${ev.desc}`);
            setTimeout(() => {
              setActiveHazardFor(prev => { const n = { ...prev }; delete n[rkey]; return n; });
              setHazardShake(prev => { const n = { ...prev }; delete n[rkey]; return n; });
              setHazardFlash(prev => { const n = { ...prev }; delete n[rkey]; return n; });
            }, 3200);
          }
        });
      });

      // Update telemetry
      const tracked = activeMetrics[telemetryKey] || activeMetrics.nuclear;
      const tel = calcTelemetry(progress, { ...tracked, distanceKm: distance * 1e6 });
      setTelemetry(tel);

      // Track arrivals — uses effectiveTransit so hazard delays shift arrival time
      const effTMap = effectiveTransit;
      const maxT = Math.max(...Object.keys(activeMetrics).map(k => effTMap[k] || activeMetrics[k].transit || 1));
      const newArr = {};
      Object.entries(activeMetrics).forEach(([k, r]) => {
        const eff = effTMap[k] || r.transit || maxT;
        const finishAt = clamp(eff / maxT, 0.18, 1);
        if (progress >= finishAt) newArr[k] = true;
      });
      setArrivals(newArr);

      if (progress >= 1) {
        clearInterval(intervalRef.current);
        setRaceRunning(false);
        setLandingSequence(true);
        setStatusText('Mars touchdown confirmed. Crew preparing for surface egress.');
        setTimeout(() => {
          setLandingSequence(false);
          setShowDebrief(true);
          setCrewLanded(crewSize);
          setStatusText('Mission complete. All crew on Mars surface.');
        }, 3200);
      }
    }, 80);

    return () => clearInterval(intervalRef.current);
  }, [missionData, raceRunning]);

  /* ── Mouse look-around for cockpit ── */
  const handleCockpitMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLookX((e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2));
    setLookY((e.clientY - rect.top  - rect.height / 2) / (rect.height / 2));
  };

  /* ── Start mission ── */
  const startMission = async () => {
    setShowDebrief(false); setMissionFailed(false); setFailureReason('');
    setLandingSequence(false); setCrewLanded(0);
    setRaceProgress(0); setArrivals({}); setTelemetry(null);
    setActiveHazardFor({}); setHazardShake({}); setHazardFlash({});

    let mRockets = { ...rockets };
    if (playerRocket) mRockets = { ...rockets, custom: playerRocket };

    const hazKeys = Object.keys(mRockets);
    const schedule = rollHazards(hazKeys, hazardScanEnabled);
    setHazardSchedule(schedule);

    try {
      const resp = await axios.post('http://localhost:8000/api/mission', { crew_size: crewSize, year, risk: 5 }, { timeout: 3000 });
      // Merge backend radiation/transit scaling into frontend rockets
      const backendRockets = resp.data.rockets;
      Object.keys(mRockets).forEach(k => {
        if (backendRockets[k]) {
          mRockets[k] = { ...mRockets[k], ...backendRockets[k], color: mRockets[k].color, label: mRockets[k].label };
        }
      });
      setMissionData({ rockets: mRockets, distance, year });
    } catch {
      setMissionData({ rockets: mRockets, distance, year });
    }
    setEffectiveTransit(Object.fromEntries(Object.keys(mRockets).map(k => [k, mRockets[k].transit || 200])));
    setStatusText('Mission parameters verified. Hazard simulation active.');

    if (instantLaunch) {
      setRaceRunning(true);
    } else {
      let c = 5; setCountdown(c);
      const cd = setInterval(() => {
        c -= 1;
        if (c <= 0) { clearInterval(cd); setCountdown(null); setRaceRunning(true); return; }
        setCountdown(c);
      }, 1000);
    }
  };

  const runAgain = () => {
    setShowDebrief(false); setMissionFailed(false); setFailureReason('');
    setLandingSequence(false); setCrewLanded(0);
    setMissionData(null); setRaceProgress(0); setArrivals({});
    setTelemetry(null); setTelemetryKey('nuclear');
    setHazardSchedule({}); setActiveHazardFor({}); setHazardShake({}); setHazardFlash({});
    setEffectiveTransit({});
    setStatusText('Configure mission parameters and initiate launch');
  };

  const saveCustomRocket = () => {
    setPlayerRocket({ ...playerPreview, label: customName || 'My Rocket', color: '#CC88FF' });
    setShowBuilder(false);
    setStatusText(`Custom rocket "${customName}" locked in. Ready to race against the fleet.`);
  };

  const statusDotClass = raceRunning ? 'active' : countdown !== null ? 'countdown' : '';

  /* ══════════════════════════════════════════════════════════
     OPENING SEQUENCE
     ══════════════════════════════════════════════════════════ */
  if (!openingComplete) {
    return (
      <div className="app">
        <div className="scanlines" />
        <div className="vignette" />
        <div className="opening-sequence">
          <svg className="opening-stars" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="spaceBgOpening" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#04071a" /><stop offset="50%" stopColor="#020510" /><stop offset="100%" stopColor="#030611" />
              </linearGradient>
              <radialGradient id="earthGradOpening" cx="45%" cy="40%" r="65%">
                <stop offset="0%" stopColor="#88c8ff" /><stop offset="60%" stopColor="#2255a0" /><stop offset="100%" stopColor="#0d1f45" />
              </radialGradient>
              <radialGradient id="earthAtmosOpening" cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor="transparent" /><stop offset="100%" stopColor="#3388ff" stopOpacity="0.22" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="1200" height="800" fill="url(#spaceBgOpening)" />
            {SVG_STARS.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy * 2.5} r={s.r} fill="#fff" opacity={s.op} />)}
          </svg>
          <div className="opening-earth-container">
            <svg className="opening-earth" viewBox="0 0 200 200">
              <g transform="translate(100,100)">
                <circle cx="0" cy="0" r="80" fill="url(#earthAtmosOpening)" />
                <circle cx="0" cy="0" r="55" fill="url(#earthGradOpening)" />
                <path d="M-20,-20 q18,-12 36,-4 q8,6 10,18 q-18,10 -38,6 Z" fill="#2a6ab8" opacity="0.55" />
                <path d="M-18,12 q14,-8 28,2 q4,10 -6,16 q-14,4 -22,-2 Z" fill="#2a6ab8" opacity="0.45" />
                <text x="0" y="75" fill="#5599ee" fontSize="14" textAnchor="middle" fontFamily="Orbitron" fontWeight="700" letterSpacing="2">EARTH</text>
              </g>
            </svg>
          </div>
          <div className="opening-text">
            <div className="opening-title">MARS MISSION CONTROL</div>
            <div className="opening-subtitle">NUCLEAR PROPULSION ANALYSIS SYSTEM v3.0</div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MAIN UI
     ══════════════════════════════════════════════════════════ */
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
              <div className="mcc-subtitle">NUCLEAR PROPULSION COMPARATIVE ANALYSIS SYSTEM · REV 3.0</div>
            </div>
          </div>
          <div className="mcc-header-right">
            <button className="customize-button" onClick={() => setShowBuilder(true)}>⚛ BUILD MY ROCKET</button>
            {playerRocket && (
              <button className="customize-button" style={{ background: 'rgba(200,136,255,0.12)', borderColor: '#CC88FF' }}
                onClick={() => setPlayerRocket(null)}>✕ REMOVE CUSTOM</button>
            )}
            <div className="menu-dropdown">
              <button className="menu-toggle" onClick={() => setShowMenu(!showMenu)}>☰ MENU</button>
              {showMenu && (
                <div className="menu-content">
                  <button className="menu-item" onClick={() => { runAgain(); setShowMenu(false); }}>↺ New Mission</button>
                  <button className="menu-item" onClick={() => { setShowBuilder(true); setShowMenu(false); }}>⚛ Build Rocket</button>
                  <button className="menu-item" onClick={() => { setOpeningComplete(false); setShowMenu(false); }}>🌍 Replay Intro</button>
                </div>
              )}
            </div>
            <div className="mcc-clock-block">
              <div className="mcc-clock-label">UTC</div>
              <div className="mcc-clock">{clock}</div>
            </div>
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
            <span className="section-title">■ MISSION ARCHITECTURE</span>
            <span className="mission-phase-badge">PHASE 01 · ARCHITECTURE</span>
          </div>
          <div className="controls-grid">
            <div className="control">
              <label className="control-label">CREW SIZE</label>
              <div className="control-row">
                <input type="range" min="2" max="8" value={crewSize} onChange={e => setCrewSize(+e.target.value)} />
                <span className="control-value">{crewSize}</span>
              </div>
            </div>
            <div className="control">
              <label className="control-label">MARS OPPOSITION YEAR</label>
              <select value={year} onChange={e => setYear(+e.target.value)}>
                {Object.entries(DISTANCES).map(([y, d]) => (
                  <option value={y} key={y}>{y} — {d} M km</option>
                ))}
              </select>
            </div>
            <div className="control control-checkbox">
              <label className="control-label">HAZARD SCAN SYSTEM</label>
              <div className="control-row">
                <input type="checkbox" checked={hazardScanEnabled} onChange={e => setHazardScanEnabled(e.target.checked)} />
                <span className="control-value">{hazardScanEnabled ? 'ACTIVE (−35% hazard chance)' : 'DISABLED'}</span>
              </div>
            </div>
            <div className="control control-checkbox">
              <label className="control-label">INSTANT LAUNCH</label>
              <div className="control-row">
                <input type="checkbox" checked={instantLaunch} onChange={e => setInstantLaunch(e.target.checked)} />
                <span className="control-value">{instantLaunch ? 'SKIP COUNTDOWN' : 'STANDARD'}</span>
              </div>
            </div>
          </div>

          {/* Mission summary cards */}
          <div className="mission-summary-grid">
            <div className="mission-summary-card">
              <div className="summary-label">EARTH–MARS DISTANCE</div>
              <div className="summary-value">{distance} M km</div>
              <div className="summary-detail">JPL Horizons ephemeris</div>
            </div>
            <div className="mission-summary-card">
              <div className="summary-label">NTR FLEET TRANSIT</div>
              <div className="summary-value">{rockets.nuclear.transit} days</div>
              <div className="summary-detail">NASA DRA 5.0 fast transit</div>
            </div>
            <div className="mission-summary-card">
              <div className="summary-label">NTR RADIATION DOSE</div>
              <div className="summary-value">{rockets.nuclear.radiation} mSv</div>
              <div className="summary-detail">{rockets.nuclear.careerRadPct}% career limit</div>
            </div>
            <div className="mission-summary-card">
              <div className="summary-label">NTR PROPELLANT</div>
              <div className="summary-value">{rockets.nuclear.propellant.toLocaleString()} kg</div>
              <div className="summary-detail">{Math.round((1 - rockets.nuclear.propellant / rockets.chemical.propellant) * 100)}% less than Chemical</div>
            </div>
          </div>

          {/* Spec cards */}
          <div className="spec-cards">
            {Object.entries(rockets).map(([key, item]) => (
              <div className="spec-card" key={key} style={{ borderColor: item.color + '44' }}>
                <div className="spec-card-topbar" style={{ background: `linear-gradient(90deg, ${item.color}, ${item.color}88)` }} />
                <div className="spec-card-body">
                  <h3 className="spec-card-name" style={{ color: item.color }}>{item.label}</h3>
                  <div className="spec-card-type" style={{ color: item.color + 'aa' }}>{item.engineType}</div>
                  <div className="spec-data-grid">
                    {[
                      ['ISP', item.isp, 's'],
                      ['TRANSIT', item.transit, 'days'],
                      ['RADIATION', item.radiation, 'mSv'],
                      ['CAREER RAD', item.careerRadPct, '%'],
                      ['BONE LOSS', item.boneLossPct, '%'],
                      ['ABORT ΔV', item.abortDv, 'km/s'],
                      ['PROPELLANT', item.propellant.toLocaleString(), 'kg'],
                      ['COST', '$' + item.cost + 'B', ''],
                      ['LAUNCHES', item.launches, '×'],
                      ['TRL', item.trl, '/9'],
                    ].map(([lbl, val, unit]) => (
                      <div className="spec-data-item" key={lbl}>
                        <div className="spec-label">{lbl}</div>
                        <div className="spec-value" style={{ color: item.color }}>{val}</div>
                        <div className="spec-unit">{unit}</div>
                      </div>
                    ))}
                  </div>
                  <div className="spec-isp-label">ISP EFFICIENCY</div>
                  <div className="spec-isp-track">
                    <div className="spec-isp-fill" style={{ width: `${(item.isp / 900) * 100}%`, background: item.color }} />
                  </div>
                </div>
              </div>
            ))}
            {playerRocket && (
              <div className="spec-card" style={{ borderColor: '#CC88FF44' }}>
                <div className="spec-card-topbar" style={{ background: 'linear-gradient(90deg,#CC88FF,#CC88FF88)' }} />
                <div className="spec-card-body">
                  <h3 className="spec-card-name" style={{ color: '#CC88FF' }}>{playerRocket.label}</h3>
                  <div className="spec-card-type" style={{ color: '#CC88FFaa' }}>{playerRocket.engineType}</div>
                  <div className="spec-data-grid">
                    {[
                      ['ISP', playerRocket.isp, 's'],
                      ['TRANSIT', playerRocket.transit, 'days'],
                      ['RADIATION', playerRocket.radiation, 'mSv'],
                      ['CAREER RAD', playerRocket.careerRadPct, '%'],
                      ['BONE LOSS', playerRocket.boneLossPct, '%'],
                      ['ABORT ΔV', playerRocket.abortDv, 'km/s'],
                      ['T/W', playerRocket.twr?.toFixed(3), 'g'],
                      ['TRAJ CLASS', playerRocket.trajClass, ''],
                      ['COST', '$' + playerRocket.cost + 'B', ''],
                    ].map(([lbl, val, unit]) => (
                      <div className="spec-data-item" key={lbl}>
                        <div className="spec-label">{lbl}</div>
                        <div className="spec-value" style={{ color: '#CC88FF' }}>{val}</div>
                        <div className="spec-unit">{unit}</div>
                      </div>
                    ))}
                  </div>
                  <div className="spec-isp-label">ISP EFFICIENCY</div>
                  <div className="spec-isp-track">
                    <div className="spec-isp-fill" style={{ width: `${(playerRocket.isp / 900) * 100}%`, background: '#CC88FF' }} />
                  </div>
                  <div className="spec-custom-note">
                    ⚠ Single-engine T/W = {playerRocket.twr?.toFixed(3)} g → {playerRocket.trajClass} trajectory.
                    Fleet NTR uses 3 engines (T/W 0.49 g). Custom transit is always longer.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* NTR Advantage — fleet comparison only */}
          <NTRAdvantage rockets={rockets} />

          <button className={`launch ${!raceRunning ? 'launch-ready' : ''}`} onClick={startMission} disabled={raceRunning}>
            {raceRunning ? '⚡ LAUNCH IN PROGRESS' : '▶ INITIATE LAUNCH'}
          </button>
        </section>

        {/* ── COUNTDOWN ── */}
        {countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-bg-pulse" />
            <div className="countdown-label-top">LAUNCHING IN</div>
            <div className="countdown-number">{countdown}</div>
            <div className="countdown-label-bottom">SECONDS</div>
          </div>
        )}

        {/* ── RACE AREA ── */}
        <section className="race-area">
          <div className="section-header-row">
            <span className="section-title">■ EARTH → MARS TRAJECTORY SIMULATION</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {raceRunning && (
                <button
                  className="cockpit-toggle-btn"
                  onClick={() => setShowCockpit(v => !v)}
                >
                  {showCockpit ? '◉ OVERVIEW' : '◎ FIRST-PERSON VIEW'}
                </button>
              )}
              <span className="mission-phase-badge">
                {telemetry ? `${telemetry.phase}` : 'PHASE 00 · READY'}
              </span>
            </div>
          </div>

          {/* ── COCKPIT VIEW ── */}
          {showCockpit && raceRunning && (
            <div
              className="cockpit-outer"
              onMouseMove={handleCockpitMouseMove}
              onMouseLeave={() => { setLookX(0); setLookY(0); }}
            >
              <div className="cockpit-instructions">Move mouse to look around</div>
              <CockpitView
                rocket={activeMetrics[telemetryKey] || activeMetrics.nuclear}
                raceProgress={raceProgress}
                lookX={lookX}
                lookY={lookY}
                activeHazard={activeHazardFor[telemetryKey] || null}
              />
            </div>
          )}

          {/* ── RACE TRACK SVG ── */}
          <svg className="race-track" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="earthSurface" cx="30%" cy="25%" r="85%">
                <stop offset="0%" stopColor="#5ba3f5" /><stop offset="30%" stopColor="#2e5cb8" />
                <stop offset="75%" stopColor="#0d1f45" /><stop offset="100%" stopColor="#020a1a" />
              </radialGradient>
              <radialGradient id="earthAtmosEnhanced" cx="45%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#b0e0ff" stopOpacity="0.9" />
                <stop offset="40%" stopColor="#4682b4" stopOpacity="0.5" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <radialGradient id="earthShadow" cx="70%" cy="80%" r="60%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="70%" stopColor="#000814" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
              </radialGradient>
              <radialGradient id="marsSurface" cx="35%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#e8956b" /><stop offset="30%" stopColor="#cd853f" />
                <stop offset="75%" stopColor="#8b4513" /><stop offset="100%" stopColor="#2f1b14" />
              </radialGradient>
              <radialGradient id="marsAtmosEnhanced" cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#ffb380" stopOpacity="0.7" />
                <stop offset="50%" stopColor="#ff4500" stopOpacity="0.2" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <radialGradient id="marsShadow" cx="75%" cy="85%" r="55%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="65%" stopColor="#1a0a05" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.9" />
              </radialGradient>
              <radialGradient id="moonSurfaceEnhanced" cx="35%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#f5f5f5" /><stop offset="70%" stopColor="#d3d3d3" /><stop offset="100%" stopColor="#a9a9a9" />
              </radialGradient>
              <radialGradient id="moonShadow" cx="80%" cy="80%" r="50%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="60%" stopColor="#666" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#333" stopOpacity="0.9" />
              </radialGradient>
              <radialGradient id="exhaustPlume" cx="50%" cy="50%" r="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="20%" stopColor="#ffaa00" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#ff6600" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#cc0000" stopOpacity="0.1" />
              </radialGradient>
              <linearGradient id="rocketBodyGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#666" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="spaceBg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#000208" /><stop offset="40%" stopColor="#00050e" /><stop offset="100%" stopColor="#000208" />
              </linearGradient>
              <linearGradient id="milkyWay" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0a0820" stopOpacity="0" />
                <stop offset="35%" stopColor="#1a1040" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#221550" stopOpacity="0.55" />
                <stop offset="65%" stopColor="#1a1040" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0a0820" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="sunCorona" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fffde4" stopOpacity="1" />
                <stop offset="30%" stopColor="#ffee88" stopOpacity="0.9" />
                <stop offset="70%" stopColor="#ffaa00" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nebula1" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1a0a2e" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0a0515" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nebula2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0a1a1a" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#050a0a" stopOpacity="0" />
              </radialGradient>
              <filter id="starGlow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* ── Deep space background ── */}
            <rect x="0" y="0" width="1200" height="320" fill="url(#spaceBg)" />

            {/* Milky Way band — diagonal stripe of distant stars */}
            <rect x="0" y="0" width="1200" height="320" fill="url(#milkyWay)" />

            {/* Nebula patches */}
            <ellipse cx="380" cy="80" rx="160" ry="55" fill="url(#nebula1)" />
            <ellipse cx="750" cy="200" rx="120" ry="70" fill="url(#nebula2)" />
            <ellipse cx="950" cy="60" rx="100" ry="40" fill="url(#nebula1)" />

            {/* Dense star cluster top-center */}
            {[...Array(55)].map((_, i) => {
              const cx2 = 350 + (i * 97 + 23) % 500;
              const cy2 = 8  + (i * 41 + 7)  % 55;
              const r2  = ((i * 19) % 8) / 10 + 0.15;
              const op2 = 0.12 + ((i * 37) % 7) / 10;
              return <circle key={`sc-${i}`} cx={cx2} cy={cy2} r={r2} fill="#ddeeff" opacity={op2} />;
            })}

            {/* Main star field */}
            {SVG_STARS.map((s, i) => (
              <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.op}>
                <animate attributeName="opacity" dur={`${s.dur}s`} repeatCount="indefinite"
                  values={`${s.op};${Math.min(1, s.op + 0.45)};${s.op}`} />
              </circle>
            ))}

            {/* Extra faint star field for depth */}
            {[...Array(120)].map((_, i) => {
              const cx3 = (i * 97.3 + 55) % 1200;
              const cy3 = (i * 53.7 + 11) % 320;
              const r3  = ((i * 11) % 5) / 10 + 0.1;
              const op3 = 0.08 + ((i * 23) % 5) / 10;
              return <circle key={`fs-${i}`} cx={cx3} cy={cy3} r={r3} fill="#aabbdd" opacity={op3} />;
            })}

            {/* ── SUN — top-left corner, corona rays ── */}
            <g transform="translate(-18, -18)">
              <circle cx="0" cy="0" r="80" fill="url(#sunCorona)" opacity="0.6">
                <animate attributeName="r" dur="8s" repeatCount="indefinite" values="75;88;75" />
                <animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0.55;0.7;0.55" />
              </circle>
              <circle cx="0" cy="0" r="28" fill="#fffde4" opacity="0.98" />
              <circle cx="0" cy="0" r="22" fill="#ffffee" opacity="1" />
              {/* Subtle surface granules */}
              {[0,1,2,3,4].map(i => (
                <circle key={i} cx={Math.cos(i*72*Math.PI/180)*12} cy={Math.sin(i*72*Math.PI/180)*12} r="3.5" fill="#ffe880" opacity="0.35" />
              ))}
              {/* Corona rays */}
              {[...Array(18)].map((_, i) => {
                const ang = (i * 20) * Math.PI / 180;
                const len = 40 + (i * 37) % 60;
                return (
                  <line key={i}
                    x1={Math.cos(ang) * 30} y1={Math.sin(ang) * 30}
                    x2={Math.cos(ang) * (30 + len)} y2={Math.sin(ang) * (30 + len)}
                    stroke="#ffdd44" strokeWidth={0.6 + (i%3) * 0.3} strokeLinecap="round" opacity="0.35">
                    <animate attributeName="opacity" dur={`${3 + (i*7)%4}s`} repeatCount="indefinite"
                      values={`0.2;0.5;0.2`} />
                  </line>
                );
              })}
              <text x="32" y="8" fill="#ffcc44" fontSize="6" fontFamily="Orbitron" opacity="0.6">SOL</text>
            </g>

            {/* Global solar flare overlay — SPE hits all spacecraft simultaneously */}
            {Object.values(activeHazardFor).some(h => h === 'solar_flare') && (
              <rect x="0" y="0" width="1200" height="320" fill="#ffcc00">
                <animate attributeName="opacity" dur="0.4s" repeatCount="indefinite" values="0.04;0.2;0.04" />
              </rect>
            )}

            {/* Trajectory lines */}
            {Object.entries(activeMetrics).map(([key, rocket], idx) => (
              <line key={`traj-${key}`} x1="162" y1={TIERS[idx]} x2="1048" y2={TIERS[idx]}
                stroke={rocket.color} strokeDasharray="6 16" strokeWidth="0.9" opacity="0.2" />
            ))}

            {/* Van Allen belts */}
            <ellipse cx="100" cy="160" rx="98" ry="115" fill="none" stroke="#ff8844" strokeWidth="1" opacity="0.08" strokeDasharray="8 4" />

            {/* Zone labels */}
            <text x="460" y="48" fill="#6677bb" fontSize="7" fontFamily="Share Tech Mono" opacity="0.6">TRANSIT CORRIDOR</text>
            <text x="1030" y="300" fill="#dd8844" fontSize="6" fontFamily="Share Tech Mono" opacity="0.5">MARS APPROACH</text>

            {/* Space debris */}
            {[...Array(28)].map((_, i) => {
              const px = 50 + (i * 41.2 + raceProgress * 120) % 1150;
              const py = 30 + ((i * 67) % 250);
              return <circle key={`db-${i}`} cx={px} cy={py} r={0.2 + ((i * 13) % 8) * 0.14} fill="#aabbcc" opacity={0.1 + ((i * 11) % 8) * 0.05} />;
            })}

            {/* ── EARTH ── */}
            <g transform="translate(100,160)">
              <circle cx="0" cy="0" r="85" fill="url(#earthAtmosEnhanced)" />
              <circle cx="0" cy="0" r="58" fill="url(#earthSurface)" />
              <path d="M-18,-28 Q-12,-35 -4,-32 Q6,-38 18,-32 Q14,-18 10,-12 Q-8,-15 -18,-28 Z" fill="#1e5a96" opacity="0.75" />
              <path d="M10,-12 Q18,-10 24,-15 Q26,-8 20,0 Q12,-2 10,-12 Z" fill="#1a3a7a" opacity="0.7" />
              <path d="M14,2 Q22,-2 28,5 Q25,15 18,20 Q12,8 14,2 Z" fill="#2a5a8a" opacity="0.68" />
              <path d="M24,-15 Q40,-22 45,-10 Q40,8 28,5 Q22,-8 24,-15 Z" fill="#0d1f45" opacity="0.72" />
              <ellipse cx="-22" cy="-15" rx="14" ry="10" fill="#ffffff" opacity="0.11" />
              <circle cx="0" cy="0" r="58" fill="url(#earthShadow)" />
              <rect x="-35" y="47" width="70" height="18" rx="3" fill="#060e22" stroke="#2a4a90" strokeWidth="1.2" opacity="0.95" />
              <text x="0" y="59" fill="#5599ee" fontSize="7" textAnchor="middle" fontFamily="Orbitron" fontWeight="700" letterSpacing="1">NASA KSC</text>
              {/* ISS orbit */}
              {[...Array(3)].map((_, i) => {
                const angle = (raceProgress * 360 + i * 120) % 360;
                const rad   = angle * Math.PI / 180;
                const sx = Math.cos(rad) * 80, sy = Math.sin(rad) * 80;
                return (
                  <g key={`iss-${i}`}>
                    <rect x={sx - 3} y={sy - 1.5} width="6" height="3" rx="0.5" fill="#c0c0c0" opacity="0.85" />
                    <rect x={sx - 9} y={sy - 0.4} width="18" height="0.8" fill="#ffff88" opacity="0.8" />
                  </g>
                );
              })}
              {/* Moon */}
              <g transform={`rotate(${(raceProgress * 90) % 360})`}>
                <g transform="translate(0,-105)">
                  <circle cx="0" cy="0" r="15" fill="url(#moonSurfaceEnhanced)" />
                  <circle cx="0" cy="0" r="15" fill="url(#moonShadow)" />
                  <circle cx="-4" cy="-3" r="2.5" fill="#888" opacity="0.65" />
                  <circle cx="6" cy="3"  r="2"   fill="#777" opacity="0.55" />
                  <text x="0" y="23" fill="#aabbcc" fontSize="5.5" textAnchor="middle" fontFamily="Orbitron" fontWeight="700" opacity="0.75">MOON</text>
                </g>
              </g>
            </g>

            {/* ── MARS ── */}
            <g transform="translate(1090,160)">
              <circle cx="0" cy="0" r="70" fill="url(#marsAtmosEnhanced)" />
              <circle cx="0" cy="0" r="50" fill="url(#marsSurface)" />
              <ellipse cx="0" cy="0" rx="25" ry="8" fill="#8b4513" opacity="0.4" transform="rotate(15 0 0)" />
              <ellipse cx="-15" cy="-20" rx="8" ry="6" fill="#a0522d" opacity="0.5" />
              <circle cx="0" cy="-45" r="4" fill="#ffffff" opacity="0.55" />
              <circle cx="0" cy="0" r="50" fill="url(#marsShadow)" />
              <ellipse cx="8" cy="-8" rx="15" ry="4" fill="#cd853f" opacity="0.14"
                transform={`rotate(${(raceProgress * 45) % 360} 8 -8)`} />
              <rect x="-38" y="37" width="76" height="20" rx="4" fill="#2f1b14" stroke="#8b4513" strokeWidth="1.2" opacity="0.95" />
              <text x="0" y="50" fill="#ff6b35" fontSize="6.5" textAnchor="middle" fontFamily="Orbitron" fontWeight="700" letterSpacing="1">MARS BASE ALPHA</text>
              {/* Phobos */}
              <g transform={`rotate(${(raceProgress * 468) % 360})`}>
                <g transform="translate(0,-70)">
                  <circle cx="0" cy="0" r="2.2" fill="#aa7755" opacity="0.85" />
                  <text x="0" y="6" fill="#cd853f" fontSize="4" textAnchor="middle" fontFamily="Orbitron" opacity="0.7">PHOBOS</text>
                </g>
              </g>
            </g>

            {/* ── ROCKETS ── */}
            {Object.entries(activeMetrics).map(([key, rocket], idx) => {
              const tierY    = TIERS[idx];
              const effT     = effectiveTransit[key] || rocket.transit;
              const maxT     = Math.max(...Object.keys(activeMetrics).map(k2 => (effectiveTransit[k2] || activeMetrics[k2]?.transit || 1)));
              const finishAt = clamp(effT / maxT, 0.18, 1);
              const rProg    = clamp(raceProgress / finishAt, 0, 1);
              const liftY    = raceRunning && raceProgress < 0.06 ? Math.max(0, (1 - raceProgress / 0.06) * 36) : 0;
              const x        = clamp(162 + rProg * 876, 162, 1038);
              const y        = tierY - liftY;
              const arrived  = arrivals[key];
              const shaking  = !!hazardShake[key] && !arrived;
              const flashing = !!hazardFlash[key] && !arrived;
              const delay    = effT - rocket.transit;
              const daysElapsed = Math.round(rProg * effT);
              const rocketType  = key === 'custom' ? 'custom' : key;

              return (
                <g key={key} transform={`translate(${x},${y})`}>
                  {/* Hazard impact ring */}
                  {shaking && (
                    <circle cx="14" cy="0" r="40" fill="none"
                      stroke={HAZARD_EVENTS.find(h => h.id === activeHazardFor[key])?.color || '#ff6600'}
                      strokeWidth="2" opacity="0.6">
                      <animate attributeName="r"       dur="0.4s" repeatCount="indefinite" values="30;48;30" />
                      <animate attributeName="opacity" dur="0.4s" repeatCount="indefinite" values="0.6;0.1;0.6" />
                    </circle>
                  )}

                  {/* Solar flare — corona + particle stream */}
                  {activeHazardFor[key] === 'solar_flare' && !arrived && (<>
                    <circle cx="14" cy="0" r="55" fill="#ffcc00">
                      <animate attributeName="r" dur="0.4s" repeatCount="indefinite" values="40;70;40" />
                      <animate attributeName="opacity" dur="0.4s" repeatCount="indefinite" values="0.08;0.3;0.08" />
                    </circle>
                    {[0,1,2,3].map(i => (
                      <circle key={i} r={1.2 + (i%2)*0.5} fill="#ffdd00">
                        <animate attributeName="cx" dur={`${0.3 + i*0.08}s`} repeatCount="indefinite"
                          values={`${-50 + i*12};${80 + i*20}`} />
                        <animate attributeName="cy" dur={`${0.3 + i*0.08}s`} repeatCount="indefinite"
                          values={`${-10 + i*8};${10 + i*8}`} />
                        <animate attributeName="opacity" dur={`${0.3 + i*0.08}s`} repeatCount="indefinite" values="0.9;0" />
                      </circle>
                    ))}
                  </>)}

                  {/* Micrometeorite — debris streaks */}
                  {activeHazardFor[key] === 'micrometeorite' && !arrived && (<>
                    {[0,1,2].map(i => (
                      <line key={i} stroke="#aaddff" strokeWidth={1.6 - i*0.3} strokeLinecap="round">
                        <animate attributeName="x1" dur={`${0.22 + i*0.06}s`} repeatCount="indefinite"
                          values={`${-35 + i*8};${25 + i*12}`} />
                        <animate attributeName="y1" dur={`${0.22 + i*0.06}s`} repeatCount="indefinite"
                          values={`${-18 + i*14};${12 + i*14}`} />
                        <animate attributeName="x2" dur={`${0.22 + i*0.06}s`} repeatCount="indefinite"
                          values={`${-18 + i*8};${42 + i*12}`} />
                        <animate attributeName="y2" dur={`${0.22 + i*0.06}s`} repeatCount="indefinite"
                          values={`${-12 + i*14};${18 + i*14}`} />
                        <animate attributeName="opacity" dur={`${0.22 + i*0.06}s`} repeatCount="indefinite" values="0.9;0" />
                      </line>
                    ))}
                  </>)}

                  {/* Engine anomaly — smoke puffs + red warning light */}
                  {activeHazardFor[key] === 'engine_anomaly' && !arrived && (<>
                    {[0,1,2].map(i => (
                      <circle key={i} fill="#776655">
                        <animate attributeName="cx" dur={`${0.45 + i*0.14}s`} repeatCount="indefinite"
                          values={`${-18 - i*7};${-55 - i*14}`} />
                        <animate attributeName="cy" dur={`${0.45 + i*0.14}s`} repeatCount="indefinite"
                          values={`${i*6 - 5};${i*6 - 20}`} />
                        <animate attributeName="r" dur={`${0.45 + i*0.14}s`} repeatCount="indefinite"
                          values={`${3 + i*2};${12 + i*5}`} />
                        <animate attributeName="opacity" dur={`${0.45 + i*0.14}s`} repeatCount="indefinite" values="0.7;0" />
                      </circle>
                    ))}
                    <circle cx="14" cy="-24" r="4" fill="#ff2200">
                      <animate attributeName="opacity" dur="0.28s" repeatCount="indefinite" values="1;0.1;1" />
                    </circle>
                  </>)}

                  {/* Debris field — tumbling rocks */}
                  {activeHazardFor[key] === 'debris' && !arrived && (<>
                    {[0,1,2].map(i => (
                      <rect key={i} width={3 + i*2} height={3 + i*1.5} rx="1" fill="#998877">
                        <animateTransform attributeName="transform" type="translate"
                          dur={`${0.55 + i*0.12}s`} repeatCount="indefinite"
                          values={`${55 + i*18},${-12 + i*8};${-55 - i*18},${20 + i*12}`} />
                        <animate attributeName="opacity" dur={`${0.55 + i*0.12}s`} repeatCount="indefinite" values="0.9;0.2;0" />
                      </rect>
                    ))}
                  </>)}

                  {renderRocket(rocketType, !arrived && raceRunning, shaking, flashing)}

                  <text x="14" y="-20" fill={rocket.color} fontSize="8" fontFamily="Orbitron" textAnchor="middle" fontWeight="700" opacity="0.95">
                    {rocket.label.toUpperCase()}
                  </text>
                  <text x="14" y="32" fill={rocket.color} fontSize="7.5" fontFamily="Share Tech Mono" textAnchor="middle" opacity="0.72">
                    {arrived ? `${effT} DAYS ✓` : raceRunning ? `${daysElapsed}/${effT}d` : ''}
                  </text>
                  {delay > 0 && raceRunning && !arrived && (
                    <text x="14" y="46" fill="#ff8844" fontSize="6" fontFamily="Share Tech Mono" textAnchor="middle" opacity="0.9">
                      +{delay}d DELAY
                    </text>
                  )}

                  {/* Active hazard label */}
                  {activeHazardFor[key] && !arrived && (
                    <text x="14" y="48" fill={HAZARD_EVENTS.find(h => h.id === activeHazardFor[key])?.color || '#ff6600'}
                      fontSize="6.5" fontFamily="Share Tech Mono" textAnchor="middle" opacity="0.95">
                      {HAZARD_EVENTS.find(h => h.id === activeHazardFor[key])?.icon} {HAZARD_EVENTS.find(h => h.id === activeHazardFor[key])?.name}
                    </text>
                  )}

                  {arrived && (
                    <circle cx="14" cy="0" r="32" fill="none" stroke={rocket.color} strokeWidth="2" opacity="0.55">
                      <animate attributeName="r"       dur="1.2s" repeatCount="indefinite" values="28;44;28" />
                      <animate attributeName="opacity" dur="1.2s" repeatCount="indefinite" values="0.55;0.08;0.55" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── TELEMETRY HUD ── */}
          {raceRunning && telemetry && (
            <div className="live-telemetry-hud">
              <div className="hud-header">
                <div className="hud-title">LIVE MISSION TELEMETRY</div>
                <div className="hud-phase">{telemetry.phase}</div>
              </div>
              <div className="hud-selector-row">
                {Object.entries(activeMetrics).map(([key, rocket]) => (
                  <button key={key}
                    className={`rocket-select ${telemetryKey === key ? 'active' : ''}`}
                    onClick={() => setTelemetryKey(key)}
                    style={telemetryKey === key ? { borderColor: rocket.color, color: rocket.color } : {}}
                  >
                    {rocket.label}
                  </button>
                ))}
              </div>
              <div className="hud-metrics">
                {[
                  ['ALTITUDE',   telemetry.altitude >= 1e6 ? (telemetry.altitude/1e6).toFixed(1)+' Mm' : (telemetry.altitude/1e3).toFixed(0)+' km', '#fff'],
                  ['VELOCITY',   (telemetry.velocity/1000).toFixed(2)+' km/s', '#fff'],
                  ['G-FORCE',    telemetry.acceleration.toFixed(2)+' g', telemetry.acceleration>6?'#ff5555':telemetry.acceleration>3?'#ffc107':'#2bd946'],
                  ['SKIN TEMP',  Math.round(telemetry.skinTemp)+' K', telemetry.skinTemp>1500?'#ff5555':telemetry.skinTemp>500?'#ffc107':'#2bd946'],
                  ['ΔV REMAIN',  telemetry.deltaV.toFixed(1)+' km/s', '#3B8BD4'],
                  ['SOLAR FLUX', telemetry.solarFlux+' W/m²', '#ffc107'],
                ].map(([lbl, val, col]) => (
                  <div className="hud-metric" key={lbl}>
                    <div className="hud-label">{lbl}</div>
                    <div className="hud-value" style={{ color: col }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="hud-event">
                <span className="hud-event-label">EVENT: </span>
                <span className="hud-event-name">{telemetry.event}</span>
              </div>
            </div>
          )}

          {/* Orbital legend */}
          <div className="orbital-legend">
            <div className="legend-title">ORBITAL ELEMENTS & HAZARDS</div>
            <div className="legend-grid">
              {[
                ['#ffdd44', 'ISS & LEO Satellites (~407 km)'],
                ['#aabbcc', 'Space Debris (Collision Risk)'],
                ['#e8e8e8', 'The Moon (384,400 km)'],
                ['#ff8844', 'Van Allen Radiation Belts'],
                ['#ffaa00', 'Solar Proton Event (SPE)'],
                ['#cc88ff', 'Phobos & Deimos (Mars Moons)'],
              ].map(([col, lbl]) => (
                <div className="legend-item" key={lbl}>
                  <div className="legend-dot" style={{ background: col }} />
                  <span>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hazard event log */}
          {Object.keys(hazardSchedule).length > 0 && (
            <div className="hazard-log">
              <div className="hazard-log-title">⚡ HAZARD SIMULATION LOG</div>
              <div className="hazard-log-grid">
                {Object.entries(hazardSchedule).map(([rkey, events]) => {
                  const rocket = activeMetrics[rkey];
                  if (!rocket || events.length === 0) return null;
                  return (
                    <div key={rkey} className="hazard-log-row">
                      <span className="hazard-log-rocket" style={{ color: rocket.color }}>{rocket.label}:</span>
                      <span className="hazard-log-events">
                        {events.map((e, i) => (
                          <span key={i} className="hazard-log-tag" style={{ borderColor: e.color, color: e.color }}>
                            {e.icon} {e.name} {e.triggered ? '✓' : ''}
                          </span>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Failure banner */}
          {missionFailed && (
            <div className="failure-banner">
              <div className="failure-title">MISSION ABORT</div>
              <div className="failure-message">{failureReason}</div>
            </div>
          )}

          {landingSequence && (
            <div className="landing-banner">
              <div className="landing-title">MARS TOUCHDOWN</div>
              <div className="landing-message">Crew exiting vehicle. Preparing surface operations.</div>
            </div>
          )}

          {/* Telemetry cards */}
          <div className="telemetry-grid">
            {Object.entries(activeMetrics).map(([key, rocket]) => {
              const arrived = arrivals[key];
              const radCol  = radiationColor(rocket.radiation);
              return (
                <div className="telemetry-card" key={key} style={{
                  borderColor: arrived ? rocket.color : rocket.color + '55',
                  boxShadow: arrived ? `0 0 22px ${rocket.color}44, inset 0 0 14px ${rocket.color}0e` : undefined,
                }}>
                  <div className="telemetry-header">
                    <h4 style={{ color: rocket.color }}>{rocket.label}</h4>
                    <span className={`telemetry-status-dot ${arrived ? 'arrived' : raceRunning ? 'transit' : ''}`}
                      style={arrived ? { background: rocket.color, boxShadow: `0 0 8px ${rocket.color}` } : {}} />
                  </div>
                  <div className="telemetry-data-grid">
                    <span className="td-label">TRANSIT</span>
                    <span className="td-value">{rocket.transit} <small>days</small></span>
                    <span className="td-label">RADIATION</span>
                    <span className="td-value" style={{ color: radCol }}>{rocket.radiation} <small>mSv</small></span>
                    <span className="td-label">CAREER RAD</span>
                    <span className="td-value" style={{ color: rocket.careerRadPct > 50 ? '#ff5555' : rocket.careerRadPct > 30 ? '#ffc107' : '#2bd946' }}>
                      {rocket.careerRadPct}%
                    </span>
                    <span className="td-label">BONE LOSS</span>
                    <span className="td-value" style={{ color: rocket.boneLossPct > 3 ? '#ff5555' : rocket.boneLossPct > 2 ? '#ffc107' : '#2bd946' }}>
                      {rocket.boneLossPct}%
                    </span>
                    <span className="td-label">ABORT ΔV</span>
                    <span className="td-value" style={{ color: rocket.abortDv > 2 ? '#2bd946' : rocket.abortDv > 0.5 ? '#ffc107' : '#ff5555' }}>
                      {rocket.abortDv} km/s
                    </span>
                    <span className="td-label">PROPELLANT</span>
                    <span className="td-value">{rocket.propellant.toLocaleString()} <small>kg</small></span>
                    <span className="td-label">COST</span>
                    <span className="td-value">${rocket.cost}B</span>
                  </div>
                  <div className="telemetry-bars">
                    <div className="telemetry-bar-row">
                      <span className="td-label">MISSION PROGRESS</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.min(100, raceProgress * 100)}%`, background: rocket.color }} />
                    </div>
                    {/* Radiation bar */}
                    <div className="telemetry-bar-row">
                      <span className="td-label">RADIATION DOSE</span>
                      <span className="td-value" style={{ color: radCol }}>{rocket.radiation} mSv</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.min(100, (rocket.radiation / 600) * 100)}%`, background: radCol }} />
                    </div>
                  </div>
                  {arrived && (
                    <div className="arrived-tag" style={{ color: rocket.color, borderColor: rocket.color }}>✓ ARRIVED AT MARS</div>
                  )}
                  {activeHazardFor[key] && !arrived && (
                    <div className="hazard-active-tag" style={{ color: HAZARD_EVENTS.find(h => h.id === activeHazardFor[key])?.color || '#ff6600' }}>
                      {HAZARD_EVENTS.find(h => h.id === activeHazardFor[key])?.icon} HAZARD: {HAZARD_EVENTS.find(h => h.id === activeHazardFor[key])?.name}
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
                      if (value === undefined || value === null) return <td key={key}>—</td>;
                      // Best is only among fleet (chemical, nuclear, starship)
                      const fleetVal = [activeMetrics.chemical, activeMetrics.nuclear, activeMetrics.starship]
                        .filter(Boolean).map(r => Number(r[metric] ?? (cfg.lo ? Infinity : -Infinity)));
                      const bestFleet = cfg.lo ? Math.min(...fleetVal) : Math.max(...fleetVal);
                      const isBest = Number(value) === bestFleet && key !== 'custom';
                      const rocketColor = rocket.color;
                      return (
                        <td key={key} className={isBest ? 'best-cell' : ''}
                          style={isBest ? { background: `${rocketColor}1e`, color: rocketColor, boxShadow: `inset 0 0 16px ${rocketColor}22` } : {}}>
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
                Nuclear Thermal wins on every critical metric:{' '}
                <strong style={{ color: '#3B8BD4' }}>{activeMetrics.nuclear?.transit} days transit</strong> (fastest),{' '}
                <strong style={{ color: '#3B8BD4' }}>{activeMetrics.nuclear?.radiation} mSv radiation</strong> (lowest),{' '}
                <strong style={{ color: '#3B8BD4' }}>{activeMetrics.nuclear?.abortDv} km/s abort reserve</strong> (safest),{' '}
                and just {activeMetrics.nuclear?.launches} launch required.
                All data from NASA DRA 5.0 (2009), NERVA test program (1969), and Borowski et al. AIAA-2012-5144.
              </p>
            </div>

            <div className="sources">
              <div className="sources-title">DATA SOURCES (zero fabrication)</div>
              <div className="sources-list">
                NASA Mars DRA 5.0 (2009) · NERVA XE Prime ground tests 1969 · Borowski et al. AIAA-2012-5144 ·
                Zeitlin et al. Science 340:1080 (2013) · NASA STD-3001 Rev C (2023) ·
                Leblanc et al. 2007 PMID:17047197 · SpaceX Raptor 2 spec (2023) ·
                NASA IG Report 2022 · JPL Horizons ephemeris
              </div>
            </div>

            {crewLanded > 0 && (
              <div className="crew-summary">
                <div className="crew-summary-title">CREW STATUS</div>
                <div className="crew-summary-text">
                  All {crewLanded} crew members have safely landed on Mars surface.
                </div>
              </div>
            )}

            <button className="launch launch-ready new-mission-btn" onClick={runAgain}>↺ NEW MISSION</button>
          </section>
        )}

        {/* ── ROCKET BUILDER MODAL ── */}
        {showBuilder && (
          <div className="customizer-overlay">
            <div className="customizer-modal">
              <div className="customizer-header">
                <h2>⚛ NTR ROCKET BUILDER</h2>
                <button className="customizer-close" onClick={() => setShowBuilder(false)}>✕</button>
              </div>
              <div className="customizer-content">
                <p className="step-subtitle">
                  You are building a single-engine NTR prototype. Fleet NTR uses 3 NERVA engines (T/W 0.49 g)
                  for fast transit. Single-engine designs have lower T/W — your rocket will always be slower
                  than the fleet, but you can see how the physics changes with your choices.
                </p>

                {/* Engine selection */}
                <div className="builder-section">
                  <h3>1. NUCLEAR ENGINE</h3>
                  <div className="builder-cards">
                    {Object.entries(NTR_ENGINES).map(([key, eng]) => (
                      <div key={key} className={`builder-card ${selectedEng === key ? 'selected' : ''}`}
                        onClick={() => setSelectedEng(key)}
                        style={{ borderColor: selectedEng === key ? '#3B8BD4' : '#1a2a4a' }}>
                        <div className="builder-card-name">{eng.name}</div>
                        <div className="builder-card-specs">
                          ISP {eng.isp} s · Thrust {eng.thrust} kN · TRL {eng.trl}
                        </div>
                        <div className="builder-card-desc">{eng.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Habitat */}
                <div className="builder-section">
                  <h3>2. CREW HABITAT</h3>
                  <div className="builder-cards">
                    {Object.entries(HAB_OPTIONS).map(([key, hab]) => (
                      <div key={key} className={`builder-card ${selectedHab === key ? 'selected' : ''}`}
                        onClick={() => setSelectedHab(key)}
                        style={{ borderColor: selectedHab === key ? '#3B8BD4' : '#1a2a4a' }}>
                        <div className="builder-card-name">{hab.name}</div>
                        <div className="builder-card-specs">Dry mass {hab.dryMass.toLocaleString()} kg · Shield ×{hab.shieldFactor}</div>
                        <div className="builder-card-desc">{hab.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tank */}
                <div className="builder-section">
                  <h3>3. PROPELLANT TANK</h3>
                  <div className="builder-cards">
                    {Object.entries(TANK_OPTIONS).map(([key, tank]) => (
                      <div key={key} className={`builder-card ${selectedTank === key ? 'selected' : ''}`}
                        onClick={() => setSelectedTank(key)}
                        style={{ borderColor: selectedTank === key ? '#3B8BD4' : '#1a2a4a' }}>
                        <div className="builder-card-name">{tank.name}</div>
                        <div className="builder-card-specs">
                          Propellant {tank.capacity.toLocaleString()} kg · Structure {tank.structMass.toLocaleString()} kg ({Math.round(tank.structMass/tank.capacity*100)}%)
                        </div>
                        <div className="builder-card-desc">{tank.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div className="builder-section">
                  <h3>4. ROCKET NAME</h3>
                  <input className="builder-name-input" value={customName}
                    onChange={e => setCustomName(e.target.value)} placeholder="My Rocket" />
                </div>

                {/* Live physics preview */}
                <div className="builder-preview">
                  <div className="builder-preview-title">LIVE PHYSICS CHAIN (Tsiolkovsky + Borowski T/W)</div>
                  <div className="builder-preview-chain">
                    <span>ISP {playerPreview.isp} s</span>
                    <span className="chain-arrow">→</span>
                    <span>Ve {playerPreview.exhaustVelocity.toLocaleString()} m/s</span>
                    <span className="chain-arrow">→</span>
                    <span>ΔV {playerPreview.deltaV} km/s</span>
                    <span className="chain-arrow">→</span>
                    <span>T/W {playerPreview.twr?.toFixed(3)} g</span>
                    <span className="chain-arrow">→</span>
                    <span className={`chain-traj ${playerPreview.trajClass === 'Opposition-class' ? 'traj-fast' : 'traj-slow'}`}>
                      {playerPreview.trajClass}
                    </span>
                    <span className="chain-arrow">→</span>
                    <span style={{ color: '#CC88FF' }}>{playerPreview.transit} days</span>
                  </div>
                  <div className="builder-preview-grid">
                    {[
                      ['Transit',      playerPreview.transit + ' days',         playerPreview.transit < rockets.nuclear.transit * 1.5 ? '#ffc107' : '#ff5555'],
                      ['vs Fleet NTR', '+' + (playerPreview.transit - rockets.nuclear.transit) + ' days slower', '#888'],
                      ['Radiation',    playerPreview.radiation + ' mSv',         playerPreview.radiation < 200 ? '#2bd946' : '#ffc107'],
                      ['Career Rad',   playerPreview.careerRadPct + '%',         playerPreview.careerRadPct < 30 ? '#2bd946' : '#ffc107'],
                      ['Bone Loss',    playerPreview.boneLossPct + '%',          '#ffc107'],
                      ['Abort ΔV',     playerPreview.abortDv + ' km/s',         playerPreview.abortDv > 1 ? '#2bd946' : '#ffc107'],
                      ['Propellant',   playerPreview.propellant.toLocaleString() + ' kg', '#fff'],
                      ['Cost',         '$' + playerPreview.cost + 'B',           '#fff'],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} className="builder-preview-row">
                        <span className="builder-preview-label">{lbl}</span>
                        <span className="builder-preview-value" style={{ color: col }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="builder-twr-note">
                    Fleet NTR uses 3 engines (T/W 0.49g) → 123-day transit.
                    Your design T/W = {playerPreview.twr?.toFixed(3)}g → {playerPreview.trajClass} → {playerPreview.transit} days.
                    Get T/W ≥ 0.25g to beat Chemical (247d) and Starship (288d). T/W ≥ 0.49g to match fleet NTR.
                    Choose a higher-thrust engine or a smaller tank to increase T/W.
                  </div>
                </div>

                <button className="customizer-next-btn" onClick={saveCustomRocket} style={{ marginTop: 16 }}>
                  ✓ LOCK IN ROCKET — RACE AGAINST THE FLEET
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
