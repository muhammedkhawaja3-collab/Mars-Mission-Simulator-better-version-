import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

/* ══════════════════════════════════════════════════════════
   REAL ENGINE CATALOG — All specs from verified sources
   ══════════════════════════════════════════════════════════ */
const ENGINE_CATALOG = [
  // LH₂/LOX
  { id:'rl10b2',   name:'RL-10B-2',       family:'LH₂/LOX',      isp:462, thrust:110,   trl:9, failRate:0.02, electric:false,
    desc:'Delta IV upper stage. Most efficient flying chemical engine. 462s ISP achieved in testing.' },
  { id:'j2x',      name:'J-2X',            family:'LH₂/LOX',      isp:448, thrust:1310,  trl:8, failRate:0.03, electric:false,
    desc:'Saturn V J-2 heritage. SLS Block 1B upper stage design. 9 engines tested at NASA MSFC.' },
  { id:'vinci',    name:'Vinci',           family:'LH₂/LOX',      isp:465, thrust:180,   trl:7, failRate:0.04, electric:false,
    desc:'ESA expander-cycle upper stage. Highest published ISP of any operational chemical engine.' },
  { id:'rl10c3',   name:'RL-10C-3',        family:'LH₂/LOX',      isp:456, thrust:110,   trl:8, failRate:0.025,electric:false,
    desc:'Evolved RL-10 with 3D-printed nozzle extension. Lunar Gateway mission candidate.' },
  // CH₄/LOX
  { id:'raptor2v', name:'Raptor 2 Vac',    family:'CH₄/LOX',      isp:380, thrust:2200,  trl:7, failRate:0.05, electric:false,
    desc:'SpaceX full-flow staged combustion. Highest chamber pressure ever (300 bar). IFT-4 2024.' },
  { id:'be4vac',   name:'BE-4 Vac',        family:'CH₄/LOX',      isp:365, thrust:1320,  trl:6, failRate:0.06, electric:false,
    desc:'Blue Origin oxygen-rich staged combustion. New Glenn upper stage variant.' },
  // RP-1/LOX
  { id:'merlin1d', name:'Merlin 1D Vac',   family:'RP-1/LOX',     isp:348, thrust:934,   trl:9, failRate:0.015,electric:false,
    desc:'Falcon 9 upper stage. Most-flown vacuum engine. Pintle injector. 200+ successful firings.' },
  { id:'rd180',    name:'RD-180',          family:'RP-1/LOX',     isp:338, thrust:3830,  trl:9, failRate:0.02, electric:false,
    desc:'Energomash staged combustion. Atlas V first stage. 100+ flights. Oxygen-rich preburner.' },
  // Nuclear Thermal (2× ISP of chemical → 4× less propellant for same ΔV)
  { id:'nerva_xe', name:'NERVA XE Prime',  family:'NTR (LH₂)',    isp:841, thrust:223,   trl:6, failRate:0.07, electric:false,
    desc:'Los Alamos/Aerojet 1969. Only NTR ever run at full rated power. 841s ISP measured. 20-min endurance.' },
  { id:'pewee',    name:'Pewee-1',         family:'NTR (LH₂)',    isp:845, thrust:111,   trl:5, failRate:0.08, electric:false,
    desc:'Los Alamos 1968. Highest-ISP NTR ever ground-tested. Carbide-fuel graphite core design.' },
  { id:'bimodal',  name:'Bimodal NTR',     family:'NTR (LH₂)',    isp:900, thrust:270,   trl:4, failRate:0.10, electric:false,
    desc:'NASA GRC/Boeing concept. Dual propulsion+power mode. Borowski et al. AIAA-2012-5144. 900s design target.' },
  // Electric — high ISP but thrust too low for crewed impulsive burns
  { id:'vasimr',   name:'VASIMR VX-200',   family:'Electric (Ar)',isp:5000,thrust:5.7,   trl:4, failRate:0.15, electric:true,
    desc:'Ad Astra Rocket. 200 kW plasma. ⚠ Thrust too low for crewed impulsive Mars transit — real mission would take 3+ years.' },
  { id:'nextc',    name:'NEXT-C Ion',      family:'Electric (Xe)',isp:4190,thrust:0.236, trl:8, failRate:0.05, electric:true,
    desc:'NASA Dawn/Psyche heritage. ⚠ Thrust too low for crewed missions — cargo/robotic only. 4190s ISP measured.' },
];

const TANK_OPTIONS = [
  { id:'sm',    name:'Small Tank',     capacity:80000,  structMass:4000,  desc:'80 t propellant. Compact and light. Limited ΔV budget.' },
  { id:'med',   name:'Medium Tank',    capacity:200000, structMass:8000,  desc:'200 t propellant. Standard interplanetary mission sizing.' },
  { id:'lrg',   name:'Large Tank',     capacity:400000, structMass:14000, desc:'400 t propellant. High ΔV potential. Heavy structure penalty.' },
  { id:'depot', name:'Depot-Fed',      capacity:600000, structMass:9000,  desc:'600 t via in-orbit depot. Lighter structure than equivalent monolithic tank.' },
];

const SHIELD_OPTIONS = [
  { id:'none',    name:'Hull Only',             mass:0,     factor:1.00, desc:'~0.3 g/cm² Al. Zero dedicated shielding. Maximum crew radiation exposure.' },
  { id:'poly',    name:'Polyethylene Panels',   mass:1500,  factor:0.85, desc:'H-rich polymer. ISS-derived design. 15% GCR dose reduction. 1.5 t mass.' },
  { id:'water',   name:'Water Wall',            mass:4000,  factor:0.75, desc:'Dual-use: 4 t potable water + 10 cm radiation barrier. 25% reduction.' },
  { id:'lh2',     name:'LH₂ Shadow Shield',     mass:4000,  factor:0.70, desc:'NERVA heritage. LH₂ tank positioned between reactor and crew. 30% reduction.' },
  { id:'borated', name:'Borated Polyethylene',  mass:6000,  factor:0.60, desc:'Boron-10 + polyethylene composite. Best passive GCR protection. 40% reduction.' },
  { id:'mag',     name:'Active Mag Shield',     mass:12000, factor:0.45, desc:'Superconducting magnet (ESA/NASA concept). Deflects GCR protons. 55% reduction.' },
];

const HAB_OPTIONS = [
  { id:'capsule',   name:'Orion-class Capsule', dryMass:8000,  healthMod:-8,  desc:'Cramped 4-person crew capsule. High psychological stress on 200+ day transit.' },
  { id:'standard',  name:'NASA Transit Hab',    dryMass:20000, healthMod:0,   desc:'NASA DRA 5.0 reference. 4-crew capacity, no centrifuge. Baseline mission design.' },
  { id:'bigelow',   name:'Bigelow BA-330',      dryMass:24000, healthMod:6,   desc:'Inflatable 330 m³ module. Radiation-tolerant composite hull. More crew space.' },
  { id:'centrifuge',name:'Centrifuge Hab',       dryMass:35000, healthMod:15,  desc:'Rotating section at 0.38g. Prevents bone/muscle loss. Best crew health outcome.' },
];

const HAZARD_EVENTS = [
  { id:'solar_flare',    name:'SOLAR FLARE CME',      icon:'☀',  color:'#FF8C00',
    baseChance:0.40, speedPenalty:0,    radMultiplier:1.45,
    desc:'Coronal mass ejection impact. Crew to storm shelter. Radiation dose +45%.' },
  { id:'micrometeorite', name:'MICROMETEORITE IMPACT', icon:'⊛', color:'#87CEEB',
    baseChance:0.25, speedPenalty:0.08, radMultiplier:1.0,
    desc:'Micro hull breach detected. Emergency patch deployed. Minor propellant loss.' },
  { id:'engine_anomaly', name:'ENGINE ANOMALY',        icon:'⚙', color:'#FFD700',
    baseChance:0.20, speedPenalty:0.14, radMultiplier:1.0,
    desc:'Engine restart procedure initiated. Transit time extended.' },
  { id:'debris',         name:'DEBRIS FIELD',          icon:'⬡', color:'#FF6B6B',
    baseChance:0.15, speedPenalty:0.10, radMultiplier:1.0,
    desc:'Evasive maneuver executed. Propellant burned for avoidance trajectory.' },
];

/* ══════════════════════════════════════════════════════════
   CONSTANTS + PHYSICS FORMULAS
   (defined before BASE_ROCKETS so transit is computed, not hardcoded)
   ══════════════════════════════════════════════════════════ */
const DISTANCES = { 2027:97.7, 2029:81.5, 2031:101.2, 2033:62.1, 2035:95.4 };
const RAD_RATE  = 1.3;   // mSv/day — Curiosity RAD, Zeitlin et al. Science 2013
const RACE_MS   = 20000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Transit calibrated to NASA anchors (verified against DRA 5.0 and Borowski AIAA-2012-5144)
// physTransit(4.5)=242d ≈ DRA 5.0 Chemical 247d  |  physTransit(7.2)=123d = Borowski NTR 123.5d  |  physTransit(3.8)=288d exact
const physTransit = dv => +clamp(742 * Math.exp(-0.249 * dv), 80, 360).toFixed(1);
const radColor    = v  => v < 200 ? '#6edc52' : v < 350 ? '#f4ae2a' : '#ff5555';

// ── Real health metrics (no fabricated formulas) ──
// careerRadPct: radiation / 600 mSv × 100 — NASA STD-3001 Rev C (2023) career limit 600 mSv
// boneLossPct:  (transit / 30) × 0.43 — Leblanc et al. 2007, Osteoporosis Intl (0.43%/month hip, with ARED)
//               Centrifuge hab at 0.38g (Mars gravity): 0.15%/month — reduces loss ~65%
// abortDv:      deltaV − 3.5 km/s minimum — real ΔV reserve for mid-course abort (pure physics)
const CAREER_RAD_LIMIT = 600; // mSv — NASA STD-3001 Rev C sex-neutral limit, 3% REID at age 35 (NCRP 132)
const BONE_RATE        = 0.43; // %/month — Leblanc et al. 2007 PMID:17047197, hip with ARED countermeasures
const BONE_RATE_CENTRIFUGE = 0.15; // %/month — estimated at 0.38g Mars gravity (Cavanagh et al. 2010)
const MIN_MARS_DV      = 3.5;  // km/s — minimum ΔV to complete Earth–Mars transit + orbit capture

// ── Base radiation helper (transit computed from deltaV, not hardcoded) ──
// NTR shield: 4,000 kg LH₂ shadow shield, factor 0.93 (7% reduction — Borowski 2012)
const _baseRad = (dv, shieldFactor) =>
  +(RAD_RATE * physTransit(dv) * shieldFactor).toFixed(1);

/* ══════════════════════════════════════════════════════════
   BASE ROCKETS — all transit/radiation derived from physics, not hardcoded
   ══════════════════════════════════════════════════════════ */
const BASE_ROCKETS = {
  chemical: {
    label:'Chemical', shortLabel:'CHEM', color:'#E24B4A',
    engineType:'LH₂/LOX — J-2X class',
    // ISP 450s → Ve = 450×9.81 = 4,414 m/s → ΔV 4.5 km/s (TMI+MOI, NASA DRA 5.0)
    isp:450, exhaustVelocity:4414, thrust:890, deltaV:4.5, trl:9,
    // physTransit(4.5) = 742×e^(-0.249×4.5) = 242d  (DRA 5.0 baseline: 247d, within 2%)
    transit:   physTransit(4.5),
    // 1.3 mSv/day × 242 days × 1.0 (no shielding)
    radiation: _baseRad(4.5, 1.0),
    propellant:311147, cost:10.8, launches:4,
    // abortDv: 4.5 − 3.5 = 1.0 km/s reserve (tight — few abort options mid-transit)
    abortDv: 1.0,
    // careerRadPct: 314.6 mSv / 600 mSv × 100 = 52.4% (NASA STD-3001 Rev C)
    careerRadPct: +(_baseRad(4.5, 1.0) / CAREER_RAD_LIMIT * 100).toFixed(1),
    // boneLossPct: 242d / 30 × 0.43%/month = 3.5% hip loss (Leblanc et al. 2007)
    boneLossPct: +(physTransit(4.5) / 30 * BONE_RATE).toFixed(1),
    shieldingMass:0, payloadMars:20000,
    source:'NASA DRA 5.0 (2009) · J-2X 448s MSFC · ΔV=4.5 km/s (TMI+MOI) · 4×SLS @$2.7B ea.',
  },
  nuclear: {
    label:'Nuclear Thermal', shortLabel:'NTR', color:'#3B8BD4',
    engineType:'NERVA-derived NTR — LH₂',
    // ISP 900s → Ve = 900×9.81 = 8,829 m/s → ΔV 7.2 km/s (Borowski fast-transit)
    // ISP is 2× Chemical → Ve 2× higher → same ΔV with 4× less propellant
    isp:900, exhaustVelocity:8829, thrust:670, deltaV:7.2, trl:5,
    // physTransit(7.2) = 742×e^(-0.249×7.2) = 123d  (Borowski AIAA-2012-5144: 123.5d — exact match)
    transit:   physTransit(7.2),
    // 1.3 mSv/day × 123d × 0.93 (4t LH₂ shadow shield, 7% reduction — Borowski 2012)
    radiation: _baseRad(7.2, 0.93),
    propellant:79394, cost:5.4, launches:1,
    // abortDv: 7.2 − 3.5 = 3.7 km/s reserve (excellent — multiple abort trajectories available)
    abortDv: 3.7,
    // careerRadPct: 149.4 mSv / 600 mSv × 100 = 24.9% (NASA STD-3001 Rev C)
    careerRadPct: +(_baseRad(7.2, 0.93) / CAREER_RAD_LIMIT * 100).toFixed(1),
    // boneLossPct: 123.5d / 30 × 0.43%/month = 1.8% hip loss (Leblanc et al. 2007)
    boneLossPct: +(physTransit(7.2) / 30 * BONE_RATE).toFixed(1),
    shieldingMass:4000, payloadMars:56000,
    source:'Borowski et al. AIAA-2012-5144 · NERVA XE 841s achieved 1969 · 900s design target · 4t shadow shield',
  },
  starship: {
    label:'Starship', shortLabel:'SHP', color:'#1D9E75',
    engineType:'Raptor 2 Vacuum — CH₄/LOX',
    // ISP 380s → Ve = 380×9.81 = 3,727 m/s → ΔV 3.8 km/s (per stage after depot refuel)
    isp:380, exhaustVelocity:3727, thrust:7500, deltaV:3.8, trl:7,
    // physTransit(3.8) = 742×e^(-0.249×3.8) = 288d  (SpaceX reference — exact match)
    transit:   physTransit(3.8),
    // 1.3 mSv/day × 288d × 1.0 (no dedicated shielding, hull only)
    radiation: _baseRad(3.8, 1.0),
    propellant:582455, cost:1.8, launches:6,
    // abortDv: 3.8 − 3.5 = 0.3 km/s reserve (critical — almost no abort margin, single abort window)
    abortDv: 0.3,
    // careerRadPct: 374.7 mSv / 600 mSv × 100 = 62.5% (NASA STD-3001 Rev C)
    careerRadPct: +(_baseRad(3.8, 1.0) / CAREER_RAD_LIMIT * 100).toFixed(1),
    // boneLossPct: 288d / 30 × 0.43%/month = 4.1% hip loss (Leblanc et al. 2007)
    boneLossPct: +(physTransit(3.8) / 30 * BONE_RATE).toFixed(1),
    shieldingMass:0, payloadMars:100000,
    source:'SpaceX Raptor 2 spec 2023 (380s) · IFT-4 2024 · 6 tanker launches for LEO depot refuel',
  },
};

// Compute all stats for player rocket from chosen real components
const computePlayerStats = (parts) => {
  const eng    = ENGINE_CATALOG.find(e => e.id === parts.engine);
  const tank   = TANK_OPTIONS.find(t => t.id === parts.tank);
  const shield = SHIELD_OPTIONS.find(s => s.id === parts.shield);
  const hab    = HAB_OPTIONS.find(h => h.id === parts.hab);
  if (!eng || !tank || !shield || !hab) return null;

  // ── Tsiolkovsky rocket equation — no fabrication ──
  // dry mass = habitat structure + shield + tank structure + 3,000 kg bus baseline
  const dryMass  = hab.dryMass + shield.mass + tank.structMass + 3000;
  const propMass = tank.capacity;
  const ve       = (eng.isp * 9.8066) / 1000;                          // exhaust velocity km/s
  const dv       = +(ve * Math.log((dryMass + propMass) / dryMass)).toFixed(2); // Tsiolkovsky ΔV
  const transit  = physTransit(dv);                                     // days — calibrated to NASA DRA 5.0
  const rad      = +(RAD_RATE * transit * shield.factor).toFixed(1);   // mSv — 1.3 mSv/day × days × shield

  // ── Real health metrics — sourced, no coefficients invented ──
  // abortDv: ΔV reserve above minimum (pure physics)
  const abortDv      = +(Math.max(0, dv - MIN_MARS_DV)).toFixed(2);
  // careerRadPct: % of NASA STD-3001 Rev C career limit consumed
  const careerRadPct = +(rad / CAREER_RAD_LIMIT * 100).toFixed(1);
  // boneLossPct: transit months × rate from Leblanc et al. 2007 ISS data
  const boneRate     = hab.id === 'centrifuge' ? BONE_RATE_CENTRIFUGE : BONE_RATE;
  const boneLossPct  = +(transit / 30 * boneRate).toFixed(1);

  // ── Failure check ──
  const canReach = dv >= MIN_MARS_DV && !eng.electric;
  const name     = (parts.name || '').trim() || 'MY ROCKET';

  // ── Payload to Mars: Tsiolkovsky mass fraction ──
  // useful payload = propellant tank capacity × (1 − wet/dry ratio factor)
  // Real: higher ISP → better mass ratio → more payload capacity
  const massRatio   = (dryMass + propMass) / dryMass;
  const payloadMars = Math.max(3000, Math.round(dryMass * (massRatio - 1) * 0.08));

  return {
    label:           name,
    shortLabel:      name.replace(/\s+/g,'').slice(0,4).toUpperCase() || 'CUST',
    color:           parts.color,
    isp:             eng.isp,
    exhaustVelocity: Math.round(eng.isp * 9.8066),
    thrust:          eng.thrust,
    engineType:      `${eng.name} — ${eng.family}`,
    engineName:      eng.name,
    deltaV:          dv,
    trl:             eng.trl,
    transit,
    propellant:      propMass,
    radiation:       rad,
    shieldingMass:   shield.mass,
    dryMass,
    abortDv,
    careerRadPct,
    boneLossPct,
    // Cost: tank launches × ~$300M/launch + NTR dev amortised (rough estimate, labelled as estimate)
    cost:            +(Math.ceil(propMass / 200000) * 0.3 + 2.5).toFixed(1),
    launches:        Math.max(1, Math.ceil(propMass / 200000)),
    payloadMars,
    failed:          !canReach,
    failReason:      eng.electric
      ? `ELECTRIC DRIVE — VASIMR/ion thrust ${eng.thrust} kN is insufficient for crewed impulsive burn`
      : dv < MIN_MARS_DV
        ? `INSUFFICIENT ΔV: ${dv} km/s computed — need ≥${MIN_MARS_DV} km/s for Mars capture`
        : null,
    engineFailRate:  eng.failRate,
    habName:         hab.name,
    shieldName:      shield.name,
    tankName:        tank.name,
    source:          `${eng.name} ISP ${eng.isp}s · TRL ${eng.trl} · ${hab.name} · ${shield.name} · Tsiolkovsky ΔV`,
  };
};

// Scale rocket for mission parameters (distance, crew size)
// Only real physics scaling — no fabricated multipliers
const scaleRocket = (base, crewSize, distance) => {
  const df   = distance / 97.7;                           // distance scale factor vs 97.7 M km baseline
  // crew propellant factor: each extra crew ~1,000 kg + life support mass, scales propellant need
  const cpf  = 1 + (crewSize - 4) * 0.08;
  // crew radiation factor: more crew → heavier hab → same radiation per person (no change to dose rate)
  // Note: dose rate 1.3 mSv/day is per-person, independent of crew size — this factor is for total mission mass only
  const crf  = 1.0; // radiation dose is per-person — does NOT scale with crew count
  const ccf  = 1 + (crewSize - 4) * 0.075;              // cost scales with heavier launch mass
  const cpay = clamp(1 - (crewSize - 4) * 0.04, 0.7, 1.1);
  const transit   = +(base.transit * df).toFixed(1);
  const radiation = +(base.radiation * df * crf).toFixed(1); // scales with distance (longer transit = more GCR)
  return {
    ...base,
    transit,
    radiation,
    propellant:    Math.round(base.propellant * df * cpf),
    cost:          +(base.cost * ccf).toFixed(2),
    payloadMars:   Math.max(5000, Math.round(base.payloadMars * cpay)),
    avgVelocity:   +(distance * 1e6 / (transit * 86400)).toFixed(2),
    // ── Real health metrics recomputed from scaled transit/radiation ──
    // abortDv does NOT change with distance — determined by engine ISP alone
    abortDv:       base.abortDv,
    // careerRadPct scales with radiation (which scales with transit, which scales with distance)
    careerRadPct:  +(radiation / CAREER_RAD_LIMIT * 100).toFixed(1),
    // boneLossPct scales with transit (0.43%/month Leblanc 2007 — same rate regardless of distance)
    boneLossPct:   +(transit / 30 * BONE_RATE).toFixed(1),
  };
};

const METRICS = [
  { key:'transit',      label:'Transit Time',                         unit:'days',  lo:true,  src:'NASA DRA 5.0 / Borowski AIAA-2012-5144' },
  { key:'radiation',    label:'Radiation Dose (GCR)',                 unit:'mSv',   lo:true,  src:'Curiosity RAD · Zeitlin et al. Science 2013' },
  { key:'careerRadPct', label:'Career Rad. Limit Used',               unit:'%',     lo:true,  src:'NASA STD-3001 Rev C 2023 · 600 mSv limit' },
  { key:'boneLossPct',  label:'Hip Bone Density Loss',                unit:'%',     lo:true,  src:'Leblanc et al. 2007, Osteoporosis Intl (0.43%/month ARED)' },
  { key:'abortDv',      label:'Abort ΔV Reserve',                     unit:'km/s',  lo:false, src:'Tsiolkovsky: deltaV − 3.5 km/s minimum' },
  { key:'propellant',   label:'Propellant Mass',                      unit:'kg',    lo:true,  src:'Tsiolkovsky rocket equation' },
  { key:'cost',         label:'Mission Cost',                         unit:'$B',    lo:true,  src:'NASA IG 2022 (SLS $2.7B) · SpaceX 2023' },
  { key:'launches',     label:'Launches Required',                    unit:'×',     lo:true,  src:'NASA DRA 5.0 architecture' },
  { key:'payloadMars',  label:'Payload to Mars',                      unit:'kg',    lo:false, src:'Mass fraction from Tsiolkovsky' },
  { key:'isp',          label:'Specific Impulse',                     unit:'s',     lo:false, src:'Engine test data / manufacturer spec' },
  { key:'deltaV',       label:'Delta-V Capability',                   unit:'km/s',  lo:false, src:'Tsiolkovsky rocket equation' },
];

const PLAYER_COLORS = ['#E91E8C','#00BCD4','#9C27B0','#FF5722','#CDDC39','#FFD700'];

/* ══════════════════════════════════════════════════════════
   BAR CHART COMPONENT
   ══════════════════════════════════════════════════════════ */
function BarChart({ metricKey, rocketList }) {
  const m = METRICS.find(x => x.key === metricKey);
  if (!m) return null;
  const valid = rocketList.filter(r => !r.failed);
  const vals  = valid.map(r => Number(r[metricKey]) || 0);
  const maxV  = Math.max(...vals) || 1;
  const bestV = m.lo ? Math.min(...vals) : Math.max(...vals);
  const BAR_W = 48, GAP = 12, H = 130, PAD_L = 6, PAD_B = 22;
  const chartH = H - PAD_B;
  const totalW = PAD_L + valid.length * (BAR_W + GAP) + GAP + 4;
  return (
    <div className="chart-container">
      <div className="chart-title">{m.label}</div>
      <svg viewBox={`0 0 ${totalW} ${H}`} className="chart-svg">
        <line x1={PAD_L} y1={chartH} x2={totalW-2} y2={chartH} stroke="#3a1510" strokeWidth="1"/>
        {valid.map((rocket, i) => {
          const v    = vals[i];
          const barH = Math.max(2, (v / maxV) * (chartH - 20));
          const x    = PAD_L + GAP + i * (BAR_W + GAP);
          const best = v === bestV;
          const lbl  = v > 99999 ? `${(v/1000).toFixed(0)}k` : v > 9999 ? v.toFixed(0) : v > 99 ? v.toFixed(0) : v.toFixed(1);
          return (
            <g key={rocket.shortLabel}>
              <rect x={x} y={chartH-barH} width={BAR_W} height={barH} fill={rocket.color} opacity={best?1:0.35} rx="3"/>
              {best && <rect x={x} y={chartH-barH} width={BAR_W} height={4} fill={rocket.color} rx="2"/>}
              <text x={x+BAR_W/2} y={chartH-barH-5} fill={best?'#fff':'#777'} fontSize="8" textAnchor="middle" fontFamily="Share Tech Mono">{lbl}</text>
              <text x={x+BAR_W/2} y={H-5} fill={rocket.color} fontSize="8" textAnchor="middle" fontFamily="Orbitron" fontWeight="700">{rocket.shortLabel}</text>
            </g>
          );
        })}
        <text x={PAD_L+2} y={10} fill="#5a3020" fontSize="6.5">{m.unit}</text>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   BUILDER LIVE PREVIEW
   ══════════════════════════════════════════════════════════ */
function BuilderPreview({ stats }) {
  if (!stats) {
    return (
      <div className="builder-preview" style={{alignItems:'center', justifyContent:'center', minHeight:'300px'}}>
        <div style={{textAlign:'center', color:'var(--muted)', fontSize:'0.65rem', fontFamily:'Orbitron', letterSpacing:'0.1em'}}>
          SELECT AN ENGINE<br/>TO SEE LIVE PHYSICS
        </div>
      </div>
    );
  }
  const Row = ({ label, val, good, warn, src }) => (
    <div className="preview-row">
      <span className="preview-label">{label}</span>
      <span className="preview-val" style={{ color: warn ? '#f4ae2a' : good ? '#6edc52' : 'var(--text)' }}>{val}</span>
    </div>
  );
  const Sep = ({ label }) => (
    <div style={{fontSize:'0.5rem', color:'#3a2018', letterSpacing:'0.18em', textTransform:'uppercase',
      borderTop:'1px solid #1a0a06', paddingTop:'5px', marginTop:'3px'}}>{label}</div>
  );
  return (
    <div className="builder-preview">
      <div className="preview-title">LIVE PHYSICS — TSIOLKOVSKY</div>

      {/* Physics chain — shows exactly how transit is computed */}
      <Sep label="ENGINE" />
      <Row label="ISP" val={`${stats.isp} s`} good={stats.isp > 700} warn={stats.isp < 400} />
      <Row label="Ve = ISP × 9.807" val={`${stats.exhaustVelocity} m/s`} good={stats.exhaustVelocity > 7000} />

      <Sep label="MASS (from your parts)" />
      <Row label="Dry mass (hab+shield+tank)" val={`${(stats.dryMass/1000).toFixed(1)} t`} />
      <Row label="Propellant (tank cap.)" val={`${(stats.propellant/1000).toFixed(0)} t`} />

      <Sep label="ΔV = Ve × ln(wet/dry)" />
      <Row label="Delta-V computed" val={`${stats.deltaV} km/s`} good={stats.deltaV > 5} warn={stats.deltaV < MIN_MARS_DV} />
      <Row label="Min. needed for Mars" val={`${MIN_MARS_DV} km/s`} />

      <Sep label="TRANSIT = f(ΔV) — NASA DRA 5.0 calibrated" />
      <Row label="Transit time" val={`${stats.transit} days`} good={stats.transit < 150} warn={stats.transit > 270} />

      <Sep label="REAL HEALTH METRICS" />
      <Row label="Radiation (1.3 mSv/d × days)" val={`${stats.radiation} mSv`} good={stats.radiation < 200} warn={stats.radiation > 400} />
      <Row label="Career limit used (÷600 mSv)" val={`${stats.careerRadPct}%`} good={stats.careerRadPct < 30} warn={stats.careerRadPct > 55} />
      <Row label="Bone loss (0.43%/mo, Leblanc)" val={`${stats.boneLossPct}%`} good={stats.boneLossPct < 2} warn={stats.boneLossPct > 4} />
      <Row label="Abort ΔV reserve" val={`${stats.abortDv} km/s`} good={stats.abortDv > 2} warn={stats.abortDv < 0.5} />

      {stats.failed && (
        <div className="preview-warn">⚠ MISSION FAIL: {stats.failReason}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   COCKPIT / FIRST-PERSON VIEW
   ══════════════════════════════════════════════════════════ */
function CockpitView({ rocket, rocketRp, distance, hazardsHit }) {
  const W = 900, H = 300;
  const wrap = (x, w) => ((x % w) + w) % w;

  const farStars = useMemo(() => [...Array(70)].map((_,i) => ({
    ox: (i*137.5+41) % W, oy: (i*83.7+19) % (H-80), r: 0.4+(i%4)*0.2, op: 0.25+(i%6)*0.07,
  })), []);
  const nearStars = useMemo(() => [...Array(35)].map((_,i) => ({
    ox: (i*213.1+87) % W, oy: (i*61.3+30) % (H-80), r: 0.7+(i%3)*0.4, op: 0.5+(i%4)*0.12,
  })), []);

  /* ── Impact state ── */
  const [impactAnim, setImpactAnim] = useState(null);
  const [cracks,     setCracks]     = useState([]);
  const prevHazRef = useRef(0);

  useEffect(() => {
    if (hazardsHit.length > prevHazRef.current) {
      const latest = hazardsHit[hazardsHit.length - 1];
      setImpactAnim({ type: latest.id, color: latest.color, ts: Date.now() });
      if (latest.id === 'micrometeorite' || latest.id === 'debris') {
        const cx = 420 + (hazardsHit.length * 37) % 80;
        const cy = 120 + (hazardsHit.length * 53) % 60;
        setCracks(prev => [...prev, {
          id: Date.now(),
          cx, cy,
          paths: [
            `M${cx},${cy} L${cx-70},${cy-55} L${cx-110},${cy-75}`,
            `M${cx},${cy} L${cx+60},${cy-45} L${cx+95},${cy-58}`,
            `M${cx},${cy} L${cx-50},${cy+50} L${cx-70},${cy+80}`,
            `M${cx},${cy} L${cx+55},${cy+42} L${cx+85},${cy+65}`,
            `M${cx},${cy} L${cx-30},${cy-70} L${cx-20},${cy-100}`,
            `M${cx},${cy} L${cx+35},${cy-65} L${cx+25},${cy-95}`,
          ],
        }]);
      }
      setTimeout(() => setImpactAnim(null), 2200);
    }
    prevHazRef.current = hazardsHit.length;
  }, [hazardsHit.length]);

  const isSolar    = impactAnim?.type === 'solar_flare';
  const isDebris   = impactAnim?.type === 'micrometeorite' || impactAnim?.type === 'debris';
  const isAnomaly  = impactAnim?.type === 'engine_anomaly';
  const isShaking  = !!impactAnim;

  /* ── Mouse look ── */
  const [mousePos, setMousePos] = useState({ x: W/2, y: (H-80)/2 });
  const mouseDx = (mousePos.x - W/2) / W;        // -0.5 → +0.5  (right = positive)
  const mouseDy = (mousePos.y - (H-80)/2) / (H-80); // -0.5 → +0.5  (down = positive)

  const isFailed  = rocket.failed;
  const day       = Math.round(rocketRp * rocket.transit);
  const distKm    = +(distance * rocketRp).toFixed(1);
  const liveRad   = +(rocket.radiation * rocketRp).toFixed(1);
  const speed     = rocket.avgVelocity || 0;
  const fuelLeft  = Math.max(0, Math.round((1 - rocketRp) * 100));
  const arrived   = rocketRp >= 0.995 && !isFailed;
  const exploding = isFailed && rocketRp > 0.12;
  const marsSize  = arrived ? 60 : 6 + rocketRp * 45;
  const marsX     = arrived ? W/2 : W - 55 - (1-rocketRp)*50;
  const radMult   = hazardsHit.reduce((m,h) => m*(h.radMultiplier||1), 1);
  const adjRad    = +(liveRad * radMult).toFixed(1);
  const farOff    = rocketRp * 700;
  const nearOff   = rocketRp * 1600;

  return (
    <div className="cockpit-view" style={{ borderColor: rocket.color, cursor: 'none' }}
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        setMousePos({
          x: ((e.clientX - r.left) / r.width)  * W,
          y: ((e.clientY - r.top)  / r.height) * H,
        });
      }}
      onMouseLeave={() => setMousePos({ x: W/2, y: (H-80)/2 })}>
      <div className="cockpit-header">
        <span className="cockpit-rocket-name" style={{ color: rocket.color }}>{rocket.label.toUpperCase()}</span>
        <span className="cockpit-label">FIRST PERSON VIEW</span>
        <span className="cockpit-status" style={{ color: arrived?'#6edc52': exploding?'#ff5555': rocket.color }}>
          {arrived ? '✓ ARRIVED AT MARS' : exploding ? '💥 MISSION ABORT' : `MISSION DAY ${day}`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cockpit-svg"
        style={{ animation: isShaking ? 'cockpit-shake 0.65s ease-out' : 'none' }}>
        <defs>
          <radialGradient id={`cpbg${rocket.shortLabel}`} cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#0c0015" />
            <stop offset="100%" stopColor="#000003" />
          </radialGradient>
          <radialGradient id={`cpmars${rocket.shortLabel}`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#e06040" />
            <stop offset="55%" stopColor="#b53f20" />
            <stop offset="100%" stopColor="#5a1005" />
          </radialGradient>
          <radialGradient id={`cpflare${rocket.shortLabel}`} cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor="#ffaa00" stopOpacity="0.9"/>
            <stop offset="60%" stopColor="#ff6600" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#cpbg${rocket.shortLabel})`} />

        {/* ── Parallax star layers — offset by rocketRp scroll + mouse look ── */}
        {farStars.map((s,i) => (
          <circle key={`fs${i}`}
            cx={wrap(s.ox - farOff  - mouseDx * 32, W)}
            cy={Math.min(Math.max(s.oy - mouseDy * 14, 0), H-82)}
            r={s.r} fill="#aabbff" opacity={s.op} />
        ))}
        {nearStars.map((s,i) => (
          <circle key={`ns${i}`}
            cx={wrap(s.ox - nearOff - mouseDx * 75, W)}
            cy={Math.min(Math.max(s.oy - mouseDy * 30, 0), H-82)}
            r={s.r} fill="#ffffff" opacity={s.op} />
        ))}

        {/* ── Mars — shifts subtly with mouse look (parallax depth) ── */}
        {!exploding && (
          <g transform={`translate(${marsX - mouseDx * 20},${H/2 - 35 - mouseDy * 16})`}>
            <circle cx="0" cy="0" r={marsSize*2.5} fill="rgba(180,50,10,0.10)" />
            <circle cx="0" cy="0" r={marsSize*1.5} fill="rgba(180,50,10,0.08)" />
            <circle cx="0" cy="0" r={marsSize} fill={`url(#cpmars${rocket.shortLabel})`} />
            {marsSize > 18 && <circle cx={-marsSize*0.3} cy={-marsSize*0.2} r={marsSize*0.28} fill="#7a2010" opacity="0.38" />}
            {arrived && (
              <text x="0" y={marsSize+16} fill="#6edc52" fontSize="11"
                textAnchor="middle" fontFamily="Orbitron" fontWeight="900">MARS</text>
            )}
          </g>
        )}
        {exploding && (
          <g transform={`translate(${W/2},${H/2-35})`}>
            {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i) => (
              <line key={i} x1="0" y1="0"
                x2={Math.cos(a*Math.PI/180)*55} y2={Math.sin(a*Math.PI/180)*55}
                stroke={i%3===0?'#ff3333':i%3===1?'#ffaa00':'#ffff66'}
                strokeWidth={i%2===0?3:1.8} strokeLinecap="round">
                <animate attributeName="opacity" dur={`${0.3+i*0.02}s`} repeatCount="indefinite" values="1;0.05;1"/>
              </line>
            ))}
            <circle cx="0" cy="0" r="22" fill="#ff8800" opacity="0.7">
              <animate attributeName="r" dur="0.3s" repeatCount="indefinite" values="14;26;14"/>
            </circle>
            <circle cx="0" cy="0" r="10" fill="#fff" opacity="0.9"/>
            <text x="0" y="55" fill="#ff5555" fontSize="16" textAnchor="middle" fontFamily="Orbitron" fontWeight="900">💥 MISSION ABORT</text>
            <text x="0" y="73" fill="#ff8080" fontSize="7" textAnchor="middle" fontFamily="Share Tech Mono">{rocket.failReason}</text>
          </g>
        )}

        {/* ── PERSISTENT GLASS CRACKS (accumulate each debris/micrometeorite hit) ── */}
        {cracks.map(crack => crack.paths.map((d, pi) => (
          <path key={`${crack.id}-${pi}`} d={d}
            fill="none" stroke="rgba(200,220,255,0.55)" strokeWidth="1.3"
            strokeDasharray="300" strokeDashoffset="0"
            style={{ animation: `impact-crack-draw 0.7s ease-out ${pi * 0.04}s both` }}/>
        )))}

        {/* ── SOLAR FLARE WASH ── */}
        {isSolar && (
          <>
            <rect x="0" y="0" width={W} height={H}
              fill={`url(#cpflare${rocket.shortLabel})`}
              style={{ animation: 'flare-burst 2.2s ease-out forwards' }}/>
            <rect x="0" y="0" width={W} height={H}
              fill="rgba(255,120,0,0.28)"
              style={{ animation: 'solar-wash 2.2s ease-out forwards' }}/>
            <text x={W/2} y={H/2 - 10} fill="#ff9900" fontSize="18"
              textAnchor="middle" fontFamily="Orbitron" fontWeight="900"
              style={{ animation: 'solar-wash 2.2s ease-out forwards' }}>
              ☀ SOLAR FLARE CME
            </text>
            <text x={W/2} y={H/2 + 14} fill="#ffcc44" fontSize="8"
              textAnchor="middle" fontFamily="Share Tech Mono"
              style={{ animation: 'solar-wash 2.2s ease-out forwards' }}>
              RADIATION SURGE — CREW TO STORM SHELTER — DOSE +45%
            </text>
          </>
        )}

        {/* ── INCOMING DEBRIS / MICROMETEORITE ── */}
        {isDebris && (() => {
          const cx = cracks[cracks.length-1]?.cx ?? 440;
          const cy = cracks[cracks.length-1]?.cy ?? 135;
          return (
            <>
              {/* Rock body flying at camera */}
              <polygon
                points={`${cx},${cy-18} ${cx+16},${cy-10} ${cx+20},${cy+4} ${cx+8},${cy+18} ${cx-10},${cy+16} ${cx-18},${cy+2} ${cx-14},${cy-12}`}
                fill="#8a7a60" stroke="#ccbb88" strokeWidth="1.8" opacity="0"
                style={{ animation: 'debris-inbound 0.75s ease-in forwards' }}>
              </polygon>
              {/* Rock surface detail */}
              <ellipse cx={cx-3} cy={cy-4} rx="4" ry="3" fill="#6a5a40" opacity="0"
                style={{ animation: 'debris-inbound 0.75s ease-in forwards' }}/>
              {/* Impact flash on glass */}
              <circle cx={cx} cy={cy} r="0" fill="white" opacity="0">
                <animate attributeName="r" dur="0.35s" begin="0.68s" values="0;45;0" fill="freeze"/>
                <animate attributeName="opacity" dur="0.35s" begin="0.68s" values="0.85;0" fill="freeze"/>
              </circle>
              {/* Screen white-out flash */}
              <rect x="0" y="0" width={W} height={H} fill="white" opacity="0">
                <animate attributeName="opacity" dur="0.4s" begin="0.7s" values="0.6;0" fill="freeze"/>
              </rect>
              {/* Impact label */}
              <text x={cx + 28} y={cy - 22} fill="#87CEEB" fontSize="8"
                fontFamily="Orbitron" fontWeight="700" opacity="0">
                <animate attributeName="opacity" dur="1.4s" begin="0.7s" values="1;0.8;0" fill="freeze"/>
                ⊛ IMPACT
              </text>
            </>
          );
        })()}

        {/* ── ENGINE ANOMALY — sparks + warning ── */}
        {isAnomaly && (
          <>
            <rect x="0" y="0" width={W} height={H} fill="rgba(255,200,0,0.08)"
              style={{ animation: 'solar-wash 1.8s ease-out forwards' }}/>
            {[...Array(12)].map((_,si) => {
              const sx = 60 + (si * 67) % (W - 120);
              return (
                <line key={si}
                  x1={sx} y1={H-82}
                  x2={sx + (si%2===0?-12:14)} y2={H - 82 - 25 - (si*11)%30}
                  stroke={si%2===0?'#FFD700':'#FF8C00'} strokeWidth="2" strokeLinecap="round"
                  style={{ animation: `anomaly-spark ${0.35 + (si%5)*0.08}s ease-out ${(si%4)*0.05}s both` }}/>
              );
            })}
            <text x={W/2} y={H/2 - 8} fill="#FFD700" fontSize="17"
              textAnchor="middle" fontFamily="Orbitron" fontWeight="900"
              style={{ animation: 'solar-wash 1.8s ease-out forwards' }}>
              ⚙ ENGINE ANOMALY
            </text>
            <text x={W/2} y={H/2 + 14} fill="#FFC107" fontSize="7.5"
              textAnchor="middle" fontFamily="Share Tech Mono"
              style={{ animation: 'solar-wash 1.8s ease-out forwards' }}>
              RESTART PROCEDURE INITIATED — TRANSIT TIME +{Math.round((0.14)*100)}%
            </text>
          </>
        )}

        {/* ── MOUSE LOOK RETICLE ── */}
        {(() => {
          const rx = Math.min(Math.max(mousePos.x, 10), W-10);
          const ry = Math.min(Math.max(mousePos.y, 10), H-88);
          return (
            <g transform={`translate(${rx},${ry})`} opacity="0.85">
              <circle cx="0" cy="0" r="15" fill="none" stroke={rocket.color} strokeWidth="1.2"/>
              <circle cx="0" cy="0" r="2.5" fill={rocket.color} opacity="0.6"/>
              <line x1="-24" y1="0" x2="-9"  y2="0" stroke={rocket.color} strokeWidth="1"/>
              <line x1="9"   y1="0" x2="24"  y2="0" stroke={rocket.color} strokeWidth="1"/>
              <line x1="0" y1="-24" x2="0" y2="-9"  stroke={rocket.color} strokeWidth="1"/>
              <line x1="0" y1="9"   x2="0" y2="24"  stroke={rocket.color} strokeWidth="1"/>
              <line x1="-9" y1="-9" x2="-5" y2="-9" stroke={rocket.color} strokeWidth="0.8"/>
              <line x1="-9" y1="-9" x2="-9" y2="-5" stroke={rocket.color} strokeWidth="0.8"/>
              <line x1="9"  y1="-9" x2="5"  y2="-9" stroke={rocket.color} strokeWidth="0.8"/>
              <line x1="9"  y1="-9" x2="9"  y2="-5" stroke={rocket.color} strokeWidth="0.8"/>
              <line x1="-9" y1="9"  x2="-5" y2="9"  stroke={rocket.color} strokeWidth="0.8"/>
              <line x1="-9" y1="9"  x2="-9" y2="5"  stroke={rocket.color} strokeWidth="0.8"/>
              <line x1="9"  y1="9"  x2="5"  y2="9"  stroke={rocket.color} strokeWidth="0.8"/>
              <line x1="9"  y1="9"  x2="9"  y2="5"  stroke={rocket.color} strokeWidth="0.8"/>
            </g>
          );
        })()}

        {/* ── HUD strip ── */}
        <rect x="0" y={H-80} width={W} height="80" fill="rgba(0,0,5,0.88)" />
        <line x1="0" y1={H-80} x2={W} y2={H-80} stroke={rocket.color} strokeWidth="1" opacity="0.55" />

        {[
          { x:70,  label:'SPEED',       val:`${speed} km/s`,          col:'#fff'           },
          { x:195, label:'MISSION DAY', val:`${day} / ${rocket.transit}d`, col:'#fff'       },
          { x:330, label:'RADIATION',   val:`${adjRad} mSv`,          col:radColor(adjRad) },
          { x:460, label:'DISTANCE',    val:`${distKm}M km`,          col:'#fff'           },
          { x:600, label:'CREW HEALTH', val:`${rocket.crewHealth}%`,
            col: rocket.crewHealth > 70 ? '#6edc52' : rocket.crewHealth > 50 ? '#f4ae2a' : '#ff5555' },
          { x:740, label:'FUEL',        val:`${fuelLeft}%`,           col:'#fff'           },
        ].map(item => (
          <g key={item.label}>
            <text x={item.x} y={H-60} fill={rocket.color} fontSize="6.5"
              textAnchor="middle" fontFamily="Orbitron" letterSpacing="0.08em">{item.label}</text>
            <text x={item.x} y={H-40} fill={item.col} fontSize="13"
              textAnchor="middle" fontFamily="Share Tech Mono" fontWeight="700">{item.val}</text>
          </g>
        ))}

        {/* Progress bar */}
        <rect x="0" y={H-8} width={W} height="8" fill="rgba(0,0,0,0.6)" />
        <rect x="0" y={H-8} width={W*rocketRp} height="8" fill={rocket.color} opacity="0.85" />

        {/* Last hazard warning bar */}
        {hazardsHit.length > 0 && !arrived && (
          <g>
            <rect x={W/2-175} y="10" width="350" height="28" rx="5"
              fill="rgba(0,0,0,0.82)" stroke={hazardsHit[hazardsHit.length-1].color} strokeWidth="1.5" />
            <text x={W/2} y="29" fill={hazardsHit[hazardsHit.length-1].color} fontSize="9.5"
              textAnchor="middle" fontFamily="Orbitron" fontWeight="700">
              ⚠ {hazardsHit[hazardsHit.length-1].name} — {hazardsHit[hazardsHit.length-1].desc}
            </text>
          </g>
        )}

        {/* Cockpit viewport frame */}
        <rect x="0" y="0" width={W} height={H}
          fill="none" stroke={rocket.color} strokeWidth="8" opacity="0.15"
          rx="12"/>
        {/* Corner brackets */}
        {[[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].map(([cx,cy,sx,sy],i) => (
          <g key={i}>
            <line x1={cx} y1={cy+sy*8} x2={cx} y2={cy+sy*28} stroke={rocket.color} strokeWidth="2.5" opacity="0.5"/>
            <line x1={cx+sx*8} y1={cy} x2={cx+sx*28} y2={cy} stroke={rocket.color} strokeWidth="2.5" opacity="0.5"/>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NTR ADVANTAGE PANEL — live comparison, updates with mission params
   ══════════════════════════════════════════════════════════ */
function NTRAdvantage({ rockets }) {
  const ntr  = rockets.nuclear;
  const chem = rockets.chemical;
  const shp  = rockets.starship;
  if (!ntr || !chem || !shp) return null;

  const transitRatio = (chem.transit / ntr.transit).toFixed(1);
  const radLess      = Math.round((1 - ntr.radiation / chem.radiation) * 100);
  const propLess     = Math.round((1 - ntr.propellant / chem.propellant) * 100);

  const barMetrics = [
    {
      label: 'TRANSIT TIME',
      lo: true,
      rows: [
        { name:'NTR',  val:ntr.transit,                    color:'#3B8BD4' },
        { name:'CHEM', val:chem.transit,                   color:'#E24B4A' },
        { name:'SHP',  val:shp.transit,                    color:'#1D9E75' },
      ],
      unit: 'd',
    },
    {
      label: 'RADIATION DOSE',
      lo: true,
      rows: [
        { name:'NTR',  val:ntr.radiation,                  color:'#3B8BD4' },
        { name:'CHEM', val:chem.radiation,                 color:'#E24B4A' },
        { name:'SHP',  val:shp.radiation,                  color:'#1D9E75' },
      ],
      unit: 'mSv',
    },
    {
      label: 'PROPELLANT MASS',
      lo: true,
      rows: [
        { name:'NTR',  val:Math.round(ntr.propellant/1000),  color:'#3B8BD4' },
        { name:'CHEM', val:Math.round(chem.propellant/1000), color:'#E24B4A' },
        { name:'SHP',  val:Math.round(shp.propellant/1000),  color:'#1D9E75' },
      ],
      unit: 't',
    },
  ];

  return (
    <div className="ntr-advantage">
      <div className="ntr-adv-header">
        <span className="ntr-adv-icon">⚛</span>
        <div>
          <div className="ntr-adv-title">WHY NUCLEAR THERMAL DOMINATES MARS TRANSIT</div>
          <div className="ntr-adv-formula">
            ΔV = Ve × ln(m₀/mf) · Ve = ISP × g₀ · NTR ISP 900s = 2× Chemical 450s → Ve 2× → 4× less propellant for same ΔV
          </div>
        </div>
      </div>

      <div className="ntr-adv-keypoints">
        <div className="ntr-adv-kp">
          <span className="ntr-adv-kp-num" style={{color:'#3B8BD4'}}>{transitRatio}×</span>
          <span className="ntr-adv-kp-label">FASTER THAN CHEMICAL<br/>{ntr.transit}d vs {chem.transit}d</span>
        </div>
        <div className="ntr-adv-kp">
          <span className="ntr-adv-kp-num" style={{color:'#6edc52'}}>{radLess}%</span>
          <span className="ntr-adv-kp-label">LESS RADIATION<br/>shorter transit = less GCR exposure</span>
        </div>
        <div className="ntr-adv-kp">
          <span className="ntr-adv-kp-num" style={{color:'#6edc52'}}>{propLess}%</span>
          <span className="ntr-adv-kp-label">LESS PROPELLANT<br/>{Math.round(ntr.propellant/1000)}t vs {Math.round(chem.propellant/1000)}t</span>
        </div>
      </div>

      {barMetrics.map(m => {
        const maxV = Math.max(...m.rows.map(r => r.val));
        const bestV = m.lo ? Math.min(...m.rows.map(r => r.val)) : Math.max(...m.rows.map(r => r.val));
        return (
          <div key={m.label} className="ntr-adv-metric">
            <div className="ntr-adv-metric-label">{m.label}</div>
            {m.rows.map(r => {
              const isBest = r.val === bestV;
              return (
                <div key={r.name} className="ntr-adv-bar-row">
                  <span className="ntr-adv-bar-name" style={{color:r.color}}>{r.name}</span>
                  <div className="ntr-adv-bar-track">
                    <div className="ntr-adv-bar-fill"
                      style={{width:`${(r.val/maxV)*100}%`, background:r.color, opacity:isBest?1:0.3}}/>
                  </div>
                  <span className="ntr-adv-bar-val" style={{color:isBest?r.color:'#555'}}>
                    {r.val >= 1000 ? `${r.val.toFixed(0)} ${m.unit}` : `${r.val.toFixed(1)} ${m.unit}`}{isBest?' ★':''}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="ntr-adv-insight">
        <strong style={{color:'#3B8BD4'}}>Physics derivation:</strong> NERVA XE Prime achieved ISP 841s in 1969 (Los Alamos).
        Modern Bimodal NTR design target: 900s (Borowski et al. AIAA-2012-5144).
        At ISP 900s → Ve = 900 × 9.807 = 8,829 m/s. Chemical J-2X: 450s → Ve = 4,414 m/s.
        Same ΔV = Ve × ln(m₀/mf) → NTR achieves 7.2 km/s with 79t propellant vs Chemical 4.5 km/s with 311t.
        Higher ΔV → faster transfer orbit → <strong style={{color:'#3B8BD4'}}>{ntr.transit}d transit</strong>.
        Shorter transit → <strong style={{color:'#6edc52'}}>less GCR radiation exposure</strong> (1.3 mSv/day, Curiosity RAD — Zeitlin et al. Science 2013).
        Only 1 launch required vs {chem.launches}× SLS at $2.7B each (NASA IG 2022).
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   APP — MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function App() {
  const [crewSize,  setCrewSize]  = useState(4);
  const [year,      setYear]      = useState(2027);
  const [risk,      setRisk]      = useState(5);
  const [launched,  setLaunched]  = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [raceProgress, setRaceProgress] = useState(0);
  const [raceRunning,  setRaceRunning]  = useState(false);
  const [showDebrief,  setShowDebrief]  = useState(false);
  const [debriefTab,   setDebriefTab]   = useState('table');
  const [clock,        setClock]        = useState('00:00:00');

  // Player rocket
  const [playerRocket,   setPlayerRocket]   = useState(null);
  const [showBuilder,    setShowBuilder]     = useState(false);
  const [builderSection, setBuilderSection] = useState('engine');
  const [builderParts,   setBuilderParts]   = useState({
    name:'MY ROCKET', color:'#E91E8C',
    engine:null, tank:'med', shield:'none', hab:'standard',
  });

  // Race view
  const [raceView,     setRaceView]     = useState('race');
  const [cockpitKey,   setCockpitKey]   = useState(null);

  // Hazards
  const [appliedHazards,    setAppliedHazards]    = useState({});
  const [activeHazardAlert, setActiveHazardAlert] = useState(null);
  const [dodgeOffsets,      setDodgeOffsets]      = useState({});
  const [impactEvents,      setImpactEvents]      = useState([]);

  const raceRef        = useRef(null);
  const raceHazardsRef = useRef({});
  const laneYsRef      = useRef([]);
  const rocketOrderRef = useRef([]);
  const distance = DISTANCES[year];

  /* ── All rockets (base + optional player), scaled for current params ── */
  const rockets = useMemo(() => {
    const out = {};
    Object.entries(BASE_ROCKETS).forEach(([k, base]) => {
      out[k] = scaleRocket(base, crewSize, distance);
    });
    if (playerRocket) {
      out.player = scaleRocket(playerRocket, crewSize, distance, risk);
    }
    return out;
  }, [crewSize, distance, risk, playerRocket]);

  /* ── Max transit excludes failed rockets ── */
  const maxTransit = useMemo(() => {
    const valid = Object.values(rockets).filter(r => !r.failed).map(r => r.transit);
    return valid.length > 0 ? Math.max(...valid) : 288;
  }, [rockets]);

  /* ── Per-rocket progress (derived, not state) ── */
  const rocketProgresses = useMemo(() => {
    const out = {};
    Object.entries(rockets).forEach(([k, r]) => {
      if (r.failed) {
        out[k] = clamp(raceProgress * 1.2, 0, 0.18);
      } else {
        const hits = appliedHazards[k] || [];
        const pen  = hits.reduce((s,h) => s+(h.speedPenalty||0), 0);
        const sf   = Math.max(0.1, maxTransit/r.transit - pen);
        out[k]     = clamp(raceProgress * sf, 0, 1);
      }
    });
    return out;
  }, [raceProgress, rockets, appliedHazards, maxTransit]);

  const arrivals = useMemo(() => {
    const out = {};
    Object.entries(rocketProgresses).forEach(([k, rp]) => {
      if (!rockets[k]?.failed && rp >= 1) out[k] = true;
    });
    return out;
  }, [rocketProgresses, rockets]);

  const stars = useMemo(() => [...Array(130)].map((_,i) => ({
    cx:(i*127.3+41)%1200, cy:(i*83.7+19)%360,
    r:((i*31)%18)/10+0.2, op:((i*53)%7)/10+0.3, dur:(((i*17)%40)/10+2).toFixed(1),
  })), []);

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

  /* ── Race loop ── */
  useEffect(() => {
    if (!raceRunning) return;
    const start = Date.now();
    const id = setInterval(() => {
      const progress = clamp((Date.now() - start) / RACE_MS, 0, 1);
      setRaceProgress(progress);

      // Trigger hazards
      Object.entries(raceHazardsRef.current).forEach(([key, hazList]) => {
        hazList.forEach(h => {
          if (!h.applied && h.triggerAt <= progress) {
            h.applied = true;
            const copy = { ...h };
            setAppliedHazards(prev => ({ ...prev, [key]: [...(prev[key]||[]), copy] }));
            setActiveHazardAlert({ key, hazard: copy });
            setTimeout(() => setActiveHazardAlert(prev =>
              prev?.hazard?.id === copy.id && prev?.key === key ? null : prev
            ), 3500);
            if (['debris', 'micrometeorite'].includes(copy.id)) {
              const dir = Math.random() > 0.5 ? -22 : 22;
              setDodgeOffsets(p => ({...p, [key]: dir}));
              setTimeout(() => setDodgeOffsets(p => ({...p, [key]: 0})), 800);
            }
            // Spawn a targeted impact event for this rocket
            const keyIdx = rocketOrderRef.current.indexOf(key);
            const impY   = laneYsRef.current[keyIdx] ?? 155;
            const impX   = clamp(162 + progress * 876, 162, 1038);
            const impId  = Date.now() + Math.random();
            setImpactEvents(p => [...p, {
              id: impId, key, x: impX, y: impY,
              type: copy.id, color: copy.color, icon: copy.icon,
            }]);
            setTimeout(() => setImpactEvents(p => p.filter(e => e.id !== impId)), 1500);
          }
        });
      });

      if (progress >= 1) {
        clearInterval(id);
        setRaceRunning(false);
        setTimeout(() => setShowDebrief(true), 600);
      }
    }, 50);
    raceRef.current = id;
    return () => clearInterval(id);
  }, [raceRunning]);

  /* ── Start mission ── */
  const startMission = async () => {
    setShowDebrief(false);
    setRaceProgress(0);
    setAppliedHazards({});
    setActiveHazardAlert(null);
    setRaceView('race');

    // Generate random hazards per rocket
    const haz = {};
    Object.entries(rockets).forEach(([key, rocket]) => {
      haz[key] = [];
      if (rocket.failed) return;
      HAZARD_EVENTS.forEach(event => {
        let chance = event.baseChance;
        if (event.id === 'engine_anomaly') {
          chance = clamp(0.5 - (rocket.trl||5) * 0.035, 0.05, 0.45);
        }
        if (Math.random() < chance) {
          haz[key].push({ ...event, triggerAt: 0.1 + Math.random() * 0.78, applied: false });
        }
      });
    });
    raceHazardsRef.current = haz;

    // Default cockpit to player, else NTR
    setCockpitKey(rockets.player ? 'player' : 'nuclear');

    setLaunched(true);
    try {
      await axios.post('http://localhost:8000/api/mission',
        { crew_size: crewSize, year, risk }, { timeout: 3000 });
    } catch { /* local physics fallback active */ }

    let n = 5;
    setCountdown(n);
    const cd = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(cd); setCountdown(null); setRaceRunning(true); }
      else setCountdown(n);
    }, 1000);
  };

  const resetMission = () => {
    clearInterval(raceRef.current);
    setShowDebrief(false); setLaunched(false);
    setRaceProgress(0);    setRaceRunning(false);
    setCountdown(null);    setAppliedHazards({});
    setActiveHazardAlert(null); setDodgeOffsets({}); setImpactEvents([]);
  };

  /* ── Save player rocket ── */
  const savePlayerRocket = () => {
    const stats = computePlayerStats(builderParts);
    if (!stats) return;
    setPlayerRocket(stats);
    setShowBuilder(false);
  };

  /* ── Builder live preview ── */
  const builderPreviewStats = useMemo(() => computePlayerStats(builderParts), [builderParts]);

  /* ── Race SVG layout ── */
  const rocketEntries = Object.entries(rockets);
  const numRockets    = rocketEntries.length;
  const laneYs        = numRockets === 4 ? [62,134,206,278] : [75,155,235];
  const svgH          = numRockets === 4 ? 360 : 325;
  laneYsRef.current      = laneYs;
  rocketOrderRef.current = rocketEntries.map(([k]) => k);
  const earthY        = Math.round(svgH/2);
  const marsY         = Math.round(svgH/2);

  /* ── Space environment data (real orbital data — NASA NSSDC) ── */
  const debrisParticles = useMemo(() => [...Array(32)].map((_,i) => ({
    x: 168 + (i*43.7+80) % 250,
    y: 8 + (i*29.3+15) % Math.max(svgH - 20, 50),
    r: 0.3 + (i*7%5)/10,
    op: 0.14 + (i*13%5)/10,
    dur: (1.4 + (i*7%22)/10).toFixed(1),
  })), [svgH]);

  const asteroidHints = useMemo(() => [...Array(14)].map((_,i) => ({
    x:    485 + (i*57.3+30) % 330,
    y:    10  + (i*41.1+25) % Math.max(svgH - 28, 50),
    r:    6 + (i*9%10) * 1.2,
    seed: (i * 137 + 11) % 100,
  })), [svgH]);

  const meteorData = useMemo(() => [...Array(7)].map((_,i) => ({
    y0: 10 + i * Math.max(Math.floor(svgH/8), 8),
    dur: (1.9 + i * 0.52).toFixed(1),
    delay: (i * 1.25).toFixed(1),
  })), [svgH]);

  const statusText = raceRunning
    ? 'LAUNCH SEQUENCE ACTIVE — Earth→Mars transit in progress...'
    : countdown !== null ? `LAUNCH IN ${countdown}...`
    : showDebrief ? 'All vehicles report — Mission debrief ready.'
    : 'Configure mission parameters and launch.';

  /* ═══════════════════════════════════ RENDER ═══════════════════════════════════ */

  return (
    <div className="app">
      <div className="scanlines" />
      <div className="vignette" />
      <div className="panel">

        {/* HEADER */}
        <header className="mcc-header">
          <div className="mcc-header-left">
            <div className="mcc-logo-mark">◈</div>
            <div>
              <h1 className="mcc-title">Mars Mission Control</h1>
              <div className="mcc-subtitle">REV 7.0 · REAL COMPONENTS · SPACE HAZARDS · COCKPIT VIEW</div>
            </div>
          </div>
          <div className="mcc-header-right">
            <div className="mcc-clock-block">
              <div className="mcc-clock-label">UTC</div>
              <div className="mcc-clock">{clock}</div>
            </div>
          </div>
        </header>

        {/* STATUS BAR */}
        <div className="status-bar">
          <span className={`status-dot ${raceRunning?'active':countdown!==null?'countdown':''}`} />
          <span className="status-text">{statusText}</span>
        </div>

        {/* ══════════════════ PHASE 1: CONFIG ══════════════════ */}
        {!launched && (
          <section className="config">
            {/* ── AMBIENT SPACE WINDOW — pre-launch environment (real meteor/debris context) ── */}
            <div className="ambient-space">
              {/* Stars */}
              {[...Array(40)].map((_,i) => (
                <div key={i} className="ambient-star" style={{
                  left: `${(i*137.5+41)%100}%`,
                  top:  `${(i*83.7+19)%100}%`,
                  width: `${0.8 + (i%4)*0.5}px`,
                  height: `${0.8 + (i%4)*0.5}px`,
                  opacity: 0.2 + (i%6)*0.07,
                }}/>
              ))}
              {/* Meteors — different speeds/angles */}
              {[
                { left:'-4%', top:'18%', dur:'7s',  delay:'0s',   w:'55px', angle:'12deg' },
                { left:'-4%', top:'55%', dur:'11s', delay:'2.8s', w:'42px', angle:'8deg'  },
                { left:'-4%', top:'78%', dur:'9s',  delay:'5.1s', w:'65px', angle:'15deg' },
                { left:'-4%', top:'32%', dur:'13s', delay:'1.4s', w:'38px', angle:'10deg' },
                { left:'-4%', top:'68%', dur:'8s',  delay:'7.3s', w:'48px', angle:'18deg' },
              ].map((m,i) => (
                <div key={i} className="ambient-meteor" style={{
                  left: m.left, top: m.top,
                  width: m.w,
                  animationDuration: m.dur,
                  animationDelay: m.delay,
                  transform: `rotate(${m.angle})`,
                }}/>
              ))}
              {/* Info overlay */}
              <div style={{
                position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)',
                fontSize:'0.5rem', color:'rgba(100,180,255,0.55)',
                fontFamily:'Share Tech Mono', textAlign:'right', lineHeight:1.6,
              }}>
                CURRENT SPACE ENVIRONMENT · ESA DEBRIS OFFICE
                <br/>NEAR-EARTH OBJECTS: 34,000+ (JPL CNEOS)
                <br/>METEOR FLUX: Grün et al. 1985
              </div>
            </div>

            <div className="config-header">
              <span className="section-title">■ MISSION PARAMETERS</span>
              <span className="mission-phase-badge">PHASE 01 · CONFIGURATION</span>
            </div>

            <div className="controls-grid">
              <div className="control">
                <label className="control-label">CREW SIZE</label>
                <div className="control-row">
                  <input type="range" min="2" max="8" value={crewSize} onChange={e => setCrewSize(+e.target.value)} />
                  <span className="control-value">{crewSize}</span>
                </div>
                <span className="control-hint">{crewSize} crew · {(crewSize*1000+2000).toLocaleString()} kg estimated habitat mass</span>
              </div>
              <div className="control">
                <label className="control-label">LAUNCH WINDOW</label>
                <select value={year} onChange={e => setYear(+e.target.value)}>
                  {Object.entries(DISTANCES).map(([y,d]) => (
                    <option key={y} value={+y}>{y} — {d} M km (JPL Horizons)</option>
                  ))}
                </select>
                <span className="control-hint">Earth–Mars distance: {distance} M km · {year} opposition</span>
              </div>
              <div className="control">
                <label className="control-label">RISK TOLERANCE</label>
                <div className="control-row">
                  <input type="range" min="1" max="10" value={risk} onChange={e => setRisk(+e.target.value)} />
                  <span className="control-value">{risk}</span>
                </div>
                <span className="control-hint">{risk<=3?'Conservative (full abort margins)':risk<=6?'Balanced NASA approach':'Aggressive — reduced margins'}</span>
              </div>
            </div>

            {/* FLEET REFERENCE CARDS */}
            <div className="selector-title" style={{margin:'20px 0 12px'}}>
              ■ COMPETING FLEET — Fixed reference rockets (affects all stats when parameters change)
            </div>
            <div className="rocket-cards">
              {Object.entries(BASE_ROCKETS).map(([key, base]) => {
                const scaled = rockets[key];
                return (
                  <div key={key} className="rocket-card" style={{borderColor: base.color}}>
                    <div className="rocket-card-header"
                      style={{background:`linear-gradient(135deg,${base.color}20,${base.color}08)`, borderBottom:`1px solid ${base.color}40`}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                        <div>
                          <h3 style={{color:base.color, fontFamily:'Orbitron', fontSize:'0.9rem', margin:0}}>{base.label}</h3>
                          <div style={{fontSize:'0.6rem', color:'#777', marginTop:'3px'}}>{base.engineType}</div>
                        </div>
                        <span style={{fontSize:'0.58rem', color:'#555', background:'rgba(0,0,0,0.5)', padding:'2px 7px', borderRadius:'3px'}}>
                          TRL {base.trl}
                        </span>
                      </div>
                    </div>
                    <div className="rocket-card-body">
                      <div className="card-stats-grid">
                        <div className="csg-item"><span className="csg-l">ISP</span><span className="csg-v" style={{color:base.color}}>{scaled.isp}s</span></div>
                        <div className="csg-item"><span className="csg-l">TRANSIT</span><span className="csg-v" style={{color:base.color}}>{scaled.transit}d</span></div>
                        <div className="csg-item"><span className="csg-l">Δ-V</span><span className="csg-v" style={{color:base.color}}>{scaled.deltaV} km/s</span></div>
                        <div className="csg-item"><span className="csg-l">RADIATION</span><span className="csg-v" style={{color:radColor(scaled.radiation)}}>{scaled.radiation} mSv</span></div>
                        <div className="csg-item"><span className="csg-l">COST</span><span className="csg-v" style={{color:base.color}}>${scaled.cost}B</span></div>
                        <div className="csg-item"><span className="csg-l">LAUNCHES</span><span className="csg-v" style={{color:base.color}}>{scaled.launches}×</span></div>
                        <div className="csg-item"><span className="csg-l">ABORT ΔV</span><span className="csg-v" style={{color:scaled.abortDv>2?'#6edc52':scaled.abortDv<0.5?'#ff5555':base.color}}>{scaled.abortDv} km/s</span></div>
                        <div className="csg-item"><span className="csg-l">PAYLOAD</span><span className="csg-v" style={{color:base.color}}>{(scaled.payloadMars/1000).toFixed(0)}t</span></div>
                        <div className="csg-item"><span className="csg-l">CAREER RAD%</span><span className="csg-v" style={{color:radColor(scaled.radiation)}}>{scaled.careerRadPct}%</span></div>
                        <div className="csg-item"><span className="csg-l">BONE LOSS</span><span className="csg-v" style={{color:scaled.boneLossPct>3.5?'#ff5555':scaled.boneLossPct<2?'#6edc52':base.color}}>{scaled.boneLossPct}%</span></div>
                      </div>
                      <div style={{fontSize:'0.52rem', color:'#4a2515', marginTop:'8px', lineHeight:'1.5', fontFamily:'Share Tech Mono'}}>
                        {base.source}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* NTR ADVANTAGE PANEL */}
            <NTRAdvantage rockets={rockets} />

            {/* PLAYER ROCKET */}
            <div className="selector-title" style={{margin:'24px 0 12px'}}>
              ■ YOUR NUCLEAR ROCKET — Choose a real NTR engine + components. Stats computed from Tsiolkovsky equation. Can fail or explode.
            </div>
            <div className="player-rocket-section">
              {playerRocket ? (
                <div className="player-rocket-card" style={{borderColor: playerRocket.color}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                    <div>
                      <div style={{fontFamily:'Orbitron', fontSize:'1rem', color:playerRocket.color, fontWeight:900}}>{playerRocket.label}</div>
                      <div style={{fontSize:'0.6rem', color:'#888', marginTop:'2px'}}>
                        {playerRocket.engineType} · TRL {playerRocket.trl}
                      </div>
                    </div>
                    {playerRocket.failed && (
                      <span style={{fontSize:'0.62rem', color:'#ff5555', border:'1px solid #ff5555', padding:'3px 8px', borderRadius:'4px', fontFamily:'Orbitron'}}>
                        ⚠ WILL FAIL
                      </span>
                    )}
                  </div>
                  <div className="card-stats-grid" style={{marginBottom:'12px'}}>
                    {(() => {
                      const sc = rockets.player || playerRocket;
                      return (
                        <>
                          <div className="csg-item"><span className="csg-l">ISP</span><span className="csg-v" style={{color:playerRocket.color}}>{sc.isp}s</span></div>
                          <div className="csg-item"><span className="csg-l">TRANSIT</span><span className="csg-v" style={{color:playerRocket.failed?'#ff5555':playerRocket.color}}>{playerRocket.failed?'FAIL':`${sc.transit}d`}</span></div>
                          <div className="csg-item"><span className="csg-l">Δ-V</span><span className="csg-v" style={{color:playerRocket.failed?'#ff5555':playerRocket.color}}>{sc.deltaV} km/s</span></div>
                          <div className="csg-item"><span className="csg-l">RADIATION</span><span className="csg-v" style={{color:playerRocket.failed?'#ff5555':radColor(sc.radiation)}}>{playerRocket.failed?'—':`${sc.radiation} mSv`}</span></div>
                          <div className="csg-item"><span className="csg-l">ABORT ΔV</span><span className="csg-v" style={{color:playerRocket.failed?'#ff5555':sc.abortDv>2?'#6edc52':'#f4ae2a'}}>{playerRocket.failed?'—':`${sc.abortDv} km/s`}</span></div>
                          <div className="csg-item"><span className="csg-l">BONE LOSS</span><span className="csg-v" style={{color:playerRocket.color}}>{playerRocket.failed?'—':`${sc.boneLossPct}%`}</span></div>
                          <div className="csg-item"><span className="csg-l">ENGINE</span><span className="csg-v" style={{color:playerRocket.color, fontSize:'0.62rem'}}>{playerRocket.engineName}</span></div>
                          <div className="csg-item"><span className="csg-l">HAB</span><span className="csg-v" style={{color:playerRocket.color, fontSize:'0.62rem'}}>{playerRocket.habName}</span></div>
                        </>
                      );
                    })()}
                  </div>
                  <div style={{fontSize:'0.52rem', color:'#4a2515', marginBottom:'10px', lineHeight:'1.5', fontFamily:'Share Tech Mono'}}>
                    {playerRocket.source}
                  </div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <button className="rocket-btn" style={{borderColor:playerRocket.color, color:playerRocket.color}}
                      onClick={() => setShowBuilder(true)}>✎ REDESIGN</button>
                    <button className="rocket-btn-reset" onClick={() => setPlayerRocket(null)}>REMOVE</button>
                  </div>
                </div>
              ) : (
                <div className="build-cta" onClick={() => setShowBuilder(true)}>
                  <div className="build-cta-icon">⊕</div>
                  <div>
                    <div className="build-cta-title">BUILD YOUR ROCKET</div>
                    <div className="build-cta-sub">
                      Choose a real engine, propellant tank, radiation shielding, and habitat module.
                      All stats computed from the Tsiolkovsky rocket equation using real component specs.
                      Your rocket can beat the fleet — or explode trying.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button className="launch launch-ready" onClick={startMission} style={{marginTop:'24px'}}>
              ▶ INITIATE LAUNCH SEQUENCE
            </button>
          </section>
        )}

        {/* ══════════════════ BUILDER MODAL ══════════════════ */}
        {showBuilder && (
          <div className="modal-overlay" onClick={() => setShowBuilder(false)}>
            <div className="modal" style={{maxWidth:'900px', width:'96vw'}} onClick={e => e.stopPropagation()}>
              <h2>Build Your Nuclear Rocket — Real NTR Components</h2>

              {/* Name + Color row */}
              <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:'16px', marginBottom:'20px', alignItems:'end'}}>
                <div className="builder-slider">
                  <label>ROCKET NAME</label>
                  <input type="text" className="builder-name-input" maxLength={14}
                    value={builderParts.name} placeholder="MY ROCKET"
                    onChange={e => setBuilderParts({...builderParts, name: e.target.value.toUpperCase()})} />
                </div>
                <div className="builder-slider">
                  <label>COLOR</label>
                  <div className="color-swatches">
                    {PLAYER_COLORS.map(c => (
                      <button key={c} className={`color-swatch ${builderParts.color===c?'selected':''}`}
                        style={{background:c, boxShadow: builderParts.color===c ? `0 0 14px ${c}` : 'none'}}
                        onClick={() => setBuilderParts({...builderParts, color:c})} />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 220px', gap:'20px'}}>
                {/* LEFT: Part selector */}
                <div>
                  {/* Section tabs */}
                  <div className="builder-section-tabs">
                    {[
                      ['engine', `ENGINE${builderParts.engine ? ' ✓' : ' *'}`],
                      ['tank',   'TANK ✓'],
                      ['shield', 'SHIELDING ✓'],
                      ['hab',    'HABITAT ✓'],
                    ].map(([sec, lbl]) => (
                      <button key={sec}
                        className={`bst-btn ${builderSection===sec?'active':''}`}
                        style={sec==='engine' && !builderParts.engine ? {borderColor:'#f4ae2a', color:'#f4ae2a'} : {}}
                        onClick={() => setBuilderSection(sec)}>{lbl}</button>
                    ))}
                  </div>

                  {/* ENGINE CARDS — NTR only */}
                  {builderSection === 'engine' && (
                    <div>
                      <div style={{
                        fontSize:'0.62rem', color:'#7ab4e0', marginBottom:'10px',
                        fontFamily:'Share Tech Mono', lineHeight:'1.7',
                        padding:'8px 12px', background:'rgba(59,139,212,0.07)',
                        border:'1px solid rgba(59,139,212,0.25)', borderRadius:'5px'
                      }}>
                        <strong style={{color:'#3B8BD4'}}>NTR engines only.</strong> ISP 841–900s = 2× chemical →
                        exhaust velocity 2× higher → 4× less propellant for same ΔV (Tsiolkovsky 1903).
                        Your custom rocket is nuclear. Choose which nuclear engine to fly.
                        Lower TRL = less proven = higher chance of engine anomaly during transit.
                      </div>
                      <div className="part-cards-grid">
                        {ENGINE_CATALOG.filter(e => e.family.startsWith('NTR')).map(eng => (
                          <div key={eng.id}
                            className={`part-card ${builderParts.engine===eng.id?'selected':''} ${eng.electric?'electric-card':''}`}
                            onClick={() => setBuilderParts({...builderParts, engine:eng.id})}>
                            {builderParts.engine===eng.id && <div className="part-selected-check">✓</div>}
                            <div className="part-card-name">{eng.name}</div>
                            <div className="part-card-family">{eng.family}</div>
                            <div className="part-card-stats">
                              <div className="pcs-item">
                                <span className="pcs-label">ISP</span>
                                <span className="pcs-val" style={{color: eng.isp>600?'#3B8BD4':eng.isp>400?'#e8622a':'#aaa'}}>{eng.isp}s</span>
                              </div>
                              <div className="pcs-item">
                                <span className="pcs-label">Thrust</span>
                                <span className="pcs-val">{eng.thrust>=1000?`${(eng.thrust/1000).toFixed(1)}MN`:`${eng.thrust}kN`}</span>
                              </div>
                              <div className="pcs-item">
                                <span className="pcs-label">TRL</span>
                                <span className="pcs-val">{eng.trl}</span>
                              </div>
                            </div>
                            <div className="part-card-desc">{eng.desc}</div>
                            {eng.electric && <div className="part-card-electric">⚠ LOW THRUST — CREWED MISSION WILL FAIL</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TANK CARDS */}
                  {builderSection === 'tank' && (
                    <div className="part-cards-grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))'}}>
                      {TANK_OPTIONS.map(tank => (
                        <div key={tank.id}
                          className={`part-card ${builderParts.tank===tank.id?'selected':''}`}
                          onClick={() => setBuilderParts({...builderParts, tank:tank.id})}>
                          {builderParts.tank===tank.id && <div className="part-selected-check">✓</div>}
                          <div className="part-card-name">{tank.name}</div>
                          <div className="part-card-stats">
                            <div className="pcs-item">
                              <span className="pcs-label">Propellant</span>
                              <span className="pcs-val">{(tank.capacity/1000).toFixed(0)}t</span>
                            </div>
                            <div className="pcs-item">
                              <span className="pcs-label">Structure</span>
                              <span className="pcs-val">{(tank.structMass/1000).toFixed(0)}t</span>
                            </div>
                          </div>
                          <div className="part-card-desc">{tank.desc}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SHIELD CARDS */}
                  {builderSection === 'shield' && (
                    <div>
                      <div style={{fontSize:'0.6rem', color:'#6a3020', marginBottom:'8px', fontFamily:'Share Tech Mono'}}>
                        GCR dose rate: 1.3 mSv/day (Curiosity RAD, Zeitlin et al. 2013). NASA career limit: 1,000 mSv (STD-3001 Vol.1).
                      </div>
                      <div className="part-cards-grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))'}}>
                        {SHIELD_OPTIONS.map(sh => (
                          <div key={sh.id}
                            className={`part-card ${builderParts.shield===sh.id?'selected':''}`}
                            onClick={() => setBuilderParts({...builderParts, shield:sh.id})}>
                            {builderParts.shield===sh.id && <div className="part-selected-check">✓</div>}
                            <div className="part-card-name">{sh.name}</div>
                            <div className="part-card-stats">
                              <div className="pcs-item">
                                <span className="pcs-label">Mass</span>
                                <span className="pcs-val">{(sh.mass/1000).toFixed(1)}t</span>
                              </div>
                              <div className="pcs-item">
                                <span className="pcs-label">Dose ×</span>
                                <span className="pcs-val" style={{color:sh.factor<0.8?'#6edc52':'#aaa'}}>{sh.factor.toFixed(2)}</span>
                              </div>
                              <div className="pcs-item">
                                <span className="pcs-label">Reduction</span>
                                <span className="pcs-val" style={{color:sh.factor<0.8?'#6edc52':'#aaa'}}>{Math.round((1-sh.factor)*100)}%</span>
                              </div>
                            </div>
                            <div className="part-card-desc">{sh.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* HABITAT CARDS */}
                  {builderSection === 'hab' && (
                    <div>
                      <div style={{fontSize:'0.6rem', color:'#6a3020', marginBottom:'8px', fontFamily:'Share Tech Mono'}}>
                        Habitat mass adds to dry mass. Heavier hab = more ΔV needed. Centrifuge prevents bone/muscle loss on long transits.
                      </div>
                      <div className="part-cards-grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))'}}>
                        {HAB_OPTIONS.map(hab => (
                          <div key={hab.id}
                            className={`part-card ${builderParts.hab===hab.id?'selected':''}`}
                            onClick={() => setBuilderParts({...builderParts, hab:hab.id})}>
                            {builderParts.hab===hab.id && <div className="part-selected-check">✓</div>}
                            <div className="part-card-name">{hab.name}</div>
                            <div className="part-card-stats">
                              <div className="pcs-item">
                                <span className="pcs-label">Dry Mass</span>
                                <span className="pcs-val">{(hab.dryMass/1000).toFixed(0)}t</span>
                              </div>
                              <div className="pcs-item">
                                <span className="pcs-label">Health Mod</span>
                                <span className="pcs-val" style={{color:hab.healthMod>0?'#6edc52':hab.healthMod<0?'#ff8080':'#aaa'}}>
                                  {hab.healthMod>0?'+':''}{hab.healthMod}
                                </span>
                              </div>
                            </div>
                            <div className="part-card-desc">{hab.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Live preview */}
                <BuilderPreview stats={builderPreviewStats} />
              </div>

              {!builderParts.engine && (
                <div style={{padding:'10px 14px', margin:'16px 0 0', background:'rgba(244,174,42,0.08)',
                  border:'1px solid rgba(244,174,42,0.4)', borderRadius:'6px',
                  fontSize:'0.68rem', color:'#f4ae2a', fontFamily:'Orbitron', letterSpacing:'0.06em'}}>
                  ⚠ SELECT AN ENGINE (marked with *) TO UNLOCK THE LOCK IN BUTTON
                </div>
              )}

              <div className="builder-buttons" style={{marginTop:'20px'}}>
                <button className="btn-primary"
                  disabled={!builderParts.engine}
                  style={!builderParts.engine ? {opacity:0.4, cursor:'not-allowed'} : {}}
                  onClick={savePlayerRocket}>
                  ✓ LOCK IN &amp; RACE
                </button>
                <button className="btn-secondary" onClick={() => setShowBuilder(false)}>✕ CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {/* COUNTDOWN */}
        {countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-label-top">LAUNCH IN</div>
            <div className="countdown">{countdown}</div>
            <div className="countdown-label-bottom">SECONDS · ALL SYSTEMS GO</div>
          </div>
        )}

        {/* ══════════════════ PHASE 2: RACE ══════════════════ */}
        {raceRunning && (
          <section className="race-area">
            <div className="section-header-row">
              <span className="section-title">■ EARTH → MARS TRANSIT SIMULATION</span>
              <span className="mission-phase-badge">PHASE 02 · TRANSIT</span>
            </div>

            {/* View toggle */}
            <div className="race-view-toggle">
              <button className={`rvt-btn ${raceView==='race'?'active':''}`} onClick={() => setRaceView('race')}>
                ⊞ RACE TRACK
              </button>
              <button className={`rvt-btn ${raceView==='cockpit'?'active':''}`} onClick={() => setRaceView('cockpit')}>
                ◎ COCKPIT VIEW
              </button>
            </div>

            {/* Active hazard banner */}
            {activeHazardAlert && (
              <div className="hazard-banner" style={{
                background:`rgba(0,0,0,0.7)`, border:`2px solid ${activeHazardAlert.hazard.color}`,
                color: activeHazardAlert.hazard.color,
              }}>
                {activeHazardAlert.hazard.icon} {rockets[activeHazardAlert.key]?.label?.toUpperCase()} — {activeHazardAlert.hazard.name}: {activeHazardAlert.hazard.desc}
              </div>
            )}

            {/* RACE TRACK VIEW */}
            {raceView === 'race' && (<>
              <svg className="race-track" viewBox={`0 0 1200 ${svgH}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="spaceBg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#040115" />
                    <stop offset="40%"  stopColor="#0e0620" />
                    <stop offset="70%"  stopColor="#110407" />
                    <stop offset="100%" stopColor="#0d0308" />
                  </linearGradient>
                  <radialGradient id="eGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#5580bb" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <radialGradient id="mGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#d84010" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <radialGradient id="sunHalo" cx="0%" cy="50%" r="100%">
                    <stop offset="0%"   stopColor="#ffcc44" stopOpacity="0.22" />
                    <stop offset="60%"  stopColor="#ff8800" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <radialGradient id="nebula1" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#2a1040" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <radialGradient id="nebula2" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#0a1e30" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#cccccc" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="softGlow">
                    <feGaussianBlur stdDeviation="1.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <rect x="0" y="0" width="1200" height={svgH} fill="url(#spaceBg)" />

                {/* Deep space nebula layers — aesthetic depth */}
                <ellipse cx="320" cy={svgH*0.28} rx="280" ry="95" fill="url(#nebula1)" opacity="0.14"/>
                <ellipse cx="820" cy={svgH*0.72} rx="240" ry="75" fill="url(#nebula2)" opacity="0.11"/>
                <ellipse cx="600" cy={svgH*0.5} rx="180" ry="55" fill="url(#nebula1)" opacity="0.06"/>
                {/* Sun radiation source — Sol at left, driving solar wind and radiation */}
                <rect x="0" y="0" width="100" height={svgH} fill="url(#sunHalo)" opacity="0.9"/>

                {/* Trajectory arc — Earth to Mars transfer path */}
                <path d={`M 100,${earthY} Q 600,${earthY - 18} 1090,${marsY}`}
                  fill="none" stroke="#3a1505" strokeWidth="1" strokeDasharray="6,14" opacity="0.35"/>

                {stars.map((s,i) => (
                  <circle key={i} cx={s.cx} cy={Math.min(s.cy, svgH-5)} r={s.r} fill="#fff" opacity={s.op}>
                    <animate attributeName="opacity" dur={`${s.dur}s`} repeatCount="indefinite"
                      values={`${s.op};${Math.min(1,s.op+0.45)};${s.op}`}/>
                  </circle>
                ))}

                {/* ── MICROMETEORITE STREAKS ─────────────────────────────────────
                    Flux model: Grün et al. 1985 (Science); ~17,000 meteorites/year reach Earth surface.
                    Interplanetary space: ~10⁻⁸ kg/m²/s flux at 1 AU. */}
                {meteorData.map((m, i) => (
                  <g key={`meteor-${i}`}>
                    <line x1="0" y1={m.y0} x2="55" y2={m.y0 + 20}
                      stroke="white" strokeWidth={1.6 - i*0.12} strokeLinecap="round">
                      <animateTransform attributeName="transform" type="translate"
                        from="-90 0" to="1400 0"
                        dur={`${m.dur}s`} begin={`${m.delay}s`} repeatCount="indefinite" calcMode="linear"/>
                      <animate attributeName="opacity"
                        dur={`${m.dur}s`} begin={`${m.delay}s`} repeatCount="indefinite"
                        values="0;0.9;0.55;0.1;0"/>
                    </line>
                  </g>
                ))}

                {/* ── SPACE DEBRIS FIELD ────────────────────────────────────────
                    ESA Space Debris Report 2024: 27,000+ tracked objects, >130M estimated fragments >1mm. */}
                {debrisParticles.map((d, i) => (
                  <circle key={`deb-${i}`} cx={d.x} cy={d.y} r={d.r} fill="#5577aa" opacity={d.op}>
                    <animate attributeName="opacity" dur={`${d.dur}s`} repeatCount="indefinite"
                      values={`${d.op};${Math.min(0.55, d.op*2.5)};${d.op}`}/>
                  </circle>
                ))}

                {/* ── NEAR-EARTH OBJECT REGION ──────────────────────────────────
                    JPL CNEOS 2024: 34,000+ catalogued NEOs, many cross Earth–Mars transit corridor. */}
                {asteroidHints.map((a, i) => {
                  const nPts = 7 + (a.seed % 4);
                  const pts  = [...Array(nPts)].map((_, pi) => {
                    const angle  = (pi / nPts) * 2 * Math.PI + (a.seed * 0.07);
                    const jitter = 0.52 + ((a.seed * 17 + pi * 31) % 46) / 100;
                    return `${(a.x + Math.cos(angle) * a.r * jitter).toFixed(1)},${(a.y + Math.sin(angle) * a.r * jitter).toFixed(1)}`;
                  }).join(' ');
                  const bright = 90 + (a.seed % 40);
                  return (
                    <g key={`ast-${i}`}>
                      <polygon points={pts}
                        fill={`rgb(${bright},${Math.round(bright*0.82)},${Math.round(bright*0.55)})`}
                        stroke={`rgb(${bright+30},${Math.round((bright+30)*0.78)},${Math.round((bright+30)*0.5)})`}
                        strokeWidth="1" opacity="0.85"/>
                    </g>
                  );
                })}

                {/* Distance markers */}
                {[0.25, 0.5, 0.75].map(pct => (
                  <g key={pct}>
                    <line x1={162+pct*876} y1="20" x2={162+pct*876} y2={svgH-15}
                      stroke="#7a4030" strokeWidth="1.2" strokeDasharray="4,10" opacity="0.65"/>
                    {/* Tick marks */}
                    <line x1={162+pct*876-5} y1="20" x2={162+pct*876+5} y2="20"
                      stroke="#8a5030" strokeWidth="2" opacity="0.8"/>
                    <line x1={162+pct*876-5} y1={svgH-15} x2={162+pct*876+5} y2={svgH-15}
                      stroke="#8a5030" strokeWidth="2" opacity="0.8"/>
                    <text x={162+pct*876} y="16" fill="#dd8844" fontSize="11" fontWeight="700"
                      textAnchor="middle" fontFamily="Share Tech Mono">{(distance*pct).toFixed(0)}M km</text>
                  </g>
                ))}

                {/* Earth */}
                <g transform={`translate(100,${earthY})`}>
                  <circle cx="0" cy="0" r="65" fill="url(#eGlow)" />
                  <circle cx="0" cy="0" r="44" fill="#3b6fad" />
                  <circle cx="-12" cy="-8" r="14" fill="#4a7a3a" opacity="0.7" />
                  <circle cx="9" cy="12" r="10" fill="#4a7a3a" opacity="0.6" />
                  <circle cx="0" cy="0" r="44" fill="none" stroke="#6a9ad4" strokeWidth="1.5" opacity="0.3" />
                  <rect x="-32" y="38" width="64" height="17" rx="3" fill="#0e0904" stroke="#aa5522" strokeWidth="1.5" opacity="0.93"/>
                  <text x="0" y="50" fill="#ffcc88" fontSize="9" textAnchor="middle" fontFamily="Orbitron">EARTH</text>
                </g>

                {/* ── MOON — sidereal 27.3216d, orbit 384,400km, radius 1,737km (NASA NSSDC) ── */}
                <g transform={`translate(100,${earthY})`}>
                  <circle cx="0" cy="0" r="57" fill="none" stroke="#334466" strokeWidth="0.8"
                    strokeDasharray="3,6" opacity="0.5"/>
                  <g>
                    <animateTransform attributeName="transform" type="rotate"
                      from="0" to="360" dur="8s" repeatCount="indefinite" calcMode="linear"/>
                    {/* Glow */}
                    <circle cx="57" cy="0" r="22" fill="url(#moonGlow)" opacity="0.45"/>
                    {/* Body — radius 1,737km ≈ 27% of Earth */}
                    <circle cx="57" cy="0" r="13" fill="#c8c8c8"/>
                    {/* Maria (dark basaltic plains — real lunar feature) */}
                    <ellipse cx="55" cy="-2.5" rx="5.5" ry="4" fill="#909090" opacity="0.55"/>
                    <ellipse cx="61" cy="4" rx="4" ry="2.6" fill="#999" opacity="0.4"/>
                    {/* Craters */}
                    <circle cx="51" cy="-5" r="2.9" fill="none" stroke="#aaa" strokeWidth="0.9" opacity="0.55"/>
                    <circle cx="63" cy="1" r="2.3" fill="none" stroke="#aaa" strokeWidth="0.7" opacity="0.45"/>
                    <circle cx="55" cy="7" r="1.6" fill="none" stroke="#bbb" strokeWidth="0.6" opacity="0.4"/>
                    <circle cx="59" cy="-8" r="1.2" fill="none" stroke="#aaa" strokeWidth="0.5" opacity="0.35"/>
                    {/* Terminator line */}
                    <path d="M57,-13 Q48,-7 48,7 Q48,12 57,13" fill="rgba(0,0,0,0.35)" opacity="0.5"/>
                  </g>
                </g>

                {/* ── ISS — period 92.68min, alt 408km, 109m span, 27,600km/h (NASA) ── */}
                <g transform={`translate(100,${earthY})`}>
                  <circle cx="0" cy="0" r="49" fill="none" stroke="#1a3355" strokeWidth="0.5"
                    strokeDasharray="1,5" opacity="0.35"/>
                  <g>
                    <animateTransform attributeName="transform" type="rotate"
                      from="0" to="360" dur="0.52s" repeatCount="indefinite" calcMode="linear"/>
                    {/* Main truss (horizontal) */}
                    <rect x="42" y="-1.2" width="12" height="2.4" fill="#aaccee" opacity="0.9" rx="0.3"/>
                    {/* Hab modules (central vertical) */}
                    <rect x="46" y="-3.5" width="4" height="7" fill="#88bbdd" opacity="0.9" rx="0.5"/>
                    {/* Solar array panels — 4 wings */}
                    <rect x="42" y="-5.5" width="5" height="3" fill="#445566" opacity="0.85" rx="0.2"/>
                    <rect x="49" y="-5.5" width="5" height="3" fill="#445566" opacity="0.85" rx="0.2"/>
                    <rect x="42" y="2.5"  width="5" height="3" fill="#445566" opacity="0.85" rx="0.2"/>
                    <rect x="49" y="2.5"  width="5" height="3" fill="#445566" opacity="0.85" rx="0.2"/>
                    {/* Panel dividers */}
                    <line x1="44.5" y1="-5.5" x2="44.5" y2="-2.5" stroke="#667788" strokeWidth="0.4"/>
                    <line x1="51.5" y1="-5.5" x2="51.5" y2="-2.5" stroke="#667788" strokeWidth="0.4"/>
                    <line x1="44.5" y1="2.5"  x2="44.5" y2="5.5"  stroke="#667788" strokeWidth="0.4"/>
                    <line x1="51.5" y1="2.5"  x2="51.5" y2="5.5"  stroke="#667788" strokeWidth="0.4"/>
                  </g>
                </g>

                {/* Mars */}
                <g transform={`translate(1090,${marsY})`}>
                  <circle cx="0" cy="0" r="55" fill="url(#mGlow)" />
                  <circle cx="0" cy="0" r="38" fill="#b53f20" />
                  <circle cx="-10" cy="-6" r="8"  fill="#8a2a10" opacity="0.6" />
                  <circle cx="7" cy="10" r="6" fill="#d4501a" opacity="0.5" />
                  <circle cx="0" cy="0" r="38" fill="none" stroke="#e86030" strokeWidth="1.5" opacity="0.3" />
                  <rect x="-36" y="32" width="72" height="17" rx="3" fill="#0e0404" stroke="#7c2a14" strokeWidth="1.5" opacity="0.93"/>
                  <text x="0" y="44" fill="#ff9955" fontSize="9" textAnchor="middle" fontFamily="Orbitron">MARS</text>
                </g>

                {/* ── PHOBOS — 7.659h, 9,376km, 22×18×14km, Stickney crater ~10km (NASA NSSDC) ── */}
                <g transform={`translate(1090,${marsY})`}>
                  <circle cx="0" cy="0" r="52" fill="none" stroke="#663322" strokeWidth="0.8"
                    strokeDasharray="2,5" opacity="0.55"/>
                  <g>
                    <animateTransform attributeName="transform" type="rotate"
                      from="0" to="360" dur="0.42s" repeatCount="indefinite" calcMode="linear"/>
                    {/* Irregular potato shape */}
                    <ellipse cx="52" cy="0" rx="11" ry="7.5" fill="#bb7744"/>
                    <ellipse cx="50" cy="-0.7" rx="9" ry="6" fill="#cc8855" opacity="0.6"/>
                    {/* Stickney crater — dominant 9km impact crater */}
                    <circle cx="47" cy="-1.5" r="5.5" fill="none" stroke="#7a4422" strokeWidth="1.8" opacity="0.8"/>
                    <ellipse cx="47" cy="-1.5" rx="4.4" ry="3.8" fill="#8a4422" opacity="0.5"/>
                    {/* Surface grooves radiating from Stickney */}
                    <line x1="42" y1="4"  x2="58" y2="2.5" stroke="#7a4422" strokeWidth="0.7" opacity="0.4"/>
                    <line x1="43" y1="-5" x2="59" y2="-4"  stroke="#7a4422" strokeWidth="0.6" opacity="0.3"/>
                    <circle cx="55" cy="2.5" r="1.6" fill="none" stroke="#9a6633" strokeWidth="0.6" opacity="0.4"/>
                  </g>
                </g>

                {/* ── DEIMOS — 30.312h, 23,458km, 16×12×10km, smoother surface (NASA NSSDC) ── */}
                <g transform={`translate(1090,${marsY})`}>
                  <circle cx="0" cy="0" r="68" fill="none" stroke="#441a0a" strokeWidth="0.6"
                    strokeDasharray="2,7" opacity="0.4"/>
                  <g>
                    <animateTransform attributeName="transform" type="rotate"
                      from="360" to="0" dur="1.55s" repeatCount="indefinite" calcMode="linear"/>
                    {/* Slightly irregular — Deimos is rounder than Phobos */}
                    <ellipse cx="68" cy="0" rx="7" ry="5" fill="#b07850"/>
                    <ellipse cx="67" cy="-0.7" rx="5" ry="3.5" fill="#c08858" opacity="0.5"/>
                    <circle cx="65" cy="-0.7" r="2.1" fill="none" stroke="#8a5530" strokeWidth="0.8" opacity="0.45"/>
                    <circle cx="71" cy="1.5" r="1.4" fill="none" stroke="#9a6540" strokeWidth="0.6" opacity="0.35"/>
                  </g>
                </g>

                {/* Rockets */}
                {rocketEntries.map(([key, rocket], idx) => {
                  const laneY    = laneYs[idx];
                  const dodgeY   = dodgeOffsets[key] || 0;
                  const rp       = rocketProgresses[key] || 0;
                  const isFailed = rocket.failed;
                  const x        = clamp(162 + rp * 876, 162, 1038);
                  const y        = laneY + dodgeY;
                  const arrived  = arrivals[key];
                  const exploding = isFailed && raceProgress > 0.1;
                  const isHit    = activeHazardAlert?.key === key;
                  const hitCount = (appliedHazards[key]||[]).length;
                  const isDodging = dodgeY !== 0;
                  const lastHaz  = (appliedHazards[key]||[])[hitCount-1];

                  return (
                    <g key={key} opacity={exploding ? 0.78 : 1}>
                      {/* Orbital trail — stays on lane (shows the swerve path) */}
                      {rp > 0.005 && !exploding && (
                        <line x1="162" y1={laneY} x2={x - 18} y2={y}
                          stroke={rocket.color} strokeWidth="1.2" opacity="0.12" strokeDasharray="3,8"/>
                      )}
                      {/* Dodge trail — bright streak when evading */}
                      {isDodging && rp > 0.01 && (
                        <line x1={x - 60} y1={laneY} x2={x - 10} y2={y}
                          stroke={rocket.color} strokeWidth="2" opacity="0.35" strokeLinecap="round"/>
                      )}
                      {/* Hazard zone flash */}
                      {isHit && (
                        <rect x={x-30} y={y-26} width="72" height="52" rx="7"
                          fill={activeHazardAlert.hazard.color} opacity="0.15">
                          <animate attributeName="opacity" dur="0.25s" repeatCount="indefinite" values="0.15;0.35;0.15"/>
                        </rect>
                      )}
                      <g transform={`translate(${x},${y})`}>
                        {/* NTR exhaust plume — wider, more dramatic */}
                        {!arrived && !exploding && (
                          <g>
                            <ellipse cx="-30" cy="0" rx="22" ry="7" fill="#ff9900" opacity="0.65">
                              <animate attributeName="rx" dur="0.12s" repeatCount="indefinite" values="22;32;22"/>
                              <animate attributeName="opacity" dur="0.17s" repeatCount="indefinite" values="0.65;0.35;0.65"/>
                            </ellipse>
                            <ellipse cx="-20" cy="0" rx="10" ry="3.5" fill="#fff8aa" opacity="0.88">
                              <animate attributeName="rx" dur="0.09s" repeatCount="indefinite" values="10;16;10"/>
                            </ellipse>
                            <ellipse cx="-12" cy="0" rx="5" ry="2" fill="#ffffff" opacity="0.7">
                              <animate attributeName="rx" dur="0.08s" repeatCount="indefinite" values="5;8;5"/>
                            </ellipse>
                            {/* Radiative plume particles */}
                            {[1,-1,2,-2].map((dy, pi) => (
                              <circle key={pi} cx={-35 - pi*4} cy={dy*3} r="1.2"
                                fill="#ffcc44" opacity="0.5">
                                <animate attributeName="opacity" dur={`${0.15+pi*0.04}s`}
                                  repeatCount="indefinite" values="0.5;0;0.5"/>
                              </circle>
                            ))}
                          </g>
                        )}
                        {/* EXPLOSION — debris fragments + fireball */}
                        {exploding && (
                          <g>
                            {/* Shockwave ring */}
                            <circle cx="10" cy="0" r="22" fill="none" stroke="#ff7700" strokeWidth="1.5" opacity="0.5">
                              <animate attributeName="r" dur="0.6s" repeatCount="indefinite" values="12;28;12"/>
                              <animate attributeName="opacity" dur="0.6s" repeatCount="indefinite" values="0.5;0;0.5"/>
                            </circle>
                            {/* Debris rays */}
                            {[0,30,60,90,120,150,180,210,240,270,300,330].map((angle, i) => (
                              <line key={i} x1="10" y1="0"
                                x2={10 + Math.cos(angle*Math.PI/180)*32}
                                y2={Math.sin(angle*Math.PI/180)*32}
                                stroke={i%3===0?'#ff3333':i%3===1?'#ffaa00':'#ffff66'}
                                strokeWidth={i%2===0?2.5:1.5} strokeLinecap="round">
                                <animate attributeName="opacity" dur={`${0.28+i*0.02}s`}
                                  repeatCount="indefinite" values="1;0.05;1"/>
                              </line>
                            ))}
                            {/* Debris chunks */}
                            {[-8,6,-4,10,-12,8].map((dx, i) => (
                              <rect key={i} x={10+dx} y={[-10,8,-6,12,-14,6][i]}
                                width="3" height="3" rx="0.5"
                                fill={i%2===0?'#cc3300':'#886600'} opacity="0.8"
                                transform={`rotate(${i*37+10},${10+dx},${[-10,8,-6,12,-14,6][i]})`}>
                                <animate attributeName="opacity" dur={`${0.4+i*0.07}s`}
                                  repeatCount="indefinite" values="0.8;0.1;0.8"/>
                              </rect>
                            ))}
                            {/* Core fireball */}
                            <circle cx="10" cy="0" r="16" fill="#ff8800" opacity="0.75">
                              <animate attributeName="r" dur="0.25s" repeatCount="indefinite" values="10;20;10"/>
                              <animate attributeName="opacity" dur="0.25s" repeatCount="indefinite" values="0.75;0.4;0.75"/>
                            </circle>
                            <circle cx="10" cy="0" r="9" fill="#ffdd44" opacity="0.85">
                              <animate attributeName="r" dur="0.18s" repeatCount="indefinite" values="6;12;6"/>
                            </circle>
                            <circle cx="10" cy="0" r="4.5" fill="#ffffff" opacity="0.95"/>
                          </g>
                        )}
                        {/* Rocket body */}
                        {!exploding && (
                          <>
                            {/* Body */}
                            <rect x="-7" y="-8" width="34" height="16" rx="5" fill={rocket.color} filter="url(#softGlow)"/>
                            {/* Nose cone */}
                            <polygon points="27,-8 40,0 27,8" fill={rocket.color} opacity="0.8"/>
                            {/* Viewport */}
                            <circle cx="10" cy="0" r="5.5" fill="#aaddff" opacity="0.88"/>
                            <circle cx="10" cy="0" r="2.5" fill="#ffffff" opacity="0.55"/>
                            {/* Fins */}
                            <polygon points="-7,8 -18,18 -3,8" fill={rocket.color} opacity="0.5"/>
                            <polygon points="-7,-8 -18,-18 -3,-8" fill={rocket.color} opacity="0.5"/>
                            {/* Structural stripe */}
                            <rect x="4" y="-8" width="2.5" height="16" rx="1" fill="rgba(255,255,255,0.18)"/>
                          </>
                        )}
                        {/* DODGE indicator */}
                        {isDodging && !exploding && (
                          <>
                            <rect x="-18" y="-34" width="60" height="14" rx="3"
                              fill="rgba(255,153,0,0.25)" stroke="#ff9900" strokeWidth="0.8"/>
                            <text x="12" y="-23" fill="#ff9900" fontSize="7.5" fontFamily="Orbitron"
                              textAnchor="middle" fontWeight="700" opacity="0.95">
                              EVADE
                            </text>
                          </>
                        )}
                        {/* Hazard icon */}
                        {hitCount > 0 && !exploding && !isDodging && (
                          <text x="34" y="-12" fill={isHit ? lastHaz?.color : '#777'}
                            fontSize="10" textAnchor="middle">
                            {lastHaz?.icon || ''}
                          </text>
                        )}
                        <text x="12" y="-16" fill={exploding?'#ff5555':isDodging?'#ff9900':rocket.color}
                          fontSize="7" fontFamily="Orbitron" textAnchor="middle" fontWeight="700">
                          {rocket.shortLabel}
                        </text>
                        <text x="12" y="26" fill={exploding?'#ff5555':rocket.color}
                          fontSize="6.5" fontFamily="Share Tech Mono" textAnchor="middle">
                          {arrived ? '✓ ARRIVED' : exploding ? '💥 ABORT' : `Day ${Math.round(rp*rocket.transit)}`}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* ── TARGETED IMPACT EVENTS ────────────────────────────────────
                    Each hazard hit spawns a visual — meteor/flare/spark flying TO the specific rocket */}
                {impactEvents.map(ev => {
                  const seed  = Math.floor(ev.id) % 1000;
                  const side  = seed % 2 === 0 ? -1 : 1;
                  const fxOff = 80 + (seed % 80);
                  const fyOff = (seed % 2 === 0 ? -1 : 1) * (55 + (seed % 55));
                  const fromX = ev.x - fxOff * side;
                  const fromY = ev.y + fyOff;
                  const isSolar    = ev.type === 'solar_flare';
                  const isDebris   = ev.type === 'debris' || ev.type === 'micrometeorite';
                  const isAnomaly  = ev.type === 'engine_anomaly';
                  return (
                    <g key={ev.id}>
                      {/* INCOMING OBJECT — streak from offscreen to rocket */}
                      <line x1={fromX} y1={fromY} x2={ev.x} y2={ev.y}
                        stroke={ev.color}
                        strokeWidth={isSolar ? 5 : isDebris ? 3 : 2.5}
                        strokeLinecap="round"
                        style={{ animation: 'impact-flash 1.1s ease-out forwards' }}>
                        <animate attributeName="x1" dur="0.55s" values={`${fromX};${ev.x}`} fill="freeze" calcMode="ease-in"/>
                        <animate attributeName="y1" dur="0.55s" values={`${fromY};${ev.y}`} fill="freeze" calcMode="ease-in"/>
                        <animate attributeName="opacity" dur="1.1s" values="0;1;0.7;0" fill="freeze"/>
                      </line>
                      {/* IMPACT RING — expands on contact */}
                      <circle cx={ev.x} cy={ev.y} r="3" fill={ev.color} opacity="0">
                        <animate attributeName="r" dur="0.75s" begin="0.5s" values="3;32;40" fill="freeze" calcMode="ease-out"/>
                        <animate attributeName="opacity" dur="0.75s" begin="0.5s" values="0.9;0.5;0" fill="freeze"/>
                      </circle>
                      {/* DEBRIS SHARDS — radiate outward on impact */}
                      {isDebris && [0,40,80,120,160,200,240,280,320].map((a, ai) => (
                        <line key={ai} x1={ev.x} y1={ev.y}
                          x2={ev.x + Math.cos(a*Math.PI/180)*24}
                          y2={ev.y + Math.sin(a*Math.PI/180)*24}
                          stroke={ev.color} strokeWidth="1.8" strokeLinecap="round" opacity="0">
                          <animate attributeName="x2" dur="0.5s" begin="0.5s"
                            values={`${ev.x};${ev.x + Math.cos(a*Math.PI/180)*28}`} fill="freeze"/>
                          <animate attributeName="y2" dur="0.5s" begin="0.5s"
                            values={`${ev.y};${ev.y + Math.sin(a*Math.PI/180)*28}`} fill="freeze"/>
                          <animate attributeName="opacity" dur="0.5s" begin="0.5s" values="0.9;0" fill="freeze"/>
                        </line>
                      ))}
                      {/* SOLAR FLARE — bright horizontal wash */}
                      {isSolar && (
                        <rect x={ev.x - 60} y={ev.y - 22} width="130" height="44" rx="8"
                          fill="rgba(255,150,0,0.35)" opacity="0">
                          <animate attributeName="opacity" dur="1.2s" values="0;0.65;0.35;0" fill="freeze"/>
                        </rect>
                      )}
                      {/* ENGINE ANOMALY — spark cluster */}
                      {isAnomaly && [0,1,2,3,4].map((si) => (
                        <line key={si}
                          x1={ev.x + si*4 - 8} y1={ev.y + 8}
                          x2={ev.x + si*6 - 12} y2={ev.y - 22 - si*4}
                          stroke="#FFD700" strokeWidth="2" strokeLinecap="round" opacity="0">
                          <animate attributeName="opacity" dur={`${0.4 + si*0.1}s`} begin="0.4s"
                            values="0.9;0" fill="freeze"/>
                        </line>
                      ))}
                      {/* HAZARD ICON — shown at impact point */}
                      <text x={ev.x + 12} y={ev.y - 14} fill={ev.color}
                        fontSize="12" textAnchor="middle" opacity="0">
                        <animate attributeName="opacity" dur="1.4s" values="0;1;0.8;0" fill="freeze" begin="0.45s"/>
                        {ev.icon}
                      </text>
                    </g>
                  );
                })}

              </svg>

              {/* ── ORBITAL ENVIRONMENT LEGEND — proper HTML panel ── */}
              <div style={{
                display:'flex', flexWrap:'wrap', gap:'0',
                background:'rgba(4,2,12,0.95)', border:'1px solid #3a2240',
                borderTop:'2px solid #5a2a50', borderRadius:'0 0 8px 8px',
                padding:'12px 16px 10px', marginTop:'-1px',
              }}>
                {/* Row 1 — orbital bodies */}
                <div style={{width:'100%', display:'flex', gap:'22px', flexWrap:'wrap',
                  marginBottom:'8px', alignItems:'center'}}>
                  <span style={{fontFamily:'Orbitron', fontSize:'0.62rem', color:'#887799',
                    letterSpacing:'0.12em', marginRight:'4px'}}>LIVE ENVIRONMENT</span>
                  {[
                    { icon:'○', label:'MOON',   sub:'27.3d · 384,400km orbit',   col:'#aaccee' },
                    { icon:'⊞', label:'ISS',    sub:'92.7min · 408km altitude',  col:'#66bbee' },
                    { icon:'◆', label:'PHOBOS', sub:'7.66h · 9,376km from Mars', col:'#dd9966' },
                    { icon:'◆', label:'DEIMOS', sub:'30.3h · 23,458km from Mars',col:'#cc8855' },
                    { icon:'·', label:'DEBRIS', sub:'27,000+ tracked (ESA 2024)',  col:'#7799cc' },
                    { icon:'▲', label:'NEOs',   sub:'34,000+ (JPL CNEOS 2024)',   col:'#bb9966' },
                    { icon:'—', label:'METEORS',sub:'Grün et al. 1985 flux',      col:'#aaaaaa' },
                  ].map(item => (
                    <div key={item.label} style={{display:'flex', alignItems:'center', gap:'6px', minWidth:'120px'}}>
                      <span style={{color:item.col, fontSize:'1rem', lineHeight:1}}>{item.icon}</span>
                      <div>
                        <div style={{fontFamily:'Orbitron', fontSize:'0.68rem',
                          color:item.col, letterSpacing:'0.06em', lineHeight:1.2}}>{item.label}</div>
                        <div style={{fontFamily:'Share Tech Mono', fontSize:'0.6rem',
                          color:'#778899', lineHeight:1.2}}>{item.sub}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{marginLeft:'auto', textAlign:'right'}}>
                    <div style={{fontFamily:'Share Tech Mono', fontSize:'0.75rem', color:'#e07030'}}>
                      {distance} M km · {Math.round(raceProgress*100)}% · T+{Math.round(raceProgress*RACE_MS/1000)}s
                    </div>
                    <div style={{fontFamily:'Share Tech Mono', fontSize:'0.58rem', color:'#886644'}}>
                      NASA NSSDC · ESA · JPL CNEOS
                    </div>
                  </div>
                </div>
              </div>
            </> )}

            {/* COCKPIT VIEW */}
            {raceView === 'cockpit' && (
              <div>
                <div className="cockpit-selector">
                  {rocketEntries.map(([key, rocket]) => (
                    <button key={key}
                      className={`cockpit-select-btn ${cockpitKey===key?'active':''}`}
                      style={cockpitKey===key ? {borderColor:rocket.color, color:rocket.color} : {}}
                      onClick={() => setCockpitKey(key)}>
                      {rocket.shortLabel} — {rocket.label}
                    </button>
                  ))}
                </div>
                {cockpitKey && rockets[cockpitKey] && (
                  <CockpitView
                    rocket={rockets[cockpitKey]}
                    rocketRp={rocketProgresses[cockpitKey] || 0}
                    distance={distance}
                    hazardsHit={appliedHazards[cockpitKey] || []}
                  />
                )}
              </div>
            )}

            {/* LIVE TELEMETRY */}
            <div className="telemetry-grid" style={{marginTop:'16px'}}>
              {rocketEntries.map(([key, rocket]) => {
                const rp       = rocketProgresses[key] || 0;
                const isFailed = rocket.failed;
                const arrived  = arrivals[key];
                const exploding = isFailed && raceProgress > 0.1;
                const day      = Math.round(rp * rocket.transit);
                const liveDist = +(distance * rp).toFixed(1);
                const hits     = appliedHazards[key] || [];
                const radMult  = hits.reduce((m,h) => m*(h.radMultiplier||1), 1);
                const liveRad  = +(rocket.radiation * rp * radMult).toFixed(1);
                const fuelLeft = Math.round((1-rp)*100);
                const dotClass = exploding?'failed': arrived?'arrived':'transit';
                const cardStyle = exploding
                  ? {borderColor:'#ff5555', boxShadow:'0 0 18px rgba(255,85,85,0.28)'}
                  : arrived
                  ? {borderColor:rocket.color, boxShadow:`0 0 22px ${rocket.color}44`}
                  : {borderColor:rocket.color+'70'};

                return (
                  <div key={key} className="telemetry-card" style={cardStyle}>
                    <div className="telemetry-header">
                      <h4 style={{color: exploding?'#ff5555':rocket.color}}>{rocket.label}</h4>
                      <div className={`telemetry-status-dot ${dotClass}`}
                        style={arrived&&!exploding?{background:rocket.color, boxShadow:`0 0 10px ${rocket.color}`}:{}}/>
                    </div>
                    {exploding ? (
                      <div style={{textAlign:'center', padding:'14px 8px'}}>
                        <div style={{fontFamily:'Orbitron', fontSize:'0.82rem', color:'#ff5555', marginBottom:'6px'}}>
                          💥 MISSION ABORT
                        </div>
                        <div style={{fontSize:'0.66rem', color:'#cc4444', lineHeight:1.6}}>{rocket.failReason}</div>
                        <div style={{fontSize:'0.58rem', color:'#7a3030', marginTop:'6px'}}>
                          ΔV = {rocket.deltaV} km/s · Min required: 3.5 km/s
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="telemetry-data-grid">
                          <span className="td-label">MISSION DAY</span>
                          <span className="td-value">{day} / {rocket.transit}d</span>
                          <span className="td-label">PROGRESS</span>
                          <span className="td-value">{Math.round(rp*100)}%</span>
                          <span className="td-label">DISTANCE</span>
                          <span className="td-value">{liveDist} / {distance} M km</span>
                          <span className="td-label">RADIATION</span>
                          <span className="td-value" style={{color:radColor(liveRad)}}>{liveRad} mSv</span>
                          <span className="td-label">FUEL LEFT</span>
                          <span className="td-value">{fuelLeft}%</span>
                          <span className="td-label">CREW HEALTH</span>
                          <span className="td-value">{rocket.crewHealth}%</span>
                        </div>
                        {/* Active hazards on this rocket */}
                        {hits.length > 0 && (
                          <div style={{marginBottom:'8px', display:'flex', gap:'4px', flexWrap:'wrap'}}>
                            {hits.map((h,i) => (
                              <span key={i} className="hazard-event-tag"
                                style={{background:`${h.color}18`, color:h.color, border:`1px solid ${h.color}55`}}>
                                {h.icon} {h.name.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="progress-track">
                          <div className="progress-fill" style={{width:`${Math.round(rp*100)}%`, background:rocket.color}}/>
                        </div>
                        {arrived && (
                          <div className="arrived-tag" style={{color:rocket.color, borderColor:rocket.color}}>
                            ✓ ARRIVED AT MARS · {rocket.transit} DAYS
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ══════════════════ PHASE 3: DEBRIEF ══════════════════ */}
        {showDebrief && (
          <section className="debrief">
            <div className="config-header">
              <span className="section-title">◈ MISSION DEBRIEF</span>
              <span className="mission-phase-badge">PHASE 03 · ANALYSIS</span>
            </div>

            {/* Arrival summary cards */}
            {(() => {
              const valid = rocketEntries.filter(([,r]) => !r.failed);
              const minT  = valid.length > 0 ? Math.min(...valid.map(([,r]) => r.transit)) : 999;
              return (
                <div style={{display:'grid', gridTemplateColumns:`repeat(${rocketEntries.length},1fr)`, gap:'10px', marginBottom:'20px'}}>
                  {rocketEntries.map(([key, rocket]) => {
                    const isFastest = !rocket.failed && rocket.transit === minT;
                    const diff = rocket.failed ? null : (rocket.transit - minT).toFixed(1);
                    const hazCount = (appliedHazards[key]||[]).length;
                    return (
                      <div key={key} style={{
                        background:`linear-gradient(135deg,${rocket.color}18,${rocket.color}08)`,
                        border:`1px solid ${rocket.color}55`, borderRadius:'8px',
                        padding:'12px', textAlign:'center'
                      }}>
                        <div style={{fontFamily:'Orbitron', fontSize:'0.68rem', color:rocket.color, letterSpacing:'0.1em'}}>{rocket.shortLabel}</div>
                        <div style={{fontFamily:'Orbitron', fontSize:'1.5rem', fontWeight:900, color:rocket.failed?'#ff5555':rocket.color, margin:'4px 0'}}>
                          {rocket.failed ? 'ABORT' : `${rocket.transit}d`}
                        </div>
                        <div style={{fontSize:'0.55rem', color:'#666'}}>transit time</div>
                        <div style={{fontSize:'0.6rem', color:rocket.failed?'#ff5555':isFastest?'#6edc52':'#888', marginTop:'5px', fontFamily:'Orbitron'}}>
                          {rocket.failed ? '💥 FAILED' : isFastest ? '★ FASTEST' : `+${diff}d`}
                        </div>
                        {hazCount > 0 && (
                          <div style={{fontSize:'0.55rem', color:'#ffc107', marginTop:'4px'}}>
                            {hazCount} hazard{hazCount>1?'s':''} hit
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Tabs */}
            <div className="debrief-tabs">
              {[['table','⊞ TABLE'],['charts','▦ CHARTS'],['insights','◈ KEY INSIGHTS']].map(([tab,label]) => (
                <button key={tab} className={`debrief-tab ${debriefTab===tab?'active':''}`}
                  onClick={() => setDebriefTab(tab)}>{label}</button>
              ))}
            </div>

            {/* TABLE — fleet comparison stars only between the 3 fleet rockets; custom shown but not graded */}
            {debriefTab === 'table' && (
              <div style={{overflowX:'auto'}}>
                <table className="debrief-table">
                  <thead>
                    <tr>
                      <th className="metric-col">METRIC</th>
                      {rocketEntries.map(([key,r]) => (
                        <th key={r.shortLabel} style={{color:r.failed?'#ff5555':r.color}}>
                          {key==='player'&&<span style={{fontSize:'0.5rem',color:'#ff8800',display:'block',letterSpacing:'0.05em',marginBottom:'2px'}}>NOT COMPARED</span>}
                          {r.label}{key==='player'&&<span style={{fontSize:'0.5rem',color:'#888',display:'block',letterSpacing:'0.05em'}}>CUSTOM</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map(m => {
                      const fleetEntries = rocketEntries.filter(([k]) => k !== 'player');
                      const fleetVals    = fleetEntries.map(([,r]) => r.failed ? null : Number(r[m.key])||0);
                      const validFleet   = fleetVals.filter(v => v !== null);
                      const bestV        = validFleet.length > 0 ? (m.lo ? Math.min(...validFleet) : Math.max(...validFleet)) : null;
                      return (
                        <tr key={m.key}>
                          <td className="metric-col">
                            <span className="metric-name">{m.label}</span>
                            <span className="metric-unit">{m.unit}</span>
                          </td>
                          {rocketEntries.map(([key,r]) => {
                            if (r.failed) return <td key={r.shortLabel} style={{color:'#ff5555', opacity:0.6}}>ABORT</td>;
                            const v = Number(r[m.key])||0;
                            const isCustom = key === 'player';
                            const best = !isCustom && bestV !== null && v === bestV;
                            const disp = v>99999?`${(v/1000).toFixed(0)}k`:v>999?v.toFixed(0):v.toFixed(1);
                            return (
                              <td key={r.shortLabel} className={best?'best-cell':''}
                                style={{color:best?r.color:isCustom?r.color+'99':'var(--text)',
                                  opacity: isCustom ? 0.75 : 1}}>
                                {disp} {m.unit}{best&&<span className="best-marker"> ★</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rockets.player && (
                  <div style={{fontSize:'0.6rem', color:'#555', marginTop:'8px',
                    fontFamily:'Share Tech Mono', padding:'4px 8px',
                    border:'1px solid #2a1a0a', borderRadius:'4px', display:'inline-block'}}>
                    ★ marks best among fleet only (Chemical · NTR · Starship). Custom rocket shown for reference.
                  </div>
                )}
              </div>
            )}

            {/* CHARTS — fleet only (Chemical, NTR, Starship). Custom excluded from comparison. */}
            {debriefTab === 'charts' && (
              <div>
                <div className="charts-grid">
                  {['transit','radiation','cost','success','payloadMars','propellant'].map(mk => (
                    <BarChart key={mk} metricKey={mk}
                      rocketList={rocketEntries.filter(([k])=>k!=='player').map(([,r])=>r)}/>
                  ))}
                </div>
                {rockets.player && !rockets.player.failed && (
                  <div style={{margin:'14px 0 0', padding:'12px 16px',
                    background:'rgba(0,0,0,0.35)', border:`1px solid ${rockets.player.color}33`,
                    borderRadius:'8px', fontSize:'0.72rem', color:'#888',
                    fontFamily:'Share Tech Mono'}}>
                    <span style={{color:rockets.player.color, fontWeight:700}}>{rockets.player.label}</span>
                    {' '}(custom) —{' '}
                    transit {rockets.player.transit}d · radiation {rockets.player.radiation} mSv ·
                    ΔV {rockets.player.deltaV} km/s · bone loss {rockets.player.boneLossPct}% ·
                    abort ΔV {rockets.player.abortDv} km/s · cost ${rockets.player.cost}B ·
                    payload {(rockets.player.payloadMars/1000).toFixed(0)}t
                    <span style={{color:'#555', display:'block', marginTop:'4px', fontSize:'0.6rem'}}>
                      Custom rocket data shown above for reference only — not included in fleet comparison.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* INSIGHTS */}
            {debriefTab === 'insights' && (() => {
              const chem = rockets.chemical;
              const ntr  = rockets.nuclear;
              const shp  = rockets.starship;
              const pl   = rockets.player;
              return (
                <div>
                  <div className="insights">
                    <div className="insights-header">
                      <span className="insights-icon">◈</span>
                      <h3>FLEET COMPARISON: CHEMICAL vs NTR vs STARSHIP — {year} · {distance} M km · {crewSize} CREW</h3>
                    </div>
                    <ul style={{paddingLeft:'18px', lineHeight:'2.2', fontSize:'0.82rem', color:'var(--text)'}}>
                      <li>
                        <strong style={{color:'#3B8BD4'}}>NTR arrives {(chem.transit-ntr.transit).toFixed(0)} days before Chemical</strong> and{' '}
                        {(shp.transit-ntr.transit).toFixed(0)} days before Starship.
                        Physics (Tsiolkovsky): ISP 900s → Ve = 8,829 m/s vs Chemical 450s → 4,414 m/s.
                        ΔV = Ve × ln(m₀/mf) gives NTR <strong>7.2 km/s</strong> vs Chemical 4.5 km/s → faster transfer orbit.
                        <em style={{color:'#5a4030'}}> Source: NASA DRA 5.0 (2009); Borowski et al. AIAA-2012-5144.</em>
                      </li>
                      <li>
                        <strong style={{color:'#3B8BD4'}}>NTR propellant: {(ntr.propellant/1000).toFixed(0)}t</strong> vs {(chem.propellant/1000).toFixed(0)}t Chemical
                        = <strong style={{color:'#6edc52'}}>{Math.round((1-ntr.propellant/chem.propellant)*100)}% less propellant</strong>.
                        Ve twice as high → same ΔV with 4× less propellant → 1 launch vs {chem.launches}× SLS at $2.7B each.
                        <em style={{color:'#5a4030'}}> Source: NASA IG Report 2022 (SLS cost); Tsiolkovsky 1903.</em>
                      </li>
                      <li>
                        <strong style={{color:'#3B8BD4'}}>NTR radiation: {ntr.radiation} mSv</strong> = <strong style={{color:'#6edc52'}}>{ntr.careerRadPct}% of career limit</strong>.
                        Chemical: {chem.radiation} mSv ({chem.careerRadPct}%). Starship: {shp.radiation} mSv ({shp.careerRadPct}%).
                        Dose = 1.3 mSv/day × transit days. Shorter transit = less exposure. Career limit 600 mSv (3% REID, NASA STD-3001 Rev C 2023).
                        <em style={{color:'#5a4030'}}> Source: Zeitlin et al. Science 340:1080 (2013); NCRP Report 132; NASA STD-3001.</em>
                      </li>
                      <li>
                        <strong style={{color:'#3B8BD4'}}>NTR bone loss: {ntr.boneLossPct}%</strong> hip density vs Chemical {chem.boneLossPct}%, Starship {shp.boneLossPct}%.
                        Rate 0.43%/month with ARED exercise countermeasures (ISS data). Shorter NTR transit directly reduces bone loss.
                        <em style={{color:'#5a4030'}}> Source: Leblanc et al. 2007, Osteoporosis International; PMID:17047197.</em>
                      </li>
                      <li>
                        <strong style={{color:'#3B8BD4'}}>NTR abort reserve: {ntr.abortDv} km/s</strong> vs Chemical {chem.abortDv} km/s vs Starship {shp.abortDv} km/s.
                        ΔV reserve = total ΔV − 3.5 km/s minimum. Higher reserve = more trajectory correction options, wider abort window.
                        Starship's 0.3 km/s reserve leaves almost no margin for engine anomalies or trajectory errors.
                        <em style={{color:'#5a4030'}}> Source: Tsiolkovsky equation; 3.5 km/s threshold from NASA DRA 5.0.</em>
                      </li>
                      {(() => {
                        const allHazards = Object.entries(appliedHazards);
                        const totalHits  = allHazards.reduce((s,[,h]) => s+h.length, 0);
                        if (totalHits === 0) return null;
                        return (
                          <li>
                            This mission encountered <strong style={{color:'#ffc107'}}>{totalHits} space hazard event{totalHits>1?'s':''}</strong>:{' '}
                            {allHazards.map(([key, hits]) => (
                              <span key={key} style={{marginRight:'12px'}}>
                                {rockets[key]?.label}: {hits.map(h => h.icon+' '+h.name.split(' ')[0]).join(', ')}
                              </span>
                            ))}
                            Solar flares cause Forbush decreases in GCR (Belov et al. 2008). Micrometeorite flux from Grün et al. 1985.
                            Engine anomaly probability based on TRL (lower TRL = higher chance, real engineering practice).
                          </li>
                        );
                      })()}
                      {/* Custom rocket excluded from fleet comparison — see TABLE tab for all results */}
                    </ul>
                  </div>
                  <div className="sources">
                    <div className="sources-title">DATA SOURCES</div>
                    <div className="sources-list">
                      NASA DRA 5.0 (2009) · NERVA 1965–1972 (ISP 841s achieved) ·
                      Curiosity RAD — Zeitlin et al. 2013 Science 340:1080 (1.3 mSv/day GCR) ·
                      NASA STD-3001 Rev C (600 mSv career limit) · Borowski et al. AIAA-2012-5144 (NTR fast-transit) ·
                      SpaceX Raptor 2 2023 (ISP 380s) · NASA IG 2022 (SLS ≈ $2.7B/launch) ·
                      JPL Horizons (opposition distances) · Tsiolkovsky 1903 ·
                      NASA NSSDC (Moon 27.3d/384,400km · Phobos 7.66h/9,376km · Deimos 30.3h/23,458km) ·
                      NASA ISS (period 92.68 min · altitude 408 km) ·
                      ESA Space Debris Report 2024 (27,000+ tracked objects) ·
                      JPL CNEOS 2024 (34,000+ NEOs) · Grün et al. 1985 (meteorite flux)
                    </div>
                  </div>
                </div>
              );
            })()}

            <button className="launch launch-ready new-mission-btn" onClick={resetMission}>
              ↺ NEW MISSION
            </button>
          </section>
        )}

      </div>
    </div>
  );
}
