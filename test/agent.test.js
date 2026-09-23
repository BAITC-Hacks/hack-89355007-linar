import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from '../lib/agent.js';
const documents=[
 {id:'b',name:'до.txt',period:'before',text:'Подразделение: Финансы\n1.1. Ведение реестра договорных обязательств компании.\n1.2. Формирование финансового бюджета компании.'},
 {id:'a',name:'после.txt',period:'after',text:'Подразделение: Экономика\n2.1. Учет исполнения обязательств по контрактам компании.\n2.2. Подготовка годового финансового бюджета компании.\nПодразделение: Контроль\n3.1. Учет исполнения обязательств по контрактам компании.'}
];
test('Агент сопоставляет перефразировку и отвергает выдуманные источники',async()=>{
 const fetcher=async(_url,options)=>{
  const request=JSON.parse(options.body),functions=JSON.parse(request.input);
  const old=functions.find(f=>f.text.includes('реестра')),newOne=functions.find(f=>f.text.includes('Учет')&&f.unit==='Экономика'),newTwo=functions.find(f=>f.text.includes('Учет')&&f.unit==='Контроль');
  const answer={matches:[{beforeId:old.id,afterId:newOne.id,reason:'Обязанности по договорам'},{beforeId:old.id,afterId:'invented',reason:'ошибка'}],duplicates:[{firstId:newOne.id,secondId:newTwo.id,reason:'Схожие обязанности'},{firstId:newOne.id,secondId:'invented',reason:'ошибка'}],summary:'Одна функция сохранена, одна требует проверки.'};
  return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}]})};
 };
 const result=await runAgent(documents,{key:'test',fetcher});
 assert.equal(result.agent.mode,'ai');
 assert.equal(result.table[0].status,'preserved');
 assert.equal(result.table[1].status,'lost');
 assert.equal(result.findings.filter(f=>f.type==='duplicate').length,1);
 assert.ok(result.findings.every(f=>f.sources.every(s=>documents.some(d=>d.id===s.documentId&&d.text.includes(s.quote)))));
});
