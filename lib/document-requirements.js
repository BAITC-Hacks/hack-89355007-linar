import {compareClauses,documentFamily} from './clause-diff.js';

export function deriveInternalRequirements(documents){
 const changes=new Map(compareClauses(documents).filter(c=>c.before).map(c=>[JSON.stringify([c.before.documentId,c.clause]),c]));
 const out=[];
 for(const doc of documents.filter(d=>d.period==='before'))for(const s of doc.segments||[]){
  if(!/^\d+(?:\.\d+)+$/.test(s.section||'')||!/^\d+(?:\.\d+)*\./.test(s.text)||s.text.length<40||!/обязан|должен|вправе|ответствен|осуществляет|проводит|утверждает|обеспечивает/i.test(s.text))continue;
  if(out.some(r=>r.sourceId===doc.id&&r.clause===s.section))continue;
  const change=changes.get(JSON.stringify([doc.id,s.section]));
  const later=change?.after||documents.filter(d=>d.period==='after'&&documentFamily(d.name)===documentFamily(doc.name)).flatMap(d=>d.segments||[]).find(x=>x.section===s.section&&x.text.startsWith(`${s.section}.`));
  out.push({id:`DOC-${doc.id}-${s.section}`,sourceId:doc.id,sourceTitle:doc.name,sourceKind:'internal',clause:s.section,statement:s.text,criterion:`Проверить сохранение и назначенного ответственного по пункту ${s.section}`,category:/прав[ао]|вправе/i.test(s.text)?'Полномочия':/ответствен|обязан/i.test(s.text)?'Ответственность':'Функция',appliesTo:s.department?[s.department]:[],status:change?'needs-review':later?'found':'needs-review',evidence:[{documentId:doc.id,document:doc.name,point:s.section,page:s.page,quote:s.text},...(later?[{documentId:later.documentId,document:later.document,point:later.point||later.section,page:later.page,quote:later.quote||later.text}]:[])],missing:later?[]:['Пункт отсутствует в комплекте после']});
 }
 return out.slice(0,120);
}
