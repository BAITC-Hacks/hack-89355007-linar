import {organization} from './organization.js';
import {employees} from './employees.js';

// AS-IS: индексы [функция, полномочие, ответственность] из версии 1 модели сотрудника.
// Связи задаются явно, а не подбираются ИИ. При изменении записи сотрудника карта проверяется заново.
export const assignments={
 'emp-001':[[0,0,0],[1,1,1]],
 'emp-002':[[0,1,0],[1,0,1]],
 'emp-003':[[0,0,0],[1,1,1]],
 'emp-004':[[0,0,1],[1,1,0]],
 'emp-005':[[0,1,0],[1,0,1]],
 'emp-006':[[0,0,0],[1,1,1]],
 'emp-007':[[0,0,0],[1,1,1]],
 'emp-008':[[0,0,0],[1,1,1]],
 'emp-009':[[0,0,0],[1,1,1]],
 'emp-010':[[0,0,0],[1,1,1]],
 'emp-011':[[0,0,1],[1,1,0]],
 'emp-012':[[0,0,0],[1,1,1]],
 'emp-013':[[0,0,0],[1,1,1]],
 'emp-014':[[0,0,1],[1,1,0]],
 'emp-015':[[0,0,0],[1,1,1]]
};

export function validateAssignments(mapping=assignments,staff=employees,company=organization){
 const errors=[],unitIds=new Set(company.units.map(u=>u.id)),people=new Map(staff.employees.map(e=>[e.id,e]));
 for(const id of Object.keys(mapping))if(!people.has(id))errors.push(`${id}: неизвестный сотрудник`);
 for(const person of staff.employees){
  if(!unitIds.has(person.unitId))errors.push(`${person.id}: неизвестное подразделение`);
  const links=mapping[person.id];if(!Array.isArray(links)) {errors.push(`${person.id}: нет связей функций`);continue;}
  const covered=new Set();
  for(const [row,link] of links.entries()){
   if(!Array.isArray(link)||link.length!==3||link.some(n=>!Number.isInteger(n)||n<0)){errors.push(`${person.id}, строка ${row}: некорректная связь`);continue;}
   const [f,a,r]=link;
   if(covered.has(f))errors.push(`${person.id}: функция ${f} связана повторно`);covered.add(f);
   if(!person.functions[f])errors.push(`${person.id}: функция ${f} не найдена`);
   if(!person.authorities[a])errors.push(`${person.id}: полномочие ${a} не найдено`);
   if(!person.responsibilities[r])errors.push(`${person.id}: ответственность ${r} не найдена`);
  }
  for(let i=0;i<person.functions.length;i++)if(!covered.has(i))errors.push(`${person.id}: функция ${i} не назначена`);
 }
 return errors;
}

export function buildFunctionMap(mapping=assignments,staff=employees,company=organization){
 const errors=validateAssignments(mapping,staff,company);
 if(errors.length)throw Error(`Карта функций некорректна: ${errors.join('; ')}`);
 const units=new Map(company.units.map(u=>[u.id,u]));
 return {id:'as-is-v1',state:'AS-IS',kind:'demo',companyId:company.id,organizationVersion:company.version,employeesVersion:staff.version,
  rows:staff.employees.flatMap(person=>mapping[person.id].map(([f,a,r])=>({
   id:`asis-${person.id}-${f+1}`,unitId:person.unitId,unitName:units.get(person.unitId).name,
   employeeId:person.id,employeeName:person.fullName,position:person.position,
   function:person.functions[f],authority:person.authorities[a],responsibility:person.responsibilities[r],
   source:{employeeId:person.id,functionIndex:f,authorityIndex:a,responsibilityIndex:r}
  })))};
}

export const functionMap=buildFunctionMap();
