import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyze} from './lib/analyzer.js';
import {demoDocuments} from './lib/demo.js';
import {runAgent} from './lib/agent.js';
import {organization} from './lib/organization.js';
import {employees} from './lib/employees.js';
import {functionMap} from './lib/function-map.js';
import {catalog,requirements,checkRequirements} from './lib/regulatory.js';
import {semanticCandidates} from './lib/semantic.js';
import {publicProviders,reviewWithProviders} from './lib/ai.js';
import {parseDocument} from './lib/document-parser.js';
import {reorganizationScenario} from './lib/scenario.js';
import {extractFacts} from './lib/extraction-agent.js';
import {auditDocuments,renderAuditReport} from './lib/audit.js';
import {buildKnowledge,searchKnowledge} from './lib/knowledge.js';
import {databaseEnabled,migrate,saveAudit,loadAudit,saveDecisions,searchStored} from './lib/storage.js';
import {randomUUID} from 'node:crypto';
try { process.loadEnvFile?.(); } catch(e) { if(e.code!=='ENOENT')throw e; }
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const projectRoot=path.dirname(fileURLToPath(import.meta.url));
async function sampleDocuments(){const docs=[];for(const period of ['before','after']){const dir=path.join(projectRoot,`company_${period}`);for(const name of (await readdir(dir)).filter(n=>/\.(docx|xlsx)$/.test(n)).sort()){const data=(await readFile(path.join(dir,name))).toString('base64');docs.push(await parseDocument({id:`sample-${docs.length}`,period,name,data}));}}return docs;}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
const activeAudits=new Map();let migrated=false;
async function requestJson(req,max=45*1024*1024){if(!req.headers['content-type']?.startsWith('application/json'))throw Error('Ожидается JSON');let body='';for await(const chunk of req){body+=chunk;if(body.length>max)throw Error('Слишком большой запрос');}return JSON.parse(body);}
function remember(id,audit){activeAudits.set(id,{analysis:audit,decisions:{}});if(activeAudits.size>20)activeAudits.delete(activeAudits.keys().next().value);}
async function findAudit(id){return activeAudits.get(id)||(databaseEnabled()?await loadAudit(id):null);}
http.createServer(async(req,res)=>{try{
 if(req.url==='/api/organization'&&req.method==='GET')return json(res,200,organization);
 if(req.url==='/api/employees'&&req.method==='GET')return json(res,200,employees);
 if(req.url==='/api/function-map'&&req.method==='GET')return json(res,200,functionMap);
 if(req.url==='/api/regulatory'&&req.method==='GET')return json(res,200,catalog);
 if(req.url==='/api/requirements'&&req.method==='GET')return json(res,200,requirements);
 if(req.url==='/api/audit/storage'&&req.method==='GET')return json(res,200,{postgresql:databaseEnabled(),vectorSearch:databaseEnabled(),mode:databaseEnabled()?'PostgreSQL с pgvector':'Память процесса'});
 if(req.url.startsWith('/api/audit/session?')&&req.method==='GET'){
  const id=new URL(req.url,'http://localhost').searchParams.get('id'),record=await findAudit(id);
  if(!record)return json(res,404,{error:'Сессия анализа недоступна. После перезапуска сервера в режиме памяти документы нужно загрузить заново.'});
  return json(res,200,{...record.analysis,auditId:id,decisions:record.decisions,storage:databaseEnabled()?'postgresql':'memory'});
 }
 if(req.url==='/api/sample-analysis'&&req.method==='GET'){const docs=await sampleDocuments();return json(res,200,{...analyze(docs),requirements:checkRequirements(docs)});}
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Запросы разрешены только из локального приложения.'});
 if(req.url==='/api/audit'&&req.method==='POST'){
  const input=await requestJson(req),files=input.files;
  if(!input.scenario&&!input.sample&&(!Array.isArray(files)||files.length<2||files.length>30||!files.some(f=>f.period==='before')||!files.some(f=>f.period==='after')))throw Error('Загрузите документы до и после');
  const docs=input.scenario?reorganizationScenario().documents:input.sample?await sampleDocuments():await Promise.all(files.map((f,i)=>parseDocument({...f,id:`doc-${i}`})));
  if(docs.some(d=>!d.text.trim()))throw Error('В комплекте есть пустой документ. Для сканов требуется OCR.');
  const baseline=input.ai?await runAgent(docs):null;
  const facts=input.ai?await extractFacts(docs):null;
  const audit=auditDocuments(docs,{object:typeof input.object==='string'&&input.object.length<=120?input.object:null,analysis:baseline,facts});
  let auditId=randomUUID();if(databaseEnabled()){if(!migrated){await migrate();migrated=true;}auditId=await saveAudit(audit);}
  remember(auditId,audit);
  return json(res,200,{...audit,auditId,storage:databaseEnabled()?'postgresql':'memory'});
 }
 if(req.url==='/api/audit/search'&&req.method==='POST'){
  const {auditId,query,limit}=await requestJson(req,3000),record=await findAudit(auditId);if(!record)return json(res,404,{error:'Анализ не найден'});
  if(typeof query!=='string'||query.trim().length<3||query.length>500)throw Error('Запрос должен содержать 3–500 символов');
  const matches=databaseEnabled()?await searchStored(auditId,query,limit):searchKnowledge(buildKnowledge(record.analysis.documents),query,{limit});return json(res,200,{matches});
 }
 if((req.url==='/api/audit/report'||req.url==='/api/audit/decisions')&&req.method==='POST'){
  const {auditId,decisions}=await requestJson(req,200000),record=await findAudit(auditId);if(!record)return json(res,404,{error:'Анализ не найден'});
  const report=renderAuditReport(record.analysis,decisions);
  if(databaseEnabled())await saveDecisions(auditId,decisions);record.decisions=decisions;
  if(req.url==='/api/audit/decisions')return json(res,200,{saved:true,decisions});
  return json(res,200,{report,confirmed:Object.values(decisions).filter(v=>v.status==='confirmed').length});
 }
 if(req.url==='/api/providers'&&req.method==='GET')return json(res,200,{providers:publicProviders()});
 if(req.url==='/api/audit/review'&&req.method==='POST'){
  const {auditId,mode}=await requestJson(req,3000),record=await findAudit(auditId);if(!record)return json(res,404,{error:'Анализ не найден'});
  const timeoutMs=Math.max(1000,Math.min(Number(process.env.AI_TIMEOUT_MS)||90000,180000));
  const outcome=await reviewWithProviders(record.analysis,mode,{timeoutMs});
  return json(res,outcome.reviews.length?200:502,outcome);
 }
 if(req.url==='/api/review'&&req.method==='POST') {
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Ожидается JSON.'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>500000)return json(res,413,{error:'Слишком большой комплект для ИИ-проверки.'});}
  const {documents,mode}=JSON.parse(body);
  if(!Array.isArray(documents)||documents.length<2||documents.length>30||new Set(documents.map(d=>d?.id)).size!==documents.length||documents.some(d=>!d||typeof d.id!=='string'||typeof d.name!=='string'||typeof d.text!=='string'||!['before','after'].includes(d.period)))throw Error('Некорректный комплект документов.');
  const baseline=analyze(documents.map(({id,name,text,period})=>({id,name,text,period})));
  const timeoutMs=Math.max(1000,Math.min(Number(process.env.AI_TIMEOUT_MS)||90000,180000));
  const outcome=await reviewWithProviders(baseline,mode,{timeoutMs});
  return json(res,outcome.reviews.length?200:502,outcome);
 }
 if(req.url==='/api/semantic'&&req.method==='POST') {
  if(!process.env.OPENAI_API_KEY)return json(res,503,{error:'Настройте OPENAI_API_KEY на сервере.'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>350000)return json(res,413,{error:'Слишком много функций'});}
  return json(res,200,{candidates:await semanticCandidates(JSON.parse(body).functions)});
 }
 if(req.url==='/api/demo')return json(res,200,analyze(demoDocuments));
 if(req.url==='/api/analyze'&&req.method==='POST') {
  let body='';for await(const chunk of req){body+=chunk;if(body.length>45*1024*1024){json(res,413,{error:'Комплект превышает 30 МБ'});return;}}
  const {files,ai}=JSON.parse(body);if(!Array.isArray(files)||!files.length||files.length>30)throw Error('Загрузите от 2 до 30 документов');
  if(!files.some(f=>f.period==='before')||!files.some(f=>f.period==='after'))throw Error('Добавьте документы «до» и «после»');
  const docs=[];for(const [i,file] of files.entries()) {const doc=await parseDocument({...file,id:`doc-${i}`});if(!doc.text.trim())throw Error(`${file.name}: нет текстового слоя. Для сканов требуется OCR.`);docs.push(doc);}
  const outcome=ai?await runAgent(docs):analyze(docs);
  return json(res,200,{...outcome,requirements:checkRequirements(docs)});
 }
 const relative=req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'');const target=path.resolve(root,relative);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 const data=await readFile(target);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'})[path.extname(target)]||'application/octet-stream'});res.end(data);
 }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.message});}}).listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`OrgLens: http://localhost:${Number(process.env.PORT)||3000}`));
