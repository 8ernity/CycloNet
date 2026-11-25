import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadModule(relPath, mocks = {}) {
  const code = fs.readFileSync(relPath, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const customRequire = (spec) => {
    if (spec in mocks) return mocks[spec];
    return require(spec);
  };
  vm.runInNewContext(compiled, { exports: mod.exports, module: mod, require: customRequire });
  return mod.exports;
}

const intensity = loadModule('src/lib/cycloneIntensity.ts');
const forecast = loadModule('src/features/forecast/utils/forecastTransforms.ts', {
  '@/lib/cycloneIntensity': intensity,
});

const passthroughConverters = {
  getConvertedKnots: (k) => k ?? null,
  getConvertedKmh: (k) => (k == null ? null : Math.round(k * 1.852)),
  getConvertedCategory: (k) => intensity.classifyImdCategory(k),
};

test('chart scaling handles single-point tracks and nonfinite values cleanly', () => {
  assert.equal(Number.isFinite(forecast.getChartX(0, 1)), true);
  assert.equal(Number.isFinite(forecast.getChartX(0, 0)), true);
  assert.ok(Number.isNaN(forecast.getChartY(null)));
  assert.ok(Number.isNaN(forecast.getChartY(Number.NaN)));
  assert.equal(forecast.getChartY(140), forecast.CHART_GEOMETRY.padT);
});

test('buildForecastChartData and buildForecastTableRows preserve missing winds without fabrication', () => {
  const track = [
    { lat: 14.0, lon: 84.0, time_offset_hours: -12, category: 'Deep Depression', intensity_knots: null, is_forecast: false },
    { lat: 15.2, lon: 83.4, time_offset_hours: 0, category: 'Cyclonic Storm', intensity_knots: 40, is_forecast: false },
    { lat: 16.5, lon: 82.8, time_offset_hours: 12, category: 'Severe Cyclonic Storm', intensity_knots: 55, is_forecast: true, is_landfall: true, provenance: 'EXPERIMENTAL_FORECAST' },
  ];
  const chart = forecast.buildForecastChartData(track, passthroughConverters);
  assert.equal(chart.length, 3);
  assert.equal(chart[0].intensity, null);
  assert.equal(chart[0].kmh, null);
  assert.equal(chart[1].label, '0h (Source reference)');
  assert.equal(chart[2].label, '+12h');

  const rows = forecast.buildForecastTableRows(track, passthroughConverters);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].time_offset_hours, 0);
  assert.equal(rows[1].is_landfall, true);
  assert.equal(rows[1].kmh, 102);
  assert.equal(forecast.buildUncertaintyPath(chart), '');
});
