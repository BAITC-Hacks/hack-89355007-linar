import catalog from '../regulatory/catalog.json' with {type:'json'};
import requirements from '../regulatory/requirements.json' with {type:'json'};

export {catalog,requirements};

// Rules are intentionally explicit and restricted to approved synthetic controls.
const rules={
 'REQ-001':[{file:'Положение о внутреннем аудите.docx',match:/2\.1\. Руководитель внутреннего аудита утверждает план проверок/i}],
 'REQ-002':[{file:'Положение о внутреннем аудите.docx',match:/2\.2\. Внутренний аудит готовит независимые рекомендации и направляет их руководству/i}],
 'REQ-003':[{file:'Приказ о реорганизации.docx',match:/3\.1\. Руководитель ИБ отвечает за назначение владельца реагирования/i},{file:'Должностные инструкции.docx',match:/Руководитель ИБ\s*—\s*реагирование на инциденты/i}],
 'REQ-004':[{file:'Положение об ИТ-департаменте.docx',match:/резервное копирование/i},{file:'Должностные инструкции.docx',match:/Системный администратор\s*—[^\n]*резервное копирование/i}]
};
export function validateKnowledgeBase(sources=catalog.sources,items=requirements.requirements){
 const errors=[],ids=new Set(sources.map(s=>s.id)),seen=new Set();
 for(const item of items){
  if(seen.has(item.id))errors.push(`${item.id}: повтор ID`);seen.add(item.id);
  if(!ids.has(item.sourceId))errors.push(`${item.id}: неизвестный источник`);
  for(const key of ['clause','statement','category','criterion'])if(!item[key])errors.push(`${item.id}: отсутствует ${key}`);
  if(!Array.isArray(item.appliesTo)||!item.appliesTo.length)errors.push(`${item.id}: нет области применения`);
 }
 return errors;
}
export function checkRequirements(documents,period='after'){
 if(!['before','after'].includes(period))throw Error('Некорректный период');
 return requirements.requirements.map(item=>{
  const evidence=[],missing=[];
  for(const rule of rules[item.id]||[]){
   const doc=documents.find(d=>d.period===period&&d.name===rule.file);
   const line=doc?.text.split(/\r?\n/).find(x=>rule.match.test(x));
   if(line)evidence.push({documentId:doc.id,document:doc.name,point:line.match(/^\s*(\d+(?:\.\d+)*)\./)?.[1]||'текст',quote:line.trim()});
   else missing.push(rule.file);
  }
  return {id:item.id,sourceId:item.sourceId,clause:item.clause,criterion:item.criterion,status:missing.length?'needs-review':'found',evidence,missing};
 });
}