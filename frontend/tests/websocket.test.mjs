import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function mountStream() {
  const effects = [], sockets = [], listeners = new Map(), timers = new Map();
  let base = 'https://staging-api.example', timerId = 0;
  const react = { useState: value => [value, () => {}], useRef: value => ({current:value}),
    useCallback: fn => fn, useEffect: fn => effects.push(fn) };
  class Socket {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; }
  }
  const context = { exports: {}, process: {env:{NEXT_PUBLIC_API_URL:base}}, URL,
    require: name => name === 'react' ? react : {getApiBaseUrl: () => base},
    window: {location:{protocol:'https:',host:'staging-web.example'},
      addEventListener: (name, fn) => listeners.set(name,fn),
      removeEventListener: name => listeners.delete(name)},
    localStorage: {getItem: () => null}, WebSocket:Socket,
    setTimeout: fn => { timers.set(++timerId,fn); return timerId; },
    clearTimeout: id => timers.delete(id) };
  const code = ts.transpileModule(fs.readFileSync('src/hooks/useCycloneWebSocket.ts','utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,context);
  context.exports.useCycloneWebSocket();
  const cleanup = effects.map(fn => fn());
  return {sockets, listeners, timers, setBase: value => {base=value;}, cleanup};
}

test('live stream uses the configured API deployment', () => {
  const stream = mountStream();
  assert.equal(stream.sockets[0].url,'wss://staging-api.example/ws/cyclone-stream');
  stream.cleanup.forEach(fn => fn());
});

test('replacing a stream cannot let the old socket start another connection', () => {
  const stream = mountStream();
  const old = stream.sockets[0];
  // Capture queued browser callbacks before handlers are detached.
  const oldClose = old.onclose;
  stream.setBase('https://alternate-api.example');
  stream.listeners.get('cyclonet:data-source-changed')();
  oldClose();
  for (const fn of [...stream.timers.values()]) fn();
  assert.equal(stream.sockets.length,2);
  assert.equal(stream.sockets[1].url,'wss://alternate-api.example/ws/cyclone-stream');
  stream.cleanup.forEach(fn => fn());
  assert.equal(stream.timers.size,0);
});
