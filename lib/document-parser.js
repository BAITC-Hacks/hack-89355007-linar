import path from 'node:path';

const title=/^(?:Подразделение|Департамент|Отдел)\s*:\s*(.+)$/i;
const clause=/^(\d+(?:\.\d+)*)(?:[.)]|\s)\s*(.+)$/;
const role=/(руководител[ья]|аналитик|специалист|администратор|инженер|аудитор|бухгалтер)/i;
const responsibility=/(отвечает|ответственност|обязанност)/i;
const authority=/(вправе|полномоч|может запрашивать|имеет право)/i;

export function structureLines(lines,{id,name,period,format}){
 let unit=null,heading=null,section=null,context='';
 const segments=[],sourceMap=[];
 if(!lines.some(entry=>title.test(String(entry.text||'').trim()))){
  const inferred=/внутренн.*аудит/i.test(name)?'Внутренний аудит':/информационн.*безопасн|\bИБ\b/i.test(name)?'Департамент информационной безопасности':/ИТ-департамент/i.test(name)?'ИТ-департамент':null;
  if(inferred)lines=[{text:`Подразделение: ${inferred}`},...lines];
 }
 for(const entry of lines){
  const text=String(entry.text||'').trim();if(!text)continue;
  const head=text.match(title),number=text.match(clause),sectionHeading=/^\d{1,2}\.\s+\D.{0,130}$/.test(text)&&!/^\d{1,2}\.\s*\d/.test(text);
  if(head)unit=head[1].trim();
  if(entry.heading||sectionHeading){heading=text;context=text;}
  if(number)section=number[1];
  const numberedFunction=number&&!sectionHeading&&(/функц|задач/i.test(context)||!/^\d{1,2}\.\s/.test(context)&&!context);
  const kind=head?'department':sectionHeading?'heading':authority.test(text)||/прав[ао]/i.test(context)&&number?'authority':responsibility.test(text)||/обязанност|ответственност/i.test(context)&&number?'responsibility':numberedFunction?'function':role.test(text)?'position':entry.heading?'heading':entry.table?'table':'text';
  const segment={id:`${id}-s${segments.length+1}`,documentId:id,document:name,period,format,kind,text,department:unit,heading,section:number?.[1]||section,page:entry.page??null,sheet:entry.sheet??null,row:entry.row??null,cell:entry.cell??null,table:entry.table??null};
  segments.push(segment);sourceMap.push({documentId:id,document:name,point:number?.[1]||(entry.sheet?`${entry.sheet}${entry.row?`!${entry.row}`:''}`:undefined),section:segment.section,page:segment.page,sheet:segment.sheet,row:segment.row,cell:segment.cell,segmentId:segment.id,kind});
 }
 // The analyzer uses one line per item; sourceMap indices correspond to its 1-based line numbers.
 const text=segments.map(s=>s.text).join('\n');
 return {id,name,period,format,text,segments,sourceMap};
}

export async function parseDocument({id,name,period,data}){
 if(typeof id!=='string'||!['before','after'].includes(period)||typeof name!=='string'||typeof data!=='string')throw Error('Некорректный файл');
 const ext=path.extname(name).toLowerCase(),buffer=Buffer.from(data,'base64');
 if(buffer.length>15*1024*1024)throw Error('Размер файла превышает 15 МБ');
 const lines=[];
 if(ext==='.txt'||ext==='.md')buffer.toString('utf8').split(/\r?\n/).forEach(text=>lines.push({text}));
 else if(ext==='.docx'){
  const {default:mammoth}=await import('mammoth');
  const raw=(await mammoth.extractRawText({buffer})).value;
  const html=(await mammoth.convertToHtml({buffer})).value;
  // Raw paragraph text retains literal clause numbers. HTML preserves table and heading boundaries.
  const tags=[...html.matchAll(/<(h[1-6]|p|tr)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const metadata=tags.map(([,tag,value])=>({heading:/^h/i.test(tag),table:tag==='tr'}));
  raw.split(/\r?\n/).filter(Boolean).forEach((text,i)=>lines.push({text,...(metadata[i]||{})}));
  for(const [i,row] of [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].entries()){
   const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim());
   if(cells.some(Boolean))lines.push({text:`Строка таблицы ${i+1}: ${cells.join(' | ')}`,table:`Таблица ${i+1}`});
  }
  if(!lines.length)throw Error(`${name}: нет извлекаемого текста. Для сканов требуется OCR.`);
 }else if(ext==='.xlsx'){
  const {default:ExcelJS}=await import('exceljs'),wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);
  for(const sheet of wb.worksheets){
   lines.push({text:`Лист: ${sheet.name}`,sheet:sheet.name});
   sheet.eachRow(row=>{
    const cells=[];row.eachCell(cell=>{if(cell.text.trim())cells.push({text:cell.text.trim(),address:cell.address});});
    if(!cells.length)return;
    if(title.test(cells[0].text)){
     lines.push({text:cells[0].text,sheet:sheet.name,row:row.number,cell:cells[0].address,table:`${sheet.name}!${row.number}`});
     if(cells.length>1)lines.push({text:cells.slice(1).map(c=>c.text).join(' | '),sheet:sheet.name,row:row.number,cell:cells[1].address,table:`${sheet.name}!${row.number}`});
    }else lines.push({text:cells.map(c=>c.text).join(' | '),sheet:sheet.name,row:row.number,cell:cells[0].address,table:`${sheet.name}!${row.number}`});
   });
  }
 }else if(ext==='.pdf'){
  const {default:pdf}=await import('pdf-parse/lib/pdf-parse.js');
  let pageNumber=0;
  await pdf(Uint8Array.from(buffer),{version:'v2.0.550',pagerender:async page=>{
   pageNumber++;
   const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});
   let current='',lastY=null;
   for(const item of content.items){const y=item.transform?.[5];if(lastY!==null&&y!==lastY&&current.trim()){lines.push({text:current.trim(),page:pageNumber});current='';}current+=(current?' ':'')+item.str;lastY=y;if(item.hasEOL){lines.push({text:current.trim(),page:pageNumber});current='';lastY=null;}}
   if(current.trim())lines.push({text:current.trim(),page:pageNumber});
   return '';
  }});
  if(!lines.some(x=>x.text.trim()))throw Error(`${name}: нет текстового слоя. Для сканов требуется OCR.`);
 }else throw Error('Поддерживаются DOCX, PDF, XLSX, TXT и MD.');
 return structureLines(lines,{id,name,period,format:ext.slice(1)});
}
