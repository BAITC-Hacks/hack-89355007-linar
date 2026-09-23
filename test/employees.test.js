import {test} from 'node:test';
import assert from 'node:assert/strict';
import {organization} from '../lib/organization.js';
import {employees,validateEmployees} from '../lib/employees.js';

test('Все синтетические сотрудники связаны с подразделениями и должностями',()=>{
 assert.equal(employees.kind,'demo');
 assert.equal(employees.employees.length,15);
 assert.deepEqual(validateEmployees(employees,organization),[]);
 assert.ok(employees.employees.every(e=>e.functions.length&&e.authorities.length&&e.responsibilities.length));
});

test('Проверка отклоняет неизвестное подразделение и повторяющийся ID',()=>{
 const invalid=structuredClone(employees);
 invalid.employees[0].unitId='unknown';
 invalid.employees[1].id=invalid.employees[0].id;
 const errors=validateEmployees(invalid,organization);
 assert.ok(errors.some(e=>e.includes('неизвестное подразделение')));
 assert.ok(errors.some(e=>e.includes('повторяется ID')));
});
