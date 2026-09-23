import {structureLines} from './document-parser.js';

export function reorganizationScenario(){
 const before=structureLines([
  {text:'Подразделение: Департамент информационной безопасности'},
  {text:'1.1. Мониторинг событий информационной безопасности'},
  {text:'1.2. Реагирование на инциденты информационной безопасности'},
  {text:'1.3. Оценка рисков информационной безопасности'},
  {text:'1.4. Ведение реестра рисков информационной безопасности'}
 ],{id:'split-before',name:'Учебный сценарий ДО.txt',period:'before',format:'txt'});
 const after=structureLines([
  {text:'Реорганизация: Департамент информационной безопасности → Security Operations'},
  {text:'Подразделение: Security Operations'},
  {text:'1.1. Мониторинг событий информационной безопасности'},
  {text:'1.2. Реагирование на инциденты информационной безопасности'},
  {text:'Подразделение: Risk Department'},
  {text:'2.1. Оценка рисков информационной безопасности'}
 ],{id:'split-after',name:'Учебный сценарий ПОСЛЕ.txt',period:'after',format:'txt'});
 return {title:'Разделение Департамента ИБ',description:'А и Б переданы Security Operations, В — Risk Department, функция ведения реестра рисков не передана.',documents:[before,after]};
}
