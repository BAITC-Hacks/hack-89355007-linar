import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,similarity} from '../lib/analyzer.js';
import {demoDocuments} from '../lib/demo.js';
test('Контрольный комплект: реорганизация, потеря, дублирование, конфликт',()=>{
 const r=analyze(demoDocuments);
 assert.equal(r.structure.filter(u=>u.status==='reorganized').length,2);
 assert.equal(r.structure.filter(u=>u.status==='created').length,1);
 assert.equal(r.structure.filter(u=>u.status==='preserved').length,1);
 assert.equal(r.findings.filter(f=>f.type==='loss').length,1);
 assert.match(r.findings.find(f=>f.type==='loss').sources[0].quote,/реестра финансовых рисков/);
 assert.equal(r.findings.filter(f=>f.type==='duplicate').length,1);
 assert.equal(r.findings.filter(f=>f.type==='conflict').length,1);
 assert.equal(r.warnings.length,0);
 assert.equal(r.diagnostics.length,demoDocuments.length);
 assert.equal(r.diagnostics.reduce((n,d)=>n+d.functions,0),r.functions.length);
 for(const f of r.findings)for(const s of f.sources)assert.ok(r.documents.find(d=>d.id===s.documentId).text.includes(s.quote));
});
test('Одинаковые функции в одном подразделении не дают межфункциональный дубль',()=>{
 const r=analyze([{id:'a',name:'a',period:'after',text:'Подразделение: Тест\n1. Формирование годового бюджета компании.\n2. Формирование годового бюджета компании.'}]);
 assert.equal(r.findings.length,0);
});
test('Пустой и неструктурированный текст не выдают выдуманных функций',()=>{
 const r=analyze([{id:'x',name:'x',period:'before',text:'произвольный текст'}]);assert.equal(r.functions.length,0);assert.ok(r.warnings.some(w=>w.includes('не распознаны подразделения')));assert.equal(r.findings.length,0);
 assert.equal(similarity('',''),0);
});
test('Переименование не устанавливается без явного подтверждения',()=>{
 const r=analyze([{id:'b',name:'b',period:'before',text:'Подразделение: Отдел финансов'},{id:'a',name:'a',period:'after',text:'Подразделение: Финансовый отдел'}]);
 assert.deepEqual(r.structure.map(s=>s.status),['removed','created']);
});
