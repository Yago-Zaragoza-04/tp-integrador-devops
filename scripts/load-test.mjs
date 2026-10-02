#!/usr/bin/env node
/**
 * Generador de tráfico para mover las tres golden signals (tráfico, latencia y errores).
 *
 *   TARGET_URL=http://localhost:3000 DURATION_S=120 RPS=10 CHAOS_RATIO=0.05 node scripts/load-test.mjs
 *
 * Mezcla: CRUD válido, 404 (ids inexistentes), 400 (payloads inválidos) y, si el destino tiene
 * CHAOS_ENABLED=true, 5xx y respuestas lentas en la proporción CHAOS_RATIO.
 */
import { randomUUID } from 'node:crypto';

const TARGET_URL = (process.env.TARGET_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const DURATION_S = Number(process.env.DURATION_S ?? 60);
const RPS = Number(process.env.RPS ?? 5);
const CHAOS_RATIO = Number(process.env.CHAOS_RATIO ?? 0);
const REPORT_EVERY_MS = 10_000;

if (!(DURATION_S > 0 && RPS > 0 && CHAOS_RATIO >= 0 && CHAOS_RATIO <= 1)) {
  console.error('Parámetros inválidos: DURATION_S > 0, RPS > 0 y 0 <= CHAOS_RATIO <= 1');
  process.exit(2);
}

const knownIds = [];
const stats = { byStatus: new Map(), latencies: [], networkErrors: 0 };
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const scenarios = [
  { weight: 40, run: () => call('/api/v1/tasks') },
  {
    weight: 20,
    run: async () => {
      const res = await call('/api/v1/tasks', json({ title: `tarea ${Date.now()}`, description: 'generada por load-test' }));
      if (res?.status === 201) knownIds.push((await res.json()).id);
    },
  },
  { weight: 10, run: () => (knownIds.length ? call(`/api/v1/tasks/${pick(knownIds)}`) : call('/api/v1/tasks')) },
  {
    weight: 5,
    run: () =>
      knownIds.length
        ? call(`/api/v1/tasks/${pick(knownIds)}`, { ...json({ title: 'editada', description: '', done: true }), method: 'PUT' })
        : call('/api/v1/tasks'),
  },
  {
    weight: 5,
    run: () => (knownIds.length ? call(`/api/v1/tasks/${knownIds.shift()}`, { method: 'DELETE' }) : call('/health')),
  },
  { weight: 8, run: () => call(`/api/v1/tasks/${randomUUID()}`) }, // 404
  { weight: 7, run: () => call('/api/v1/tasks', json({ title: '', extra: true })) }, // 400
];
const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);

function chooseScenario() {
  if (Math.random() < CHAOS_RATIO) {
    return Math.random() < 0.5
      ? () => call('/api/v1/chaos/error')
      : () => call(`/api/v1/chaos/latency?ms=${200 + Math.floor(Math.random() * 2300)}`);
  }
  let roll = Math.random() * totalWeight;
  for (const scenario of scenarios) {
    roll -= scenario.weight;
    if (roll <= 0) return scenario.run;
  }
  return scenarios[0].run;
}

async function call(path, init = {}) {
  const started = performance.now();
  try {
    const res = await fetch(`${TARGET_URL}${path}`, { ...init, signal: AbortSignal.timeout(10_000) });
    stats.latencies.push(performance.now() - started);
    stats.byStatus.set(res.status, (stats.byStatus.get(res.status) ?? 0) + 1);
    return res;
  } catch {
    stats.networkErrors += 1;
    return undefined;
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function report(label) {
  const total = [...stats.byStatus.values()].reduce((a, b) => a + b, 0);
  const statuses = [...stats.byStatus.entries()].sort(([a], [b]) => a - b).map(([s, n]) => `${s}:${n}`).join(' ');
  console.log(
    `[${label}] requests=${total} ${statuses} net_errors=${stats.networkErrors} ` +
      `p50=${percentile(stats.latencies, 50).toFixed(1)}ms p95=${percentile(stats.latencies, 95).toFixed(1)}ms`,
  );
}

console.log(`load-test → ${TARGET_URL} durante ${DURATION_S}s a ${RPS} req/s (chaos ${CHAOS_RATIO * 100}%)`);
const inFlight = new Set();
const ticker = setInterval(() => {
  const promise = chooseScenario()().finally(() => inFlight.delete(promise));
  inFlight.add(promise);
}, 1000 / RPS);
const reporter = setInterval(() => report('parcial'), REPORT_EVERY_MS);

setTimeout(async () => {
  clearInterval(ticker);
  clearInterval(reporter);
  await Promise.allSettled([...inFlight]);
  report('final');
}, DURATION_S * 1000);
