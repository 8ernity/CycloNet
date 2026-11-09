import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context={exports:{}, URL};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/backendUrl.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,context);
const {normalizeBackendUrl}=context.exports;

test('backend URLs preserve deployment prefixes and normalize API suffixes',()=>{
  assert.equal(normalizeBackendUrl(' https://weather.example/api/ '),'https://weather.example');
  assert.equal(normalizeBackendUrl('http://localhost:8000/'),'http://localhost:8000');
  assert.equal(normalizeBackendUrl('https://weather.example/cyclonet/api'),'https://weather.example/cyclonet');
});

test('backend URLs reject executable schemes, credentials, and non-address input',()=>{
  for(const value of ['', 'localhost:8000','javascript:alert(1)','data:text/html,test','file:///tmp/test',
    'https://user:secret@weather.example','https://weather.example?token=secret','https://weather.example/#fragment']) {
    assert.throws(()=>normalizeBackendUrl(value));
  }
});
