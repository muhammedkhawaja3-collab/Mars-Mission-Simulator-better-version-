# Mars Mission Control — Project Brief

## What This Is
An interactive web app for a science fair that demonstrates why Nuclear Thermal Rockets are superior to Chemical Rockets and SpaceX Starship for Mars missions. This is backed by real NASA data and physics calculations.

## The Experience (3 Phases)

### Phase 1: Mission Control Configuration
- NASA-inspired dark theme control panel (think Houston Mission Control aesthetic)
- Judges configure 3 simplified parameters:
  - **Crew Size** (2-8, slider)
  - **Launch Window / Mars Opposition Year** (dropdown: 2027=97.7M km, 2029=81.5M km, 2031=101.2M km, 2033=62.1M km, 2035=95.4M km)
  - **Risk Tolerance** (1-10 slider, 1=safe, 10=dangerous)
- Show brief spec cards for the 3 rocket types (Chemical, Nuclear, Starship) with ISP and exhaust velocity
- Big "INITIATE LAUNCH" button

### Phase 2: Countdown + Race to Mars
- Dramatic 5-second countdown (large numbers, pulsing animations)
- Then: an animated "race" where 3 rockets fly from Earth to Mars across the screen
- Each rocket travels at a speed proportional to its actual transit time (Nuclear arrives first ~124 days, Chemical ~247 days, Starship ~288 days, scaled to real distance)
- Rockets have animated exhaust flames while in transit
- Below the race visualization: 3 live telemetry panels (one per rocket) showing real-time updating stats:
  - Transit time elapsed
  - Radiation exposure accumulating
  - Fuel/propellant consumed
  - Crew health declining
  - Mission cost, success probability, launches required
- When a rocket arrives at Mars, it gets a visual "arrived" indicator
- Race takes ~15-20 seconds total, punchy and fast

### Phase 3: Mission Debrief
- After all rockets arrive, transition to a comparison results screen
- Side-by-side metrics table comparing all 3 rockets across: transit time, radiation, propellant mass, cost, success probability, crew health
- Best value in each row is highlighted
- "Key Insight" summary box explaining Nuclear's advantages with specific numbers
- Sources cited: NASA Mars DRA 5.0, NERVA 1969, NASA Curiosity RAD, NASA STD 3001, NASA ECLSS, NASA DSN, SpaceX Raptor specs, NASA JPL, NASA Inspector General 2022
- "New Mission" button to restart

## The 3 Rocket Types & Their Data

### Chemical Rocket
- ISP: 450s, Exhaust Velocity: 4,414.5 m/s
- Transit time (baseline at 97.7M km): ~247 days
- Propellant: ~311,147 kg (for 4 crew)
- Radiation: ~236 mSv total mission
- Cost: ~$10.8B, Launches required: 4
- Success probability: ~52.5%, Crew health: ~70.4%
- Color: Red (#E24B4A)

### Nuclear Thermal Rocket (the winner)
- ISP: 900s, Exhaust Velocity: 8,829 m/s
- Transit time (baseline): ~123.5 days
- Propellant: ~79,394 kg (for 4 crew)
- Radiation: ~149.4 mSv total mission (has 4000kg nuclear shielding)
- Cost: ~$5.4B, Launches required: 1
- Success probability: ~67.4%, Crew health: ~79.8%
- Color: Blue (#3B8BD4)

### SpaceX Starship
- ISP: 363s, Exhaust Velocity: 3,561 m/s
- Transit time (baseline): ~288 days
- Propellant: ~582,455 kg (for 4 crew)
- Radiation: ~264.7 mSv total mission
- Cost: ~$1.8B, Launches required: 6
- Success probability: ~47.6%, Crew health: ~67.3%
- Color: Green (#1D9E75)

## Scaling Rules
All values scale with Mars opposition distance (divide by 97.7 and multiply by selected year's distance). Risk tolerance affects success probability and crew health via a multiplier. Crew size affects total mass (1000 kg payload per person + 2000 kg emergency supplies + 4000 kg nuclear shielding for Nuclear only).

## Tech Stack
- React (with hooks: useState, useEffect, useRef, useCallback)
- Pure CSS animations (no external animation libraries needed)
- SVG for the race visualization (Earth, Mars, rockets with exhaust flames)
- Google Fonts: "Share Tech Mono" for data/monospace text, "Orbitron" for headings
- No backend needed — all calculations are client-side

## Design Direction
- Dark space theme (deep navy/black backgrounds like #0a0e1a)
- Starfield background with twinkling stars
- Subtle scanline overlay for CRT/mission-control feel
- Monospace fonts for data readouts (Share Tech Mono)
- Bold display font for headings (Orbitron)
- Color-coded per rocket: Red=Chemical, Blue=Nuclear, Green=Starship
- Glowing accents and pulsing status indicators
- Clean telemetry panels with progress bars
- Smooth CSS transitions and animations throughout

## Key UX Details
- Countdown numbers should be very large and dramatic with pulsing/scaling animation
- Rockets in the race should have animated exhaust flames (ellipses with animate elements)
- Telemetry bars update smoothly during the race
- "Arrived" state should have a glow effect on the telemetry card
- The debrief table should highlight the best value per metric
- Everything should feel like a real NASA mission control interface
