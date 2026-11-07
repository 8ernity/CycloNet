import { jsPDF as JsPDF } from 'jspdf';
import * as autoTableModule from 'jspdf-autotable';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
test('PDF preserves source provenance and missing measurements',()=>{
  let pdf;
  const Original=JsPDF;
  function Captured(options) { pdf=new Original(options); pdf.save=()=>{}; return pdf; }
  Captured.API=Original.API;
  const context={exports:{},console,Date,setTimeout,require:name=>name==='jspdf'?{__esModule:true,default:Captured}:{__esModule:true, ...autoTableModule, default:autoTableModule.autoTable}};
  const code=ts.transpileModule(fs.readFileSync('src/lib/pdfReportGenerator.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,context);
  context.exports.generateCyclonePdfReport({system:{name:'Fixture',category:'Unknown',intensity_knots:null,central_pressure_hpa:null,source:'Verified fixture source',observation_time_utc:null,retrieved_at:'2026-11-07T00:00:00Z',is_simulation:false},sourceInfo:{label:'Verified fixture source'}});
  const output=pdf.output();
  assert.match(output,/Verified fixture source/);
  assert.match(output,/Not available/);
  assert.match(output,/2026-11-07/);
  assert.doesNotMatch(output,/INDIA METEOROLOGICAL DEPARTMENT/);
  assert.doesNotMatch(output,/\(0 kt\)/i);
});
