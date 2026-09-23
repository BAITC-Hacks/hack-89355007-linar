import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {structureLines} from '../lib/document-parser.js';
import {compareClauses} from '../lib/clause-diff.js';
import {auditDocuments,renderAuditReport} from '../lib/audit.js';
import {reorganizationScenario} from '../lib/scenario.js';

test('Сценарий разделения сохраняет исходный пункт потерянной функции',()=>{
 const audit=auditDocuments(reorganizationScenario().documents);
 const loss=audit.findings.find(f=>f.type==='loss');
 assert.ok(loss);assert.equal(loss.sources[0].point,'1.4');
 assert.equal(audit.structure.find(u=>u.before==='Департамент информационной безопасности').after,'Security Operations');
 const report=renderAuditReport(audit,{[loss.id]:{status:'confirmed',comment:'Проверено'}});
 assert.match(report,/1\.4:/);assert.match(report,/Учебный сценарий ДО\.txt/);
 assert.doesNotMatch(report,/Аудиторское наблюдение №2/);
 assert.throws(()=>renderAuditReport(audit,{'invented':{status:'confirmed',comment:''}}));
});

test('Разные редакции пункта дают доказательство из обоих исходных документов',()=>{
 const a=structureLines([{text:'Подразделение: Внутренний аудит'},{text:'3. Структура'},{text:'3.6. Директор направления отвечает за контроль качества'}],{id:'a',name:'Положение о внутреннем аудите редакция 8.docx',period:'before',format:'docx'});
 const b=structureLines([{text:'Подразделение: Внутренний аудит'},{text:'3. Структура'},{text:'3.6. Директор департамента отвечает за контроль качества'}],{id:'b',name:'Положение о внутреннем аудите редакция 9.docx',period:'after',format:'docx'});
 const change=compareClauses([a,b]).find(c=>c.clause==='3.6');
 assert.ok(change);assert.equal(change.before.document,'Положение о внутреннем аудите редакция 8.docx');assert.equal(change.after.document,'Положение о внутреннем аудите редакция 9.docx');
 const audit=auditDocuments([a,b]),item=audit.findings.find(f=>f.id==='P-3.6');assert.equal(item.sources.length,2);
 const report=renderAuditReport(audit,{[item.id]:{status:'confirmed',comment:'Есть отличие'}});
 assert.match(report,/редакция 8\.docx, 3\.6/);assert.match(report,/редакция 9\.docx, 3\.6/);
});

test('HTTP аудит и поиск работают без API ключа и БД',async()=>{
 const port=36500+Math.floor(Math.random()*500);const child=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:String(port),OPENAI_API_KEY:'',DATABASE_URL:''},stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',data=>error+=data);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(error||'Сервер не запустился')),10000);child.once('exit',()=>{clearTimeout(timer);reject(Error(error||'Сервер завершился'));});child.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
  const url=`http://127.0.0.1:${port}`,headers={'Content-Type':'application/json'};
  const response=await fetch(url+'/api/audit',{method:'POST',headers,body:JSON.stringify({scenario:true})});const audit=await response.json();assert.equal(response.status,200,JSON.stringify(audit));assert.ok(audit.auditId);
  const search=await fetch(url+'/api/audit/search',{method:'POST',headers,body:JSON.stringify({auditId:audit.auditId,query:'ведение реестра рисков'})}).then(r=>r.json());assert.ok(search.matches.some(m=>m.document==='Учебный сценарий ДО.txt'));
  const loss=audit.findings.find(f=>f.type==='loss');const report=await fetch(url+'/api/audit/report',{method:'POST',headers,body:JSON.stringify({auditId:audit.auditId,decisions:{[loss.id]:{status:'confirmed',comment:'Проверено'}}})}).then(r=>r.json());assert.equal(report.confirmed,1);
 }finally{child.kill();}
});
