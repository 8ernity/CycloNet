import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function renderDashboard(system = null) {
  const effects = [];
  const ingest = {status:'degraded',basin_status:'STATUS_UNCERTAIN',last_sync:null,
    sources_status:{IMD_RSMC:'FAILED',JTWC_NOAA:'STALE'}};
  // Exercise actual page rendering and its assistant-context effect with fixed input state.
  const states = [system, false, false, ingest, false, []];
  const context = {exports:{}, window:{}, console, URL,
    require: name => {
      if (name === 'react') return {...React, useState: initial => [states.length ? states.shift() : initial, () => {}],
        useEffect: fn => effects.push(fn), useRef: value => ({current:value})};
      if (name === 'next/dynamic') return () => () => null;
      if (name === 'lucide-react') return new Proxy({}, {get: () => () => null});
      if (name.includes('useActiveCyclone')) return {useActiveCyclone:()=>({selectedCycloneId:null})};
      if (name.includes('useDataSource')) return {useDataSource:()=>({
        getConvertedKnots:x=>x, getConvertedKmh:x=>x, getConvertedGusts:x=>x,
        getConvertedCategory:(_,category)=>category, getSourceBadge:()=>({shortLabel:'IMD',avgWindow:'3 minutes'})})};
      if (name.includes('useCycloneWebSocket')) return {useCycloneWebSocket:()=>({isConnected:false,radarAngle:0})};
      if (name.includes('LanguageContext')) return {useLanguage:()=>({t:x=>x})};
      if (name.startsWith('@/')) return {};
      return require(name);
    }};
  const code = ts.transpileModule(fs.readFileSync('src/app/dashboard/page.tsx','utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,context);
  const html = renderToStaticMarkup(context.exports.default());
  effects.at(-1)();
  return {html, assistant:context.window.__cyclonet_current_context};
}

test('dashboard outage rendering never invents healthy feeds, calm or wind observations', () => {
  const {html,assistant} = renderDashboard();
  assert.doesNotMatch(html,/basin calm|basin quiet|feeds nominal|15 - 25 km\/h|Beaufort Scale 3|: Online/i);
  assert.match(html,/IMD RSMC: FAILED/);
  assert.match(html,/JTWC\/NOAA: STALE/);
  assert.equal(assistant.basin_status,'STATUS_UNCERTAIN');
});

test('stale current-year source observations never render as drills or verified live', () => {
  const {html,assistant} = renderDashboard({id:'LIVE-IMD-2026-01',name:'Retained storm',
    lat:15,lon:85,category:'Unclassified',intensity_knots:null,is_live_telemetry:true,
    is_stale:true,reconciliation_status:'ACTIVE_STALE',is_simulation:false,track_forecast:[]});
  assert.match(html,/STALE SOURCE OBSERVATION/);
  assert.doesNotMatch(html,/SYNTHETIC DRILL|LIVE SURVEILLANCE|Live verified/);
  assert.equal(assistant.isSimulation,false);
});
