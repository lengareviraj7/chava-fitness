import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const serverDir = path.resolve(__dirname, '..');

const SUITES = [
  {
    name: 'Static Money & Calculation Audit',
    command: 'node server/scripts/audit-money-static.js',
    cwd: rootDir,
    target: '0 float ops, 0 duplicate formulas'
  },
  {
    name: 'Core Auth, Product & Offline Flag',
    command: 'npx vitest run tests/money.test.js tests/auth.test.js tests/product.test.js tests/offlineFlag.test.js',
    cwd: serverDir,
    target: '100% tests passing'
  },
  {
    name: 'Calculator Byte Parity & Concurrency',
    command: 'npx vitest run tests/calculatorByteParity.test.js tests/concurrency.test.js tests/failpoint.test.js',
    cwd: serverDir,
    target: 'Byte match SHA-256 + 50-thread stock'
  },
  {
    name: '30-Day Multi-User Simulation Oracle',
    command: 'npx vitest run tests/simulation/sim.test.js',
    cwd: serverDir,
    target: 'Seeds 42, 101, 2026 balanced ledgers'
  },
  {
    name: 'Security, Permissions & Staff Leak Scan',
    command: 'npx vitest run tests/routePolicy.test.js',
    cwd: serverDir,
    target: 'Security headers + 0 staff leaks'
  },
  {
    name: 'Cross-Feature Interactions',
    command: 'npx vitest run tests/interactions.test.js',
    cwd: serverDir,
    target: 'i18n, PO, photos, outbox matrix'
  },
  {
    name: 'Performance & Latency Benchmarks',
    command: 'npx vitest run tests/performance.test.js',
    cwd: serverDir,
    target: '100-cart <50ms, search <50ms'
  },
  {
    name: 'Disaster Recovery & In-Memory RTO',
    command: 'npx vitest run tests/disasterRecovery.test.js',
    cwd: serverDir,
    target: 'RTO <1ms in-memory, 100% doc match'
  },
  {
    name: 'Operational Health Probe',
    command: 'node server/scripts/healthCheck.js',
    cwd: rootDir,
    target: '6 operational fault types evaluated'
  },
  {
    name: 'Migration Hygiene & Index Explains',
    command: 'npx vitest run tests/migrationHygiene.test.js',
    cwd: serverDir,
    target: '0 COLLSCAN, indexes idempotent'
  },
  {
    name: 'Client Production Build & Bundle Budget',
    command: 'npm run build:client',
    cwd: rootDir,
    target: 'Gzipped JS < 300 KB budget'
  }
];

async function runVerification() {
  console.log('\n================================================================================');
  console.log('       CHAVA FITNESS CLUB ERP - MASTER RELEASE VERIFICATION SUITE              ');
  console.log('================================================================================\n');

  const startTime = Date.now();
  const results = [];
  let allPassed = true;

  for (const suite of SUITES) {
    process.stdout.write(`▶ Running: ${suite.name.padEnd(45)} ... `);
    const suiteStart = Date.now();
    try {
      execSync(suite.command, {
        cwd: suite.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });
      const duration = ((Date.now() - suiteStart) / 1000).toFixed(2);
      console.log(`✅ PASS (${duration}s)`);
      results.push({
        name: suite.name,
        target: suite.target,
        status: 'PASS',
        duration: `${duration}s`
      });
    } catch (err) {
      const duration = ((Date.now() - suiteStart) / 1000).toFixed(2);
      console.log(`❌ FAIL (${duration}s)`);
      allPassed = false;
      const errorOutput = err.stderr ? err.stderr.toString() : err.stdout ? err.stdout.toString() : err.message;
      results.push({
        name: suite.name,
        target: suite.target,
        status: 'FAIL',
        duration: `${duration}s`,
        error: errorOutput.slice(0, 500)
      });
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n\n================================================================================');
  console.log('                          FINAL VERIFICATION SUMMARY                            ');
  console.log('================================================================================\n');

  console.log('| #  | Verification Suite Area                      | Target / Criteria                    | Status  | Time   |');
  console.log('|----|----------------------------------------------|--------------------------------------|---------|--------|');
  results.forEach((r, idx) => {
    const num = String(idx + 1).padEnd(2);
    const name = r.name.padEnd(44);
    const target = r.target.padEnd(36);
    const status = (r.status === 'PASS' ? '✅ PASS' : '❌ FAIL').padEnd(7);
    const dur = r.duration.padStart(6);
    console.log(`| ${num} | ${name} | ${target} | ${status} | ${dur} |`);
  });
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Verification Execution Time: ${totalDuration}s`);
  console.log(`Overall Result: ${allPassed ? '🎉 ALL SUITES PASSED - READY FOR PRODUCTION v1.0.0' : '⚠️ SOME SUITES FAILED'}\n`);

  if (!allPassed) {
    console.log('--- Failure Details ---');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`\n[${r.name}] Error:\n${r.error}`);
    });
    process.exit(1);
  }
}

runVerification();
