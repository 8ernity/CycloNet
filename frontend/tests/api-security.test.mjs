import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadApi() {
  const code = ts.transpileModule(fs.readFileSync('src/lib/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const stored = new Map(); const calls = [];
  const storage = { getItem: k => stored.get(k) ?? null, setItem: (k,v) => stored.set(k,v), removeItem: k => stored.delete(k) };
  const context = { exports: {}, process: {env:{NODE_ENV:'production',NEXT_PUBLIC_API_URL:'https://api.cyclonet.test'}},
    window: {location:{origin:'https://cyclonet.test'}}, localStorage:storage, sessionStorage:storage,
    URL, Headers, AbortController, AbortSignal, setTimeout, clearTimeout, console,
    fetch: async (...args) => { calls.push(args); return new Response('{}', {headers:{'Content-Type':'application/json'}}); } };
  vm.runInNewContext(code, context);
  return { api:context.exports, calls, stored };
}
test('production credentials stay on explicitly trusted HTTPS origins', async () => {
  const {api,calls}=loadApi();
  api.setAuthTokenProvider(async ()=>'short-lived-clerk-token');
  await api.apiFetch('/api/ingest/sync',{method:'POST'});
  assert.equal(calls[0][1].headers.get('Authorization'),'Bearer short-lived-clerk-token');
  await api.apiFetch('https://untrusted.test/api',{headers:{Authorization:'Bearer secret','X-Admin-Key':'secret'}, credentials:'include'});
  assert.equal(calls[1][1].headers.get('Authorization'),null);
  assert.equal(calls[1][1].headers.get('X-Admin-Key'),null);
  assert.equal(calls[1][1].credentials,'omit');
  assert.equal(calls[1][1].redirect,'error');
  assert.equal(api.isTrustedOrigin('http://localhost:8000'),false);
  assert.equal(api.isTrustedOrigin('https://api.cyclonet.test.evil.test'),false);
});
test('tokens are never persisted in browser storage',()=>{
  const {api,stored}=loadApi(); stored.set('cyclonet_auth_token','old-secret');
  api.setStoredAuthToken('session-token',true);
  assert.equal(stored.has('cyclonet_auth_token'),false);
  assert.equal(api.getStoredAuthToken(),'session-token');
  api.clearStoredAuthToken(); assert.equal(api.getStoredAuthToken(),null);
});
