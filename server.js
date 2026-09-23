import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyze} from './lib/analyzer.js';
import {demoDocuments} from './lib/demo.js';
import {semanticCandidates} from './lib/semantic.js';
import {runAgent} from './lib/agent.js';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
async function extract(file) {
 const buffer=Buffer.from(file.data,'base64'),ext=path.extname(file.name).toLowerCase();
 if(buffer.length>15*1024*1024)throw Error('Размер файла превышает 15 МБ');
 if(ext==='.txt'||ext==='.md')return buffer.toString('utf8');
 if(ext==='.docx'){const {default:m}=await import('mammoth');return (await m.extractRawText({buffer})).value;}
 if(ext==='.pdf'){const {default:pdf}=await import('pdf-parse/lib/pdf-parse.js');return (await pdf(Uint8Array.from(buffer),{version:'v2.0.550'})).text;}
 if(ext==='.xlsx'){const {default:ExcelJS}=await import('exceljs');const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);return wb.worksheets.map(sheet=>{const lines=[`Лист: ${sheet.name}`];sheet.eachRow(row=>{const values=[];row.eachCell(cell=>values.push(cell.text));lines.push(values.join(' '));});return lines.join('\n');}).join('\n');}
 throw Error('Поддерживаются DOCX, PDF, XLSX, TXT и MD. DOC и XLS необходимо сохранить как DOCX и XLSX.');
}
http.createServer(async(req,res)=>{try{
 if(req.url==='/api/demo')return json(res,200,analyze(demoDocuments));
 if(req.url==='/api/semantic'&&req.method==='POST') {
  if(!process.env.OPENAI_API_KEY)return json(res,503,{error:'Смысловой поиск недоступен: настройте OPENAI_API_KEY на сервере.'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>350000)return json(res,413,{error:'Слишком много функций'});}
  return json(res,200,{candidates:await semanticCandidates(JSON.parse(body).functions)});
 }
 if(req.url==='/api/analyze'&&req.method==='POST') {
  let body='';for await(const chunk of req){body+=chunk;if(body.length>45*1024*1024){json(res,413,{error:'Комплект превышает 30 МБ'});return;}}
  const {files,ai}=JSON.parse(body);if(!Array.isArray(files)||!files.length||files.length>30)throw Error('Загрузите от 2 до 30 документов');
  if(!files.some(f=>f.period==='before')||!files.some(f=>f.period==='after'))throw Error('Добавьте документы «до» и «после»');
  const docs=[];for(const [i,file] of files.entries()) {if(!['before','after'].includes(file.period)||typeof file.name!=='string'||typeof file.data!=='string')throw Error('Некорректный файл');const text=await extract(file);if(!text.trim())throw Error(`${file.name}: нет текстового слоя. Для сканов требуется OCR.`);docs.push({id:`doc-${i}`,name:file.name,period:file.period,text});}
  return json(res,200,ai?await runAgent(docs):analyze(docs));
 }
 const relative=req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'');const target=path.resolve(root,relative);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 const data=await readFile(target);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'})[path.extname(target)]||'application/octet-stream'});res.end(data);
 }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.message});}}).listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('OrgLens: http://localhost:3000'));
