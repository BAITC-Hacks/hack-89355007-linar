import {test} from 'node:test';
import assert from 'node:assert/strict';
import {organization} from '../lib/organization.js';
import {employees} from '../lib/employees.js';
import {assignments,buildFunctionMap,functionMap,validateAssignments} from '../lib/function-map.js';

test('AS-IS связывает каждую функцию с сотрудником, полномочием и ответственностью',()=>{
 assert.deepEqual(validateAssignments(),[]);
 assert.equal(functionMap.rows.length,employees.employees.reduce((sum,e)=>sum+e.functions.length,0));
 assert.equal(new Set(functionMap.rows.map(r=>r.id)).size,functionMap.rows.length);
 assert.equal(new Set(functionMap.rows.map(r=>r.employeeId)).size,employees.employees.length);
 assert.equal(functionMap.state,'AS-IS');
 for(const row of functionMap.rows){
  const person=employees.employees.find(e=>e.id===row.employeeId),unit=organization.units.find(u=>u.id===row.unitId);
  assert.equal(person.unitId,unit.id);
  assert.equal(row.function,person.functions[row.source.functionIndex]);
  assert.equal(row.authority,person.authorities[row.source.authorityIndex]);
  assert.equal(row.responsibility,person.responsibilities[row.source.responsibilityIndex]);
 }
});

test('Неполная или неверная карта отклоняется',()=>{
 const broken=structuredClone(assignments);broken['emp-003'][0][1]=99;broken['emp-006'].pop();
 assert.ok(validateAssignments(broken).some(e=>e.includes('полномочие 99')));
 assert.ok(validateAssignments(broken).some(e=>e.includes('не назначена')));
 assert.throws(()=>buildFunctionMap(broken),/некорректна/);
});
