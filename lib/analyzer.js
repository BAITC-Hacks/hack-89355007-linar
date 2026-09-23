const stop = new Set(['и','в','по','на','с','за','для','от','до','или','об','о','к','из','компании','осуществление','обеспечение']);
function tokens(text) { return new Set(text.toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z\s]/g,' ').split(/\s+/).filter(x=>x.length>2&&!stop.has(x)).map(x=>x.replace(/(ирование|ования|ение|ания|ого|ами|ями|ов|ий|ый|ая|ое|ые|ом|ам|ах|ть|ия|ие|ей|ы|а|я|у|и)$/,''))); }
export function similarity(a,b) { const x=tokens(a),y=tokens(b); return x.size&&y.size ? [...x].filter(v=>y.has(v)).length/Math.max(x.size,y.size):0; }
export function analyze(documents) {
 const functions=[],units=[],mappings=[],warnings=[],diagnostics=[];
 for(const doc of documents) {
  let unit=null;
  const ignored=[];let headingCount=0,functionCount=0;
  for(const [index,raw] of doc.text.split(/\r?\n/).entries()) {
   const line=raw.trim(); if(!line)continue;
   const mapping=line.match(/^Реорганизация:\s*(.+?)\s*(?:→|->)\s*(.+)$/i);
   const source=(point)=>({documentId:doc.id,document:doc.name,point,quote:line,...(doc.sourceMap?.[index]||{})});
   if(mapping&&doc.period==='after')mappings.push({before:mapping[1],after:mapping[2],source:source(`строка ${index+1}`)});
   const head=line.match(/^(?:Подразделение|Департамент|Отдел)\s*:\s*(.+)$/i);
   if(head) {unit=head[1];headingCount++;units.push({name:unit,period:doc.period,source:source(`строка ${index+1}`)});continue;}
   const f=line.match(/^(\d+(?:\.\d+)*)(?:[.)]|\s)\s*(.{12,})$/);
   if(f&&unit&&(!doc.sourceMap||doc.sourceMap[index]?.kind==='function')){functionCount++;functions.push({id:`${doc.id}-${index}`,unit,period:doc.period,text:f[2],source:source(f[1])});}
   else if(!mapping&&ignored.length<30)ignored.push({line:index+1,text:line.slice(0,240),reason:f?'Нет заголовка подразделения':'Строка не соответствует формату заголовка или нумерованной функции'});
  }
  diagnostics.push({documentId:doc.id,document:doc.name,period:doc.period,headings:headingCount,functions:functionCount,ignored,ignoredCount:doc.text.split(/\r?\n/).filter(l=>l.trim()).length-headingCount-functionCount-doc.text.split(/\r?\n/).filter(l=>/^Реорганизация:\s*/i.test(l.trim())).length});
  if(!functions.some(f=>f.source.documentId===doc.id)&&!units.some(u=>u.source.documentId===doc.id))warnings.push(`${doc.name}: не распознаны подразделения и нумерованные функции. Проверьте структуру извлечённого текста.`);
 }
 const before=functions.filter(f=>f.period==='before'),after=functions.filter(f=>f.period==='after');
 const table=before.map(f=>{const candidates=after.map(a=>({function:a,score:similarity(f.text,a.text)})).sort((a,b)=>b.score-a.score);const matches=candidates.filter(c=>c.score>=0.72);return {before:f,matches,status:matches.length?'preserved':'lost'};});
 const findings=[];
 for(const row of table.filter(r=>r.status==='lost'))findings.push({type:'loss',severity:'high',title:'Функция не найдена в новой структуре',description:row.before.text,explanation:`Среди ${after.length} распознанных функций «после» нет совпадения с оценкой ≥ 72%. Это сигнал для проверки полноты документов, а не доказательство упразднения функции.`,units:[row.before.unit],sources:[row.before.source],recommendation:'Проверить комплект документов «после» и закрепить функцию за ответственным подразделением.'});
 for(let i=0;i<after.length;i++)for(let j=i+1;j<after.length;j++) {const a=after[i],b=after[j];const score=similarity(a.text,b.text);if(a.unit!==b.unit&&score>=0.82)findings.push({type:'duplicate',severity:'medium',title:'Возможное дублирование функции',description:a.text,explanation:`Совпадение значимых слов: ${Math.round(score*100)}%. Функция описана у двух подразделений. Проверьте границы ответственности и распределение ролей.`,units:[a.unit,b.unit],sources:[a.source,b.source],recommendation:'Уточнить владельца функции и разграничить исполнение, координацию и контроль.'});}
 for(const unit of new Set(after.map(f=>f.unit))) {const ff=after.filter(f=>f.unit===unit);const execute=ff.find(f=>/проведение платеж|осуществление платеж|проведени[ея] закуп/i.test(f.text));const control=ff.find(f=>/контроль.*платеж|контроль.*закуп/i.test(f.text));if(execute&&control&&execute.id!==control.id&&similarity(execute.text,control.text)>=0.35)findings.push({type:'conflict',severity:'high',title:'Исполнение и контроль в одном подразделении',description:'В одном подразделении закреплены проведение операций и контроль их исполнения.',explanation:'Правило разделения обязанностей обнаружило пару «исполнение / контроль» для схожего предмета. Наличие независимого контроля требует проверки сотрудником.',units:[unit],sources:[execute.source,control.source],recommendation:'Проверить независимость контрольной роли и необходимость разделения полномочий.'});}
 const bn=[...new Set(units.filter(u=>u.period==='before').map(u=>u.name))],an=[...new Set(units.filter(u=>u.period==='after').map(u=>u.name))];
 const structure=bn.map(name=>{const map=mappings.find(m=>m.before===name&&an.includes(m.after));return {before:name,after:an.includes(name)?name:map?.after||null,status:an.includes(name)?'preserved':map?'reorganized':'removed',source:map?.source||units.find(u=>u.name===name&&u.period==='before').source};});
 for(const name of an)if(!structure.some(u=>u.after===name))structure.push({before:null,after:name,status:'created',source:units.find(u=>u.name===name&&u.period==='after').source});
 for(const u of structure) {
  u.sources=[u.source];
  for(const period of ['before','after']) {const source=units.find(x=>x.period===period&&x.name===u[period])?.source;if(source&&!u.sources.some(s=>s.documentId===source.documentId&&s.point===source.point))u.sources.push(source);}
 }
 if(!before.length)warnings.push('Не распознаны функции «до»: проверка потери функций недоступна.');
 if(!after.length)warnings.push('Не распознаны функции «после»: выводы о потере функций нельзя оценивать без проверки извлечения.');
 return {documents,functions,table,structure,diagnostics,findings:findings.map((f,i)=>({...f,id:`R-${String(i+1).padStart(3,'0')}`})),warnings,createdAt:new Date().toISOString(),method:'Локальное сопоставление значимых слов и правил разделения обязанностей. Оценки не являются вероятностями.'};
}
