import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/infrastructureData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const infra=context.exports;

test('V6-001 missing field observations cannot become shelter readiness',()=>{
  const result=infra.calculateShelterSuitability(infra.MEDICAL_SHELTERS[0],100);
  assert.equal(result.currentOccupancy,null);
  assert.equal(result.roadAccessStatus,null);
  assert.equal(result.powerBackupStatus,null);
  assert.equal(result.isRecommendedDestination,false);
});
test('V6-002 route scenarios never assert actual road state or emergency orders',()=>{
  for(const wind of [0,85,140]) {
    const result=infra.calculateRouteVulnerability(infra.EVACUATION_ROUTES[0],wind,5,300);
    assert.equal(result.observed_road_status.value,'UNKNOWN');
    assert.doesNotMatch(JSON.stringify(result),/ROAD CLOSED|SAFE EVACUATION|Path Open|Close toll|divert traffic|Restricted to heavy/i);
  }
});
test('V6-010 illustrative substations never issue utility switching orders',()=>{
  const result=infra.calculateSubstationVulnerability(infra.POWER_SUBSTATIONS[0],140,8,400);
  assert.doesNotMatch(result.recommendedAction,/De-energize|Switch municipal|Erect mobile|verify 6-hour/i);
});

test('authorized observations expire and simulated values cannot authorize destinations',()=>{
  const now=Date.parse('2026-11-08T00:00:00Z');
  const field=value=>({value,source:'Authorized fixture',verified_at:'2026-11-07T23:00:00Z',expires_at:'2026-11-08T01:00:00Z',verification_status:'VERIFIED',authorized:true});
  const observations={capacity:field(100),occupancy:field(60),medicalBeds:field(5),road:field('OPEN'),generator:field('OPERATIONAL'),destinationApproval:field(true)};
  const verified=infra.calculateShelterSuitability(infra.MEDICAL_SHELTERS[0],0,observations,now);
  assert.equal(verified.availableCapacity,40);
  assert.equal(verified.isRecommendedDestination,true);
  assert.equal(verified.observations.occupancy.source,'Authorized fixture');
  assert.equal(infra.calculateShelterSuitability(infra.MEDICAL_SHELTERS[0],0,observations,now+7200000).isRecommendedDestination,false);
  observations.occupancy.verification_status='SIMULATED';
  assert.equal(infra.calculateShelterSuitability(infra.MEDICAL_SHELTERS[0],0,observations,now).currentOccupancy,null);
  assert.equal(infra.simulateShelterScenario(100,60).isRecommendedDestination,false);
});

test('verified fixture renders value with source and validity timestamps; expired value renders unavailable',()=>{
  const require=createRequire(import.meta.url);
  const ctx={exports:{},require:name=>name.includes('infrastructureData')?infra:require(name)};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ObservationValue.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,ctx);
  const attribute={value:60,source:'Authorized fixture',verified_at:'2026-11-07T23:00:00Z',expires_at:'2026-11-08T01:00:00Z',authorized:true,verification_status:'VERIFIED'};
  const render=now=>renderToStaticMarkup(React.createElement(ctx.exports.ObservationValue,{attribute,now:Date.parse(now)}));
  assert.match(render('2026-11-08T00:00:00Z'),/60.*Authorized fixture.*2026-11-07T23:00:00Z.*2026-11-08T01:00:00Z/);
  assert.equal(render('2026-11-08T02:00:00Z'),'<span>Unavailable</span>');
});
