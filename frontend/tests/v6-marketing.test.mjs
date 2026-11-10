import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function render(name) {
  const context={exports:{},require:dep=>{
    if(dep==='react') return React;
    if(dep==='lucide-react') return new Proxy({},{get:()=>()=>null});
    if(dep==='framer-motion') return {motion:new Proxy({},{get:()=>({children})=>React.createElement('div',null,children)})};
    if(dep.includes('useCountUp')) return {useCountUp:value=>({count:value,ref:null})};
    if(dep.includes('motion-tokens')) return {useMotionTokens:()=>({tier1:{},tier1Variants:{}})};
    if(dep.includes('StatTile')) return {StatTile:props=>React.createElement('div',null,props.value,props.label)};
    if(dep.includes('MicroLabel')) return {MicroLabel:props=>React.createElement('div',null,props.children)};
    if(dep.includes('GlassPanel')) return {GlassPanel:props=>React.createElement('div',null,props.children)};
    return require(dep);
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/components/landing/${name}.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,context);
  return renderToStaticMarkup(React.createElement(context.exports[name]));
}
test('landing page makes no unsupported service benchmarks or official integration claims',()=>{
  const html=['StatsTicker','TrustMarquee','IntegrationsGrid'].map(render).join('');
  assert.doesNotMatch(html,/99\.9|12ms|Integrated with Leading|NDMA \/ SDMA Dispatches|INSAT-3DR Real-Time Streams|7-Language Briefings/);
  assert.match(html,/Not measured|Not validated/);
});
