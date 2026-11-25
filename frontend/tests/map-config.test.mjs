import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadModule(relPath) {
  const code = fs.readFileSync(relPath, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const leafletStub = { default: { Icon: { Default: { mergeOptions() {} } } } };
  const customRequire = (spec) => (spec === 'leaflet' ? leafletStub : require(spec));
  vm.runInNewContext(compiled, { exports: mod.exports, module: mod, require: customRequire });
  return mod.exports;
}

const mapConfig = loadModule('src/components/map/mapConfig.ts');

test('getGibsDate always resolves the previous UTC calendar day across midnight boundaries', () => {
  assert.equal(mapConfig.getGibsDate(new Date('2026-11-25T00:01:00Z')), '2026-11-24');
  assert.equal(mapConfig.getGibsDate(new Date('2026-03-01T12:00:00Z')), '2026-02-28');
});

test('getMapStyles injects computed GIBS date into NASA VIIRS tile URL', () => {
  const styles = mapConfig.getMapStyles(new Date('2026-11-25T10:00:00Z'));
  assert.ok(styles.nasa_viirs);
  assert.match(styles.nasa_viirs.url, /\/2026-11-24\/GoogleMapsCompatible/);
  assert.deepEqual(Object.keys(styles), ['satellite', 'nasa_viirs', 'dark', 'street']);
});
