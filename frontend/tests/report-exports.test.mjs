import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadTs(relPath, mocks = {}) {
  const code = fs.readFileSync(relPath, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const customRequire = (spec) => (spec in mocks ? mocks[spec] : require(spec));
  vm.runInNewContext(compiled, { exports: mod.exports, module: mod, require: customRequire });
  return mod.exports;
}

const infra = loadTs('src/lib/infrastructureData.ts');
const reportExports = loadTs('src/features/reports/utils/reportExports.ts', {
  '@/lib/infrastructureData': infra,
});

test('computeAlertSummary handles unavailable wind and threshold boundaries', () => {
  assert.equal(reportExports.computeAlertSummary(null).level, 'DATA_UNAVAILABLE');
  assert.equal(reportExports.computeAlertSummary(Number.NaN).level, 'DATA_UNAVAILABLE');
  assert.equal(reportExports.computeAlertSummary(25).level, 'GREEN');
  assert.equal(reportExports.computeAlertSummary(34).level, 'YELLOW');
  assert.equal(reportExports.computeAlertSummary(48).level, 'ORANGE');
  assert.equal(reportExports.computeAlertSummary(95).level, 'ORANGE');
  assert.equal(reportExports.computeAlertSummary(120).level, 'RED');
});

test('buildJsonReportPayload explicitly tags illustrative infrastructure and insurance sections as simulation', () => {
  const payload = reportExports.buildJsonReportPayload({
    reportMode: 'EXPERIMENTAL_ANALYSIS',
    sourceBadge: { shortLabel: 'IMD', desc: 'IMD 3-min' },
    system: { id: 'BOB03-2020', name: 'Cyclone Amphan', basin: 'Bay of Bengal', lat: 19.8, lon: 87.6, intensity_knots: 100, category: 'ESCS', track_forecast: [] },
    alertInfo: reportExports.computeAlertSummary(100),
    bulletins: [],
    affectedDistricts: [],
    portSignals: [],
  });
  assert.equal(payload.infrastructureExposure.is_simulation, true);
  assert.equal(payload.parametricInsuranceTriggers.is_simulation, true);
  assert.match(payload.disclaimer, /Not an official warning/i);
});
