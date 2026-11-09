import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context={exports:{}, TextDecoder, Uint8Array};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/chatResponse.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText, context);
const {parseChatReply,readChatReply}=context.exports;

test('valid chat content retains metadata and discards unknown fields',()=>{
  const reply=parseChatReply({response:'General education',sources:['Source'],timestamp:'UTC',category:'education',private:'ignored'});
  assert.equal(reply.response,'General education');
  assert.equal(reply.sources[0],'Source');
  assert.equal(reply.private,undefined);
});

test('objects, missing text and malformed metadata never reach the renderer',()=>{
  for(const data of [null,[],{}, {response:{}}, {response:' '}, {response:'x'.repeat(12001)},
      {response:'text',sources:{}}, {response:'text',sources:[{}]}, {response:'text',sources:Array(9).fill('source')},
      {response:'text',sources:['x'.repeat(301)]}, {response:'text',timestamp:{}}, {response:'text',category:1}]) {
    assert.throws(()=>parseChatReply(data));
  }
});

test('chunked oversized response cancels its stream before parsing',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({
    start(controller) {controller.enqueue(new Uint8Array(65536));controller.enqueue(new Uint8Array(1));},
    cancel(){cancelled=true;}
  });
  await assert.rejects(readChatReply(new Response(stream)),/byte limit/);
  assert.equal(cancelled,true);
});

test('invalid encoding, malformed JSON and HTTP errors fail closed',async()=>{
  for(const response of [new Response(Uint8Array.from([0xff])),new Response('{'),new Response('{}',{status:503})]) {
    await assert.rejects(readChatReply(response));
  }
});

test('split multibyte text decodes correctly across network chunks',async()=>{
  const bytes=new TextEncoder().encode(JSON.stringify({response:'Cyclone — education'}));
  const stream=new ReadableStream({start(controller){
    for(const value of bytes)controller.enqueue(Uint8Array.of(value));
    controller.close();
  }});
  assert.equal((await readChatReply(new Response(stream))).response,'Cyclone — education');
});
