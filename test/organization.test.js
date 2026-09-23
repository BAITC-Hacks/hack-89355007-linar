import {test} from 'node:test';
import assert from 'node:assert/strict';
import {organization,validateOrganization} from '../lib/organization.js';

test('Учебная структура содержит все подразделения и связные процессы',()=>{
 assert.deepEqual(validateOrganization(organization),[]);
 assert.equal(organization.units.length,7);
 for(const id of ['leadership','security','it','finance','legal','hr','audit'])assert.ok(organization.units.some(u=>u.id===id));
 assert.deepEqual(organization.units.find(u=>u.id==='security').positions,['Руководитель департамента ИБ','Аналитик ИБ','Специалист ИБ']);
 assert.deepEqual(organization.units.find(u=>u.id==='it').positions,['Руководитель ИТ-департамента','Системный администратор','Сетевой инженер']);
});

test('Проверка обнаруживает ошибочную подчинённость и неизвестный процесс',()=>{
 const broken=structuredClone(organization);broken.units[1].parentId='missing';broken.units[1].processIds.push('missing');
 assert.ok(validateOrganization(broken).some(e=>e.includes('вышестоящее')));
 assert.ok(validateOrganization(broken).some(e=>e.includes('неизвестный процесс')));
});
