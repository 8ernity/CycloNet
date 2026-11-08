import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('V6-014 offline navigation and external data never use cached authenticated responses',async()=>{
  const handlers={}; let reads=0;
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{
    self:{location:{origin:'https://cyclonet.test'},addEventListener:(key,fn)=>handlers[key]=fn},
    caches:{match:async()=>{reads++;return new Response('private cached dashboard');}},
    fetch:async()=>{throw new Error('offline');},URL,Response
  });
  for(const url of ['https://cyclonet.test/dashboard','https://clerk.test/session','https://cyclonet.test/api/active']) {
    let response;
    handlers.fetch({request:new Request(url),respondWith:p=>{response=p;}});
    if(response) assert.equal((await response).status,503);
  }
  assert.equal(reads,0);
});
