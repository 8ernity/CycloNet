import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(fetch) {
  const timers = new Map(); let timerId = 0;
  const context = {exports:{}, process:{env:{NODE_ENV:'production',NEXT_PUBLIC_API_URL:'https://api.cyclonet.test'}},
    URL, Headers, AbortController, AbortSignal, DOMException, console,
    setTimeout: fn => {const id=++timerId;timers.set(id,fn);return id;}, clearTimeout:id=>timers.delete(id), fetch};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/api.ts','utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {api:context.exports,timers,fire:()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}
const settle = async () => {for(let i=0;i<15;i++) await Promise.resolve();};
const abortable = signal => new Promise((_,reject)=>{
  if(signal.aborted) reject(signal.reason);
  else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
});

test('JSON body consumption remains inside the request timeout',async()=>{
  const h=harness(async(_,options)=>({ok:true,status:200,json:()=>abortable(options.signal)}));
  const pending=h.api.apiFetch('/api/test',{maxRetries:0});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  await settle();
  assert.equal(h.timers.size,1,'body must retain its deadline after headers');
  h.fire(); await rejected;
  assert.equal(h.timers.size,0);
});

test('an already cancelled request performs no token lookup or network request',async()=>{
  let fetched=0,tokens=0;
  const h=harness(async()=>{fetched++;return new Response('{}');});
  h.api.setAuthTokenProvider(async()=>{tokens++;return 'fixture';});
  const controller=new AbortController();controller.abort();
  await assert.rejects(h.api.apiFetch('/api/test',{signal:controller.signal}),{name:'AbortError'});
  assert.equal(tokens,0);assert.equal(fetched,0);assert.equal(h.timers.size,0);
});

test('caller cancellation stops an in-flight request without retrying',async()=>{
  let fetched=0;
  const h=harness(async(_,options)=>{fetched++;return abortable(options.signal);});
  const controller=new AbortController();
  const pending=h.api.apiFetch('/api/test',{signal:controller.signal});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  await settle();controller.abort();await settle();
  assert.equal(h.timers.size,0,'cancelled requests must not schedule retry delays');
  await rejected;assert.equal(fetched,1);
});

test('cancellation interrupts server-error backoff and removes its timer',async()=>{
  let fetched=0;
  const h=harness(async()=>{fetched++;return {ok:false,status:503,statusText:'Unavailable',json:async()=>({detail:'Unavailable'})};});
  const controller=new AbortController();
  const pending=h.api.apiFetch('/api/test',{signal:controller.signal});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  await settle();controller.abort();await settle();
  assert.equal(h.timers.size,0,'backoff must be cancellable');
  await rejected;assert.equal(fetched,1);
});

test('a transient GET failure retries successfully but a POST is never replayed',async()=>{
  let calls=0;
  const h=harness(async()=>{if(++calls===1) throw new TypeError('Network failure');return {ok:true,status:200,json:async()=>({ok:true})};});
  const pending=h.api.apiFetch('/api/test');await settle();
  assert.equal(h.timers.size,1);h.fire();
  assert.deepEqual(await pending,{ok:true});assert.equal(calls,2);assert.equal(h.timers.size,0);
  const mutation=harness(async()=>{throw new TypeError('Network failure');});
  await assert.rejects(mutation.api.apiFetch('/api/test',{method:'POST'}),/Network failure/);
  assert.equal(mutation.timers.size,0);
});

test('fetch helper combines caller cancellation with its own header deadline',async()=>{
  const h=harness(async(_,options)=>abortable(options.signal));
  const controller=new AbortController();
  const pending=h.api.fetchWithTimeout('https://api.cyclonet.test',{signal:controller.signal});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  let completed=false;
  void rejected.then(()=>{completed=true;});
  h.fire();await settle();
  assert.equal(h.timers.size,0);
  assert.equal(completed,true,'the helper deadline must still apply when a caller signal exists');
  await rejected;
});
