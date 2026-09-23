import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import ExcelJS from 'exceljs';
const JSZip=createRequire(import.meta.resolve('mammoth'))('jszip');
const port=32000+Math.floor(Math.random()*10000);
let server;
before(async()=>{
 server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),OPENAI_API_KEY:'',NVIDIA_API_KEY:''},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);server.once('error',reject);server.once('exit',code=>{clearTimeout(timer);reject(Error(`Server exited: ${code}`));});server.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
});
after(()=>server?.kill());
test('AI status and missing-key errors do not make paid requests',async()=>{
 const status=await fetch(`http://127.0.0.1:${port}/api/providers`).then(r=>r.json());assert.equal(status.providers.length,2);assert.ok(status.providers.every(p=>!p.configured));
 const res=await fetch(`http://127.0.0.1:${port}/api/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'both',documents:[{id:'b',name:'b',text:'Подразделение: Тест\n1. Формирование бюджета компании.',period:'before'},{id:'a',name:'a',text:'Подразделение: Тест\n1. Формирование бюджета компании.',period:'after'}]})});
 assert.equal(res.status,502);const body=await res.json();assert.equal(body.reviews.length,0);assert.equal(body.errors.length,2);
});
test('External browser origins cannot trigger paid analysis',async()=>{
 const res=await fetch(`http://127.0.0.1:${port}/api/review`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example'},body:'{}'});assert.equal(res.status,403);
});
const txt='Подразделение: Финансовый отдел\n1.1. Формирование годового бюджета компании.';
const file=(name,period,data)=>({name,period,data:Buffer.from(data).toString('base64')});
async function request(files){const res=await fetch(`http://127.0.0.1:${port}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files})});return {status:res.status,body:await res.json()};}
test('API: TXT сохраняет кириллицу и сопоставляет функции',async()=>{
 const r=await request([file('до.txt','before',txt),file('после.txt','after',txt)]);
 assert.equal(r.status,200);assert.equal(r.body.table.length,1);assert.equal(r.body.findings.length,0);assert.equal(r.body.structure[0].sources.length,2);
});
test('API: отклоняет неполный комплект и неподдерживаемый формат',async()=>{
 assert.equal((await request([file('до.txt','before',txt)])).status,400);
 assert.equal((await request([file('до.doc','before',txt),file('после.txt','after',txt)])).status,400);
});
test('API: реальный DOCX и XLSX извлекаются с привязкой к пункту',async()=>{
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+txt.split('\n').map(s=>`<w:p><w:r><w:t>${s}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>');
 const wb=new ExcelJS.Workbook();const sheet=wb.addWorksheet('Функции');sheet.addRow(['Подразделение: Финансовый отдел']);sheet.addRow(['1.1.','Формирование годового бюджета компании.']);
 const r=await request([file('до.docx','before',await zip.generateAsync({type:'nodebuffer'})),file('после.xlsx','after',await wb.xlsx.writeBuffer())]);
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.table.length,1);assert.equal(r.body.table[0].matches.length,1);assert.equal(r.body.table[0].matches[0].function.source.point,'1.1');
});
test('API: PDF с текстовым слоем извлекается, повреждённый файл отклоняется',async()=>{
 const content='BT /F1 12 Tf 40 700 Td (Example source document) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const r=await request([file('до.pdf','before',pdf),file('после.txt','after',txt)]);assert.equal(r.status,200,JSON.stringify(r.body));assert.match(r.body.documents[0].text,/Example source document/);assert.ok(r.body.warnings.length);
 assert.equal((await request([file('до.pdf','before','invalid'),file('после.txt','after',txt)])).status,400);
});
