import {analyze} from './analyzer.js';
import {catalog,requirements,checkRequirements} from './regulatory.js';
import {buildKnowledge} from './knowledge.js';
import {ruleExtract} from './extraction-agent.js';
import {compareClauses} from './clause-diff.js';
import {deriveInternalRequirements} from './document-requirements.js';

const sourceById=new Map(catalog.sources.map(s=>[s.id,s]));
const contextFor=(item,docs)=>({requirementId:item.id,statement:item.statement,category:item.category,sourceId:item.sourceId,sourceTitle:sourceById.get(item.sourceId)?.title,sourceKind:sourceById.get(item.sourceId)?.kind,sourceUrl:sourceById.get(item.sourceId)?.url||null,clause:item.clause,internalSource:sourceById.get(item.sourceId)?.path||null,sourceAvailable:!!sourceById.get(item.sourceId)?.path&&docs.some(d=>d.name===sourceById.get(item.sourceId).path.split('/').at(-1))});

export function auditDocuments(documents,{object=null,analysis=null,facts=null}={}){
 if(!Array.isArray(documents)||!documents.some(d=>d.period==='before')||!documents.some(d=>d.period==='after'))throw Error('Нужны документы до и после');
 const baseline=analysis||analyze(documents),model=buildKnowledge(documents),checks=checkRequirements(documents);
 const beforeUnits=new Set(baseline.functions.filter(f=>f.period==='before').map(f=>f.unit));
 const applicable=requirements.requirements.filter(r=>!object||r.appliesTo.some(u=>u.toLowerCase().includes(object.toLowerCase())||object.toLowerCase().includes(u.toLowerCase())));
 const controls=applicable.map(item=>{
  const check=checks.find(c=>c.id===item.id),context=contextFor(item,documents),scoped=item.appliesTo.some(u=>beforeUnits.has(u));
  const assessed=scoped&&context.sourceAvailable;
  return {...context,criterion:item.criterion,appliesTo:item.appliesTo,status:assessed?check.status:'not-assessed',evidence:assessed?check.evidence:[],missing:assessed?check.missing:[]};
 });
 for(const c of deriveInternalRequirements(documents))if(!object||c.appliesTo.some(u=>u.toLowerCase().includes(object.toLowerCase())))controls.push({...c,requirementId:c.id});
 const target=f=>!object||f.units.some(u=>u.toLowerCase().includes(object.toLowerCase())||object.toLowerCase().includes(u.toLowerCase()))||f.description.toLowerCase().includes(object.toLowerCase());
 const findings=baseline.findings.filter(target).map(f=>({
  ...f,requirements:controls.filter(c=>c.status!=='not-assessed'&&f.units.some(u=>c.appliesTo.includes(u))&&(
    c.statement.toLowerCase().includes('инцидент')&&f.description.toLowerCase().includes('инцидент')||
    c.statement.toLowerCase().includes('резервн')&&f.description.toLowerCase().includes('резервн')
  )).map(c=>({requirementId:c.requirementId,sourceTitle:c.sourceTitle,sourceKind:c.sourceKind,clause:c.clause,sourceUrl:c.sourceUrl,statement:c.statement}))
 }));
 for(const c of controls.filter(c=>c.status==='needs-review'&&!c.requirementId.startsWith('DOC-')))findings.push({id:`C-${c.requirementId}`,type:'responsibility',severity:'medium',title:'Контрольное требование требует проверки',description:c.criterion,explanation:`В проанализированном комплекте не найдены все подтверждения критерия ${c.requirementId}. Отсутствие строки не доказывает нарушение.`,units:c.appliesTo,sources:c.evidence,recommendation:'Проверить полноту документов и закрепить владельца функции.',requirements:[{requirementId:c.requirementId,sourceTitle:c.sourceTitle,sourceKind:c.sourceKind,clause:c.clause,sourceUrl:c.sourceUrl,statement:c.statement}]});
 const clauseChanges=compareClauses(documents);
 for(const change of clauseChanges.filter(c=>c.before&&c.after&&(!object||'внутренний аудит'.includes(object.toLowerCase()))&&/внутренн.*аудит/i.test(c.before.document)&&/^(?:3|5|7)\./.test(c.clause)).slice(0,30)){
  findings.push({id:`P-${change.clause}${findings.some(f=>f.id===`P-${change.clause}`)?`-${change.before.documentId}`:''}`,type:'clause-change',severity:'medium',title:'Изменён пункт положения',description:`Пункт ${change.clause} изложен иначе в новой редакции.`,explanation:'Сравнение текста пункта в двух редакциях. Влияние на функции и полномочия подтверждает аудитор.',units:['Внутренний аудит'],sources:[change.before,change.after],recommendation:'Сопоставить прежнее и новое распределение обязанностей по этому пункту.',requirements:[{requirementId:null,sourceTitle:change.before.document,sourceKind:'internal',clause:change.clause,sourceUrl:null,statement:'Пункт предыдущей редакции положения'}]});
 }
 return {...baseline,findings,controls,requirements:controls.map(c=>({...c,id:c.requirementId})),clauseChanges,auditObject:object,extraction:facts||ruleExtract(documents),knowledge:{departments:model.departments.length,employees:model.employees.length,fragments:model.fragments.length},auditNote:'Внешние законодательные и международные источники пока только ссылки. Без извлечённых и утверждённых критериев из их пунктов юридическое соответствие не проверяется.'};
}

export function renderAuditReport(audit,decisions){
 if(!audit||!Array.isArray(audit.findings)||!decisions||typeof decisions!=='object'||Array.isArray(decisions))throw Error('Некорректное решение аудитора');
 const known=new Set(audit.findings.map(f=>f.id));
 if(Object.entries(decisions).some(([id,v])=>!known.has(id)||!['confirmed','rejected','pending'].includes(v?.status)||typeof v?.comment!=='string'||v.comment.length>1000))throw Error('Некорректные ID или статусы решений');
 const confirmed=audit.findings.filter(f=>decisions[f.id]?.status==='confirmed');
 const lines=['# Заключение по организационной структуре',`Объект аудита: ${audit.auditObject||'компания'}`,`Комплект: ${audit.documents.length} документов. Подтверждено наблюдений: ${confirmed.length}.`,'',audit.auditNote,''];
 for(const [i,f] of confirmed.entries()){
  lines.push(`## Аудиторское наблюдение №${i+1}`,`Тип: ${f.title}`,`Объект: ${f.units.join(', ')}`,`Что обнаружено: ${f.description}`,`Риск: ${f.severity==='high'?'Высокий':'Средний'}`);
  if(f.requirements.length)lines.push('Нормативное основание: '+f.requirements.map(r=>`${r.sourceTitle}, пункт ${r.clause} (${r.sourceKind==='external'?'справочный источник':'внутренний документ'})${r.sourceUrl?`, ${r.sourceUrl}`:''}`).join('; '));
  else lines.push('Нормативное основание: не установлено для этого наблюдения; требуется экспертная привязка.');
  lines.push('Доказательства:');
  for(const s of f.sources)lines.push(`- ${s.document}, ${s.point||'пункт не определён'}${s.page?`, стр. ${s.page}`:''}${s.sheet?`, лист ${s.sheet}`:''}: «${s.quote}»`);
  if(!f.sources.length)lines.push('- Подтверждающий пункт после реорганизации не найден в представленном комплекте.');
  lines.push(`Рекомендация: ${f.recommendation}`,`Решение аудитора: подтверждено. ${decisions[f.id].comment}`,'');
 }
 lines.push(`Отклонено аудитором: ${audit.findings.filter(f=>decisions[f.id]?.status==='rejected').length}. Без решения: ${audit.findings.filter(f=>!decisions[f.id]||decisions[f.id].status==='pending').length}.`);
 return lines.join('\n');
}
