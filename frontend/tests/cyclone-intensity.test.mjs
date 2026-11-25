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

test('IMD classification covers exact meteorological boundaries consistently', () => {
  assert.equal(intensity.classifyImdCategory(null), 'Not available');
  assert.equal(intensity.classifyImdCategory(Number.NaN), 'Not available');
  assert.equal(intensity.classifyImdCategory(20), 'Depression');
  assert.equal(intensity.classifyImdCategory(28), 'Deep Depression');
  assert.equal(intensity.classifyImdCategory(33), 'Deep Depression');
  assert.equal(intensity.classifyImdCategory(34), 'Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(47), 'Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(48), 'Severe Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(63), 'Severe Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(64), 'Very Severe Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(89), 'Very Severe Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(90), 'Extremely Severe Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(119), 'Extremely Severe Cyclonic Storm');
  assert.equal(intensity.classifyImdCategory(120), 'Super Cyclonic Storm');
});

test('Saffir-Simpson (JTWC) classification handles missing and boundary winds', () => {
  assert.equal(intensity.classifyJtwcCategory(undefined), 'Not available');
  assert.equal(intensity.classifyJtwcCategory(33), 'Tropical Depression');
  assert.equal(intensity.classifyJtwcCategory(34), 'Tropical Storm');
  assert.equal(intensity.classifyJtwcCategory(64), 'Category 1 Cyclone');
  assert.equal(intensity.classifyJtwcCategory(137), 'Category 5 Super Cyclone');
});

test('knotsToKmh, colors, badges, and abbreviations handle null and boundary inputs', () => {
  assert.equal(intensity.knotsToKmh(null), null);
  assert.equal(intensity.knotsToKmh(Number.POSITIVE_INFINITY), null);
  assert.equal(intensity.knotsToKmh(100), 185);
  assert.equal(intensity.getIntensityColor(null), '#94a3b8');
  assert.equal(intensity.getIntensityColor(64), '#f59e0b');
  assert.equal(intensity.getIntensityColor(90), '#ef4444');
  assert.equal(intensity.getCategoryAbbr('Very Severe Cyclonic Storm', 64), 'VSCS');
  assert.equal(intensity.getCategoryAbbr('', null), 'Not available');
  assert.match(intensity.getCategoryBadgeClass(64), /amber/);
});
