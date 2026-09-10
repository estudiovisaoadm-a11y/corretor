/**
 * IA IMÓVEIS // GEOSPATIAL COMMAND CENTER RADAR ENGINE
 * Componentized, RAF-driven state machine with canvas sweep, reticle detection,
 * dynamic telemetry, and smooth interpolated metrics.
 */

(function () {
  'use strict';

  // 1. Data Reveal Observer (maintains page reveal on scroll)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  // 2. Real Brasília Demonstration Target Dataset
  const TARGETS_DATA = [
    {
      id: 1,
      name: 'Lago Sul',
      tipologia: 'Mansão QL · Escritura OK · 850m²',
      bearingDeg: 128, // South-East, across Paranoá Lake
      distanceFraction: 0.62,
      score: 94,
      veredito: 'MUITO ALTO',
      preco: 'R$ 4.800.000',
      precoM2: 13850,
      precoM2Diff: '-8% MÉDIA',
      latency: 0.9,
      docStatus: 'REGISTRADA ✓',
      commercial: 'OPORTUNIDADE CAPTAÇÃO',
      delta: '▲ ALTO GIRO',
      latLon: '15°50\'12"S 47°49\'55"W'
    },
    {
      id: 2,
      name: 'Asa Sul',
      tipologia: 'Quadra Nobre · 185m² · Financiável',
      bearingDeg: 215, // South-Southwest, Plano Piloto
      distanceFraction: 0.52,
      score: 89,
      veredito: 'ALTO',
      preco: 'R$ 1.280.000',
      precoM2: 14200,
      precoM2Diff: '+2% MÉDIA',
      latency: 1.1,
      docStatus: 'HABITE-SE REGULAR',
      commercial: 'LIQUIDEZ IMEDIATA',
      delta: '▲ DEMANDA ALTA',
      latLon: '15°49\'02"S 47°54\'10"W'
    },
    {
      id: 3,
      name: 'Park Way',
      tipologia: 'Fração Regular · 2.500m² · Aceita Permuta',
      bearingDeg: 258, // West-Southwest, SMPW
      distanceFraction: 0.74,
      score: 86,
      veredito: 'BOM / NEGOCIÁVEL',
      preco: 'R$ 3.250.000',
      precoM2: 7450,
      precoM2Diff: '-14% MÉDIA',
      latency: 1.4,
      docStatus: 'CERTIDÕES OK',
      commercial: 'VALORIZAÇÃO TERRENO',
      delta: '▲ PERMUTA VIÁVEL',
      latLon: '15°53\'44"S 47°57\'30"W'
    },
    {
      id: 4,
      name: 'Águas Claras',
      tipologia: '3 Quartos · 104m² · Oportunidade m²',
      bearingDeg: 312, // Northwest, Metro axis
      distanceFraction: 0.68,
      score: 91,
      veredito: 'EXCELENTE',
      preco: 'R$ 740.000',
      precoM2: 8920,
      precoM2Diff: '-11% MÉDIA',
      latency: 0.8,
      docStatus: 'ESCRITURA TOTAL',
      commercial: 'INVESTIMENTO SEGURO',
      delta: '▲ RETORNO RÁPIDO',
      latLon: '15°50\'18"S 48°01\'44"W'
    }
  ];

  // 3. Component: AnimatedMetric (Smooth Numerical Interpolation)
  class AnimatedMetric {
    constructor(element, formatter = (v) => String(v)) {
      this.element = element;
      this.formatter = formatter;
      this.currentValue = 0;
      this.targetValue = 0;
      this.animating = false;
      this.startTime = 0;
      this.duration = 650; // ms
      this.startValue = 0;
    }

    set(targetVal, immediate = false) {
      if (!this.element) return;
      if (immediate || reduceMotion) {
        this.currentValue = targetVal;
        this.targetValue = targetVal;
        this.element.textContent = this.formatter(targetVal);
        return;
      }
      this.startValue = this.currentValue;
      this.targetValue = targetVal;
      this.startTime = performance.now();
      if (!this.animating) {
        this.animating = true;
        this.tick = this.tick.bind(this);
        requestAnimationFrame(this.tick);
      }
    }

    tick(now) {
      const elapsed = now - this.startTime;
      const progress = Math.min(1, elapsed / this.duration);
      // Ease-out quartic interpolation: 1 - pow(1 - p, 4)
      const ease = 1 - Math.pow(1 - progress, 4);
      this.currentValue = this.startValue + (this.targetValue - this.startValue) * ease;
      this.element.textContent = this.formatter(this.currentValue);

      if (progress < 1) {
        requestAnimationFrame(this.tick);
      } else {
        this.currentValue = this.targetValue;
        this.element.textContent = this.formatter(this.targetValue);
        this.animating = false;
      }
    }
  }

  // 4. Component: RadarMap (Canvas resolution & coordinate mapping)
  class RadarMap {
    constructor(canvas, viewport) {
      this.canvas = canvas;
      this.viewport = viewport;
      this.ctx = canvas.getContext('2d');
      this.width = 600;
      this.height = 600;
      this.center = { x: 300, y: 300 };
      this.maxRadius = 265; // outer ring radius in SVG space
      this.setupCanvas();
    }

    setupCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.scale(dpr, dpr);
    }

    // Convert bearing in degrees (0 = North, clockwise) & fraction to Cartesian coords
    polarToCartesian(bearingDeg, fraction) {
      // 0 deg is North (-Y), 90 is East (+X)
      const rad = (bearingDeg - 90) * (Math.PI / 180);
      const r = this.maxRadius * fraction;
      return {
        x: this.center.x + r * Math.cos(rad),
        y: this.center.y + r * Math.sin(rad)
      };
    }
  }

  // 5. Component: RadarSweep (Canvas-rendered beam, phosphor decay & echo ripples)
  class RadarSweep {
    constructor(map) {
      this.map = map;
      this.ctx = map.ctx;
      this.echoes = []; // active ripples: { x, y, radius, maxRadius, alpha, duration, birth }
    }

    addEcho(x, y) {
      if (reduceMotion) return;
      this.echoes.push({
        x,
        y,
        radius: 6,
        maxRadius: 42,
        alpha: 0.95,
        duration: 1200,
        birth: performance.now()
      });
    }

    render(angleDeg, now) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.map.width, this.map.height);

      const cx = this.map.center.x;
      const cy = this.map.center.y;
      const r = this.map.maxRadius;

      // 1. Draw Amber Sweep Beam Sector (trailing phosphor gradient over ~65 degrees)
      const beamRad = (angleDeg - 90) * (Math.PI / 180);
      const trailAngle = 65; // degrees of trail
      const startRad = beamRad - trailAngle * (Math.PI / 180);

      ctx.save();
      // Clip to circular radar area
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Draw sweeping phosphor trail using angular gradient simulation
      // Multiple transparent slices create a smooth decay curve
      const steps = 18;
      for (let i = 0; i < steps; i++) {
        const p1 = i / steps;
        const p2 = (i + 1) / steps;
        const a1 = startRad + p1 * (beamRad - startRad);
        const a2 = startRad + p2 * (beamRad - startRad);
        const alpha = Math.pow(p2, 2.5) * 0.28; // parabolic decay

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a1, a2);
        ctx.closePath();
        ctx.fillStyle = `rgba(229, 166, 92, ${alpha})`;
        ctx.fill();
      }

      // 2. Luminous Leading Beam Head Line
      const headX = cx + r * Math.cos(beamRad);
      const headY = cy + r * Math.sin(beamRad);

      const beamGrad = ctx.createLinearGradient(cx, cy, headX, headY);
      beamGrad.addColorStop(0, 'rgba(255, 240, 215, 0.95)');
      beamGrad.addColorStop(0.3, 'rgba(243, 190, 122, 0.85)');
      beamGrad.addColorStop(0.8, 'rgba(203, 125, 72, 0.6)');
      beamGrad.addColorStop(1, 'rgba(229, 166, 92, 0.15)');

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(headX, headY);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = beamGrad;
      ctx.shadowColor = 'rgba(255, 224, 178, 0.9)';
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Glowing tip on leading edge
      ctx.beginPath();
      ctx.arc(headX, headY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 224, 178, 1)';
      ctx.shadowBlur = 12;
      ctx.fill();

      // 3. Central Core Halo
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe0b2';
      ctx.shadowColor = 'rgba(229, 166, 92, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.restore();

      // 4. Render Active Target Echo Ripples
      if (this.echoes.length > 0) {
        ctx.save();
        for (let i = this.echoes.length - 1; i >= 0; i--) {
          const echo = this.echoes[i];
          const age = now - echo.birth;
          if (age > echo.duration) {
            this.echoes.splice(i, 1);
            continue;
          }
          const p = age / echo.duration;
          const currentRadius = echo.radius + (echo.maxRadius - echo.radius) * (1 - Math.pow(1 - p, 3));
          const currentAlpha = echo.alpha * (1 - p);

          ctx.beginPath();
          ctx.arc(echo.x, echo.y, currentRadius, 0, Math.PI * 2);
          ctx.lineWidth = 1.6 * (1 - p * 0.5);
          ctx.strokeStyle = `rgba(255, 224, 178, ${currentAlpha})`;
          ctx.shadowColor = 'rgba(229, 166, 92, 0.6)';
          ctx.shadowBlur = 6;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // 6. Component: PropertyTarget (DOM reticle, callout badge, lock state)
  class PropertyTarget {
    constructor(data, map, container) {
      this.data = data;
      this.map = map;
      this.container = container;
      this.isDetected = false;
      this.lastDetectedTime = 0;

      // Compute SVG Cartesian coordinates
      const coords = map.polarToCartesian(data.bearingDeg, data.distanceFraction);
      this.x = coords.x;
      this.y = coords.y;

      // Convert to % for responsive positioning
      this.leftPct = (this.x / map.width) * 100;
      this.topPct = (this.y / map.height) * 100;

      this.createElement();
    }

    createElement() {
      const el = document.createElement('div');
      el.className = 'target-beacon';
      el.dataset.targetId = this.data.id;
      el.style.left = `${this.leftPct.toFixed(2)}%`;
      el.style.top = `${this.topPct.toFixed(2)}%`;

      el.innerHTML = `
        <span class="target-reticle" aria-hidden="true"></span>
        <span class="target-core" aria-hidden="true"></span>
        <span class="target-echo-wave" aria-hidden="true"></span>
        <span class="target-connector" aria-hidden="true"></span>
        <div class="target-callout" role="tooltip">
          <span>${this.data.name}</span>
          <b class="target-callout-score">${this.data.score}</b>
        </div>
      `;

      this.el = el;
      this.container.appendChild(el);
    }

    setDetected(detected) {
      if (this.isDetected === detected) return;
      this.isDetected = detected;
      if (detected) {
        this.el.classList.add('is-detected');
        this.lastDetectedTime = performance.now();
      } else {
        this.el.classList.remove('is-detected');
      }
    }
  }

  // 7. Component: DetectionStatus (Header readout & status footer banner)
  class DetectionStatus {
    constructor() {
      this.statusEl = document.querySelector('[data-radar-status]');
      this.bearingEl = document.querySelector('[data-telemetry-bearing]');
      this.lastAnnounced = '';
    }

    setBearing(angleDeg) {
      if (this.bearingEl) {
        const rounded = Math.round(angleDeg) % 360;
        this.bearingEl.textContent = `AZM ${String(rounded).padStart(3, '0')}°`;
      }
    }

    setStatus(text, announce = false) {
      if (this.statusEl && this.statusEl.textContent !== text) {
        this.statusEl.textContent = text;
        if (announce && this.lastAnnounced !== text) {
          this.lastAnnounced = text;
        }
      }
    }
  }

  // 8. Component: RadarTelemetry (Matrix strip & floating cockpit HUD cards)
  class RadarTelemetry {
    constructor() {
      // Metric Strip elements
      this.valTarget = document.querySelector('[data-val-target]');
      this.valBairro = document.querySelector('[data-val-bairro]');
      this.valVeredito = document.querySelector('[data-val-veredito]');
      this.valDiff = document.querySelector('[data-val-diff]');

      // Animated numerical metrics
      const scoreEl = document.querySelector('[data-val-score]');
      const m2El = document.querySelector('[data-val-m2]');
      const latencyEl = document.querySelector('[data-val-latency]');

      this.metricScore = new AnimatedMetric(scoreEl, (v) => Math.round(v));
      this.metricM2 = new AnimatedMetric(m2El, (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`);
      this.metricLatency = new AnimatedMetric(latencyEl, (v) => `${Number(v).toFixed(1)}s`);

      // Floating Primary HUD Card
      this.hudIndex = document.querySelector('[data-hud-index]');
      this.hudName = document.querySelector('[data-hud-name]');
      this.hudTipologia = document.querySelector('[data-hud-tipologia]');
      this.hudPreco = document.querySelector('[data-hud-preco]');
      this.hudDoc = document.querySelector('[data-hud-doc]');
      this.hudGauge = document.querySelector('[data-hud-gauge]');

      const hudScoreEl = document.querySelector('[data-hud-score]');
      this.hudMetricScore = new AnimatedMetric(hudScoreEl, (v) => Math.round(v));

      // Floating Secondary HUD Card
      this.hudCommercial = document.querySelector('[data-hud-commercial]');
      this.hudDelta = document.querySelector('[data-hud-delta]');
    }

    update(targetData) {
      if (!targetData) return;

      // Update static text fields
      if (this.valTarget) this.valTarget.textContent = String(targetData.id).padStart(2, '0');
      if (this.valBairro) this.valBairro.textContent = targetData.name.toUpperCase();
      if (this.valVeredito) this.valVeredito.textContent = targetData.veredito;
      if (this.valDiff) this.valDiff.textContent = targetData.precoM2Diff;

      // Animate numbers smoothly
      this.metricScore.set(targetData.score);
      this.metricM2.set(targetData.precoM2);
      this.metricLatency.set(targetData.latency);

      // Primary HUD Card updates
      if (this.hudIndex) this.hudIndex.textContent = `#${String(targetData.id).padStart(2, '0')} / 04`;
      if (this.hudName) this.hudName.textContent = targetData.name;
      if (this.hudTipologia) this.hudTipologia.textContent = targetData.tipologia;
      if (this.hudPreco) this.hudPreco.textContent = targetData.preco;
      if (this.hudDoc) this.hudDoc.textContent = targetData.docStatus;

      this.hudMetricScore.set(targetData.score);

      // Radial Gauge offset calculation:
      // Circumference for r=18 is ~113.1. Offset = 113 - (113 * score / 100)
      if (this.hudGauge) {
        const offset = Math.max(0, 113 - (113 * (targetData.score / 100)));
        this.hudGauge.style.strokeDashoffset = offset.toFixed(1);
      }

      // Secondary HUD Card
      if (this.hudCommercial) this.hudCommercial.textContent = targetData.commercial;
      if (this.hudDelta) this.hudDelta.textContent = targetData.delta;
    }
  }

  // 9. Central Orchestrator: RadarController (State machine + RAF loop)
  class RadarController {
    constructor() {
      this.canvas = document.getElementById('radar-canvas');
      this.viewport = document.getElementById('radar-viewport');
      this.targetsContainer = document.getElementById('radar-targets-layer');

      if (!this.canvas || !this.viewport || !this.targetsContainer) return;

      this.map = new RadarMap(this.canvas, this.viewport);
      this.sweep = new RadarSweep(this.map);
      this.status = new DetectionStatus();
      this.telemetry = new RadarTelemetry();

      // Create target components
      this.targets = TARGETS_DATA.map((data) => new PropertyTarget(data, this.map, this.targetsContainer));

      // State machine tracking
      this.currentAngleDeg = 0;
      this.sweepSpeedDegPerSec = reduceMotion ? 18 : 38; // 38 deg/sec = ~9.4s full revolution
      this.activeTargetIndex = -1;
      this.activeTargetHoldUntil = 0;
      this.currentState = 'IDLE'; // IDLE | SCANNING | DETECTED | ANALYZING

      this.lastFrameTime = performance.now();
      this.isRunning = true;

      // Detection threshold: beam triggers target when within 4.5 degrees
      this.detectionThresholdDeg = 4.5;
      this.detectedCooldown = new Map(); // targetId -> timestamp

      this.initEvents();

      // Initial telemetry prime with first target
      this.telemetry.update(TARGETS_DATA[0]);

      // Start animation loop
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    initEvents() {
      // Pause when tab is not visible to conserve battery
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.isRunning = false;
        } else {
          this.isRunning = true;
          this.lastFrameTime = performance.now();
          requestAnimationFrame(this.loop);
        }
      });

      // Handle window resize (High DPI re-scaling)
      window.addEventListener('resize', () => {
        this.map.setupCanvas();
      }, { passive: true });

      // Click on targets directly focuses them
      this.targets.forEach((target, index) => {
        target.el.addEventListener('click', () => {
          this.triggerDetection(target, index, performance.now());
        });
      });
    }

    triggerDetection(target, index, now) {
      this.activeTargetIndex = index;
      this.activeTargetHoldUntil = now + 2400; // retain active status for 2.4s

      // Set target states
      this.targets.forEach((t, i) => t.setDetected(i === index));

      // Emit canvas echo ripple
      this.sweep.addEcho(target.x, target.y);

      // Update State Machine
      this.currentState = 'DETECTED';
      this.status.setStatus(`Alvo localizado · ${target.data.name}`, true);

      // Micro-transition into ANALYZING and update telemetry numbers
      setTimeout(() => {
        if (this.activeTargetIndex === index) {
          this.currentState = 'ANALYZING';
          this.status.setStatus(`Telemetria calibrada · ${target.data.name}`, false);
        }
      }, 700);

      // Push telemetry update
      this.telemetry.update(target.data);
    }

    loop(now) {
      if (!this.isRunning) return;

      const deltaSec = Math.min((now - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = now;

      // 1. Advance sweep beam angle
      this.currentAngleDeg = (this.currentAngleDeg + this.sweepSpeedDegPerSec * deltaSec) % 360;

      // 2. Update Azimuth telemetry readout
      this.status.setBearing(this.currentAngleDeg);

      // 3. Check for target beam crossing
      for (let i = 0; i < this.targets.length; i++) {
        const target = this.targets[i];
        const targetBearing = target.data.bearingDeg;

        // Angular distance accounting for 0°/360° boundary
        let diff = Math.abs(this.currentAngleDeg - targetBearing);
        if (diff > 180) diff = 360 - diff;

        const lastDetected = this.detectedCooldown.get(target.data.id) || 0;
        const cooldownPassed = (now - lastDetected) > 4000;

        if (diff <= this.detectionThresholdDeg && cooldownPassed) {
          this.detectedCooldown.set(target.data.id, now);
          this.triggerDetection(target, i, now);
          break;
        }
      }

      // 4. Release active target back to scanning state when hold expires
      if (this.activeTargetIndex !== -1 && now > this.activeTargetHoldUntil) {
        const prevTarget = this.targets[this.activeTargetIndex];
        if (prevTarget) prevTarget.setDetected(false);
        this.activeTargetIndex = -1;
        this.currentState = 'SCANNING';
        this.status.setStatus('Monitorando a sessão · Varredura ativa', false);
      }

      // 5. Render Canvas Sweep
      this.sweep.render(this.currentAngleDeg, now);

      requestAnimationFrame(this.loop);
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new RadarController());
  } else {
    new RadarController();
  }
})();
