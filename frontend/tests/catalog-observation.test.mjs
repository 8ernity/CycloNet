import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/catalogObservation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {catalogObservation}=context.exports;

test('missing and malformed historical wind never becomes a category-derived measurement',()=>{
  for(const knots of [null,undefined,NaN,Infinity,-1,'100',{},true]) {
    assert.equal(catalogObservation({id:'historical',name:'Record',knots,max_category:'Super Cyclone'}).knots,null);
  }
});
test('zero and stale historical measurements remain unchanged',()=>{
  for(const knots of [0,35,140]) {
    assert.equal(catalogObservation({id:'historical',name:'Record',knots,is_stale:true,year:'1999'}).knots,knots);
  }
});
test('missing category and basin cannot become claimed source facts',()=>{
  const result=catalogObservation({id:'historical',name:'Record'});
  assert.equal(result.category,'Not available');
  assert.equal(result.basin,'Not available');
});
