import http from 'http';

const BASE_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CONCURRENCY = Number(process.env.CONCURRENCY) || 10;
const DURATION_MS = Number(process.env.DURATION) || 10000;
const TOKEN = process.env.AUTH_TOKEN || '';

interface BenchResult {
  endpoint: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  rps: number;
}

async function makeRequest(path: string): Promise<number> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    };

    const req = http.request(options, (res) => {
      res.resume();
      res.on('end', () => resolve(Date.now() - start));
    });
    req.on('error', () => reject(new Error('request failed')));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function benchmark(endpoint: string, durationMs: number, concurrency: number): Promise<BenchResult> {
  const latencies: number[] = [];
  let errors = 0;
  const end = Date.now() + durationMs;

  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() < end) {
      try {
        const ms = await makeRequest(endpoint);
        latencies.push(ms);
      } catch {
        errors++;
      }
    }
  });

  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const total = latencies.length + errors;
  const avg = latencies.length > 0 ? latencies.reduce((s, v) => s + v, 0) / latencies.length : 0;

  return {
    endpoint,
    totalRequests: total,
    successCount: latencies.length,
    errorCount: errors,
    avgLatencyMs: Math.round(avg),
    p50Ms: latencies[Math.floor(latencies.length * 0.5)] || 0,
    p95Ms: latencies[Math.floor(latencies.length * 0.95)] || 0,
    p99Ms: latencies[Math.floor(latencies.length * 0.99)] || 0,
    rps: Math.round(total / (durationMs / 1000)),
  };
}

async function main() {
  console.log(`\nBookIsle Performance Benchmark`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}, Duration: ${DURATION_MS}ms\n`);

  const endpoints = [
    '/api/health',
    '/api/books?page=1&limit=20',
    '/api/search?q=test',
    '/api/progress',
    '/api/stats/summary',
  ];

  const results: BenchResult[] = [];

  for (const endpoint of endpoints) {
    process.stdout.write(`Testing ${endpoint}... `);
    const result = await benchmark(endpoint, DURATION_MS, CONCURRENCY);
    results.push(result);
    console.log(`${result.rps} rps, p95=${result.p95Ms}ms`);
  }

  console.log('\n--- Summary ---');
  console.log('Endpoint'.padEnd(35) + 'RPS'.padStart(8) + 'Avg'.padStart(8) + 'P95'.padStart(8) + 'P99'.padStart(8) + 'Errors'.padStart(8));
  for (const r of results) {
    console.log(
      r.endpoint.padEnd(35) +
      String(r.rps).padStart(8) +
      `${r.avgLatencyMs}ms`.padStart(8) +
      `${r.p95Ms}ms`.padStart(8) +
      `${r.p99Ms}ms`.padStart(8) +
      String(r.errorCount).padStart(8)
    );
  }

  const failedChecks: string[] = [];
  for (const r of results) {
    if (r.endpoint.includes('health') && r.p95Ms > 50) failedChecks.push(`${r.endpoint} p95 > 50ms`);
    if (r.endpoint.includes('progress') && r.p95Ms > 100) failedChecks.push(`${r.endpoint} p95 > 100ms`);
    if (r.endpoint.includes('search') && r.p95Ms > 200) failedChecks.push(`${r.endpoint} p95 > 200ms`);
  }

  if (failedChecks.length > 0) {
    console.log('\n⚠ Performance checks failed:');
    failedChecks.forEach((c) => console.log(`  - ${c}`));
    process.exit(1);
  } else {
    console.log('\n✓ All performance checks passed');
  }
}

main().catch(console.error);
