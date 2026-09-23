import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkRequirements,validateKnowledgeBase} from '../lib/regulatory.js';

test('База требований сохраняет ссылки на источники и обязательные поля',()=>{
 assert.deepEqual(validateKnowledgeBase(),[]);
 assert.deepEqual(checkRequirements([], 'after').map(r=>r.status),Array(4).fill('needs-review'));
 assert.throws(()=>checkRequirements([],'unknown'));
});

test('Настоящие учебные DOCX и XLSX проходят загрузчик и выявляют ожидаемые отклонения',async()=>{
 const port=34500+Math.floor(Math.random()*1000);
 const child=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:String(port),OPENAI_API_KEY:''},stdio:['ignore','ignore','pipe']});
 let startupError='';
 child.stderr.on('data',chunk=>{startupError+=chunk.toString().slice(0,3000);});
 try{
  let response;
  for(let attempt=0;attempt<35;attempt++){
   try{response=await fetch(`http://127.0.0.1:${port}/api/sample-analysis`);break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}
  }
  assert.ok(response,`Сервер не ответил на порту ${port}. Код выхода: ${child.exitCode??'процесс работает'}. ${startupError||'Проверьте установку зависимостей через npm.cmd ci.'}`);
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.documents.length,12);
  assert.deepEqual(data.findings.map(f=>f.type).sort(),['duplicate','loss']);
  assert.match(data.findings.find(f=>f.type==='loss').description,/реестра рисков/);
  assert.equal(data.requirements.find(r=>r.id==='REQ-003').status,'needs-review');
  assert.ok(data.requirements.find(r=>r.id==='REQ-001').evidence[0].point==='2.1');
 }finally{child.kill();}
});
