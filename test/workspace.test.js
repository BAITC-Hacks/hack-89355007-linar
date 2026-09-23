import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {JSDOM,VirtualConsole} from 'jsdom';

const root=new URL('../',import.meta.url);
async function server(t){
 const port=38000+Math.floor(Math.random()*1000);
 const child=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(root),env:{...process.env,PORT:String(port),OPENAI_API_KEY:'',NVIDIA_API_KEY:'',DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());let errors='';child.stderr.on('data',d=>errors+=d);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(errors||'Сервер не запустился')),15000);child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error(errors||'Сервер завершился'));});child.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
 const url=`http://127.0.0.1:${port}`;
 const post=(path,body)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify(body)});
 return {url,post};
}
async function until(predicate,description){const start=Date.now();while(Date.now()-start<12000){if(await predicate())return;await new Promise(r=>setTimeout(r,25));}throw Error('Не выполнено: '+description);}
async function app(t,url,session){
 const html=await readFile(new URL('public/index.html',root),'utf8'),code=await readFile(new URL('public/workspace-ui.js',root),'utf8');
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});t.after(()=>dom.window.close());
 const w=dom.window;w.fetch=(path,options)=>fetch(new URL(path,url),options);w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 if(session)w.localStorage.setItem('orglens.audit',session);w.eval(code);
 await until(()=>w.document.querySelector('h1'),'первый экран');
 const q=selector=>w.document.querySelector(selector);
 const route=async(name,title)=>{w.location.hash=name;await until(()=>q('h1')?.textContent===title,'раздел '+name);await new Promise(r=>setTimeout(r,30));};
 return {w,q,route,errors};
}

test('Сессия сохраняет решения, отчёт исключает отклонённые, ошибки не портят решения',async t=>{
 const {url,post}=await server(t);const audit=await (await post('/api/audit',{scenario:true})).json();assert.ok(audit.auditId);
 const f=audit.findings[0],decisions={[f.id]:{status:'confirmed',comment:'Сверено с первоисточником'}};
 assert.equal((await post('/api/audit/decisions',{auditId:audit.auditId,decisions})).status,200);
 let session=await fetch(`${url}/api/audit/session?id=${audit.auditId}`).then(r=>r.json());assert.deepEqual(session.decisions,decisions);assert.equal(session.documents[0].name,audit.documents[0].name);
 assert.equal((await post('/api/audit/decisions',{auditId:audit.auditId,decisions:{unknown:{status:'confirmed',comment:''}}})).status,400);
 session=await fetch(`${url}/api/audit/session?id=${audit.auditId}`).then(r=>r.json());assert.deepEqual(session.decisions,decisions);
 const confirmed=await (await post('/api/audit/report',{auditId:audit.auditId,decisions})).json();assert.equal(confirmed.confirmed,1);assert.match(confirmed.report,/Сверено с первоисточником/);
 decisions[f.id].status='rejected';const rejected=await (await post('/api/audit/report',{auditId:audit.auditId,decisions})).json();assert.equal(rejected.confirmed,0);assert.doesNotMatch(rejected.report,/Аудиторское наблюдение №1/);
 assert.equal((await fetch(url+'/api/audit/session?id=missing')).status,404);
 assert.equal((await post('/api/audit/search',{auditId:audit.auditId,query:'a'})).status,400);
 const review=await post('/api/audit/review',{auditId:audit.auditId,mode:'openai'});assert.equal(review.status,502);assert.match(JSON.stringify(await review.json()),/OPENAI_API_KEY/);
 const sample=await (await post('/api/audit',{sample:true})).json();assert.equal(sample.documents.length,12);assert.ok(sample.auditId);
});

test('Интерфейс: сценарий → источник → решение → восстановление → заключение',async t=>{
 const {url}=await server(t);const {w,q,route,errors}=await app(t,url);
 assert.equal(w.document.querySelectorAll('#navigation a').length,10);
 q('[data-action="scenario"]').click();await until(()=>w.localStorage.getItem('orglens.audit'),'анализ сценария');const sessionId=w.localStorage.getItem('orglens.audit');
 await route('findings','Наблюдения аудитора');assert.ok(q('#decision-form'));
 q('[data-action="source"]').click();assert.equal(q('#detail-dialog').open,true);assert.match(q('#dialog-body').textContent,/Учебный сценарий/);q('[data-action="close-dialog"]').click();
 q('#decision-status').value='confirmed';q('#decision-status').dispatchEvent(new w.Event('change',{bubbles:true}));
 q('#decision-comment').value='Тестовое подтверждение';q('#decision-comment').dispatchEvent(new w.Event('input',{bubbles:true}));
 q('#decision-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>q('#save-state')?.textContent==='Изменения сохранены','сохранение решения');
 await route('report','Итоговое заключение');q('[data-action="report"]').click();await until(()=>q('.report-preview'),'создание заключения');assert.match(q('.report-preview').textContent,/Тестовое подтверждение/);assert.equal(q('[data-action="download"]').disabled,false);
 const restored=await app(t,url,sessionId);await restored.route('findings','Наблюдения аудитора');assert.equal(restored.q('#decision-status').value,'confirmed');assert.equal(restored.q('#decision-comment').value,'Тестовое подтверждение');
 await route('compare','Сравнение документов');assert.ok(q('tbody tr'));await route('clauses','Сравнение документов');await route('structure','Сравнение документов');await route('extraction','Извлечённые факты');assert.ok(q('tbody tr'));
 await route('knowledge','База знаний');q('[name="query"]').value='ведение реестра рисков';q('#search-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>q('#search-results .source-box'),'поиск по источникам');
 assert.deepEqual(errors,[]);assert.deepEqual(restored.errors,[]);
});

test('Интерфейс: модель компании, профили, карта функций, настройки и пустые состояния',async t=>{
 const {url}=await server(t);const {w,q,route,errors}=await app(t,url);
 await route('report','Итоговое заключение');assert.match(q('#content').textContent,/Сначала запустите анализ/);
 await route('organization','Подразделения');assert.equal(w.document.querySelectorAll('.model-card').length,7);q('[data-action="unit"]').click();await until(()=>q('#detail-dialog').open,'карточка подразделения');assert.match(q('#dialog-body').textContent,/Связанные процессы/);q('[data-action="close-dialog"]').click();
 await route('employees','Сотрудники');assert.equal(w.document.querySelectorAll('tbody tr').length,15);q('[data-action="employee"]').click();await until(()=>q('#detail-dialog').open,'карточка сотрудника');assert.match(q('#dialog-body').textContent,/Образование/);q('[data-action="close-dialog"]').click();
 await route('map','Карта функций');assert.equal(w.document.querySelectorAll('tbody tr').length,15);q('[data-action="page"][data-delta="1"]').click();await until(()=>q('.pager').textContent.includes('16–30'),'пагинация');
 await route('settings','Настройки ИИ');assert.equal(q('#review-form button').disabled,true);assert.match(q('#content').textContent,/Память процесса/);
 await route('upload','Документы');assert.equal(q('[name="ai"]').checked,false);assert.equal(q('[name="ai"]').disabled,true);q('#upload-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>q('#upload-error')&&!q('#upload-error').hidden,'валидация пустого комплекта');assert.match(q('#upload-error').textContent,/Добавьте хотя бы один/);
 assert.deepEqual(errors,[]);
});

test('Интерфейс: загрузка двух файлов, удаление, ссылки на редакции и безопасный вывод текста',async t=>{
 const {url}=await server(t);const {w,q,route,errors}=await app(t,url);await route('upload','Документы');
 const before='Подразделение: Внутренний аудит\n3. Структура\n3.6. Директор направления отвечает за контроль качества <img src=x onerror=alert(1)>\n5. Функции\n5.1. Проводит внутренние проверки';
 const after='Подразделение: Внутренний аудит\n3. Структура\n3.6. Директор департамента отвечает за контроль качества\n5. Функции\n5.1. Проводит внутренние проверки';
 function upload(period,text,name){const input=q('#files-'+period);Object.defineProperty(input,'files',{configurable:true,value:[new w.File([text],name,{type:'text/plain'})]});input.dispatchEvent(new w.Event('change',{bubbles:true}));}
 upload('before','wrong','wrong.exe');assert.match(q('#upload-error').textContent,/неподдерживаемый формат/);
 upload('before',before,'Положение о внутреннем аудите редакция 8.txt');assert.ok(q('[data-action="remove-file"]'));q('[data-action="remove-file"]').click();assert.equal(q('#list-before').children.length,0);
 upload('before',before,'Положение о внутреннем аудите редакция 8.txt');upload('after',after,'Положение о внутреннем аудите редакция 9.txt');
 q('#upload-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>w.localStorage.getItem('orglens.audit'),'загрузка комплекта');
 await route('clauses','Сравнение документов');assert.match(q('tbody').textContent,/редакция 8/);assert.match(q('tbody').textContent,/редакция 9/);assert.equal(w.document.querySelectorAll('img').length,0);assert.match(q('tbody').textContent,/<img/);
 q('[data-action="source"]').click();assert.match(q('#dialog-body').textContent,/Пункт 3.6/);assert.equal(w.document.querySelectorAll('img').length,0);
 assert.deepEqual(errors,[]);
});
