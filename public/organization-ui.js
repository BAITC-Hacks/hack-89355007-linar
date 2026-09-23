const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const items=values=>`<ul>${values.map(value=>`<li>${escapeHtml(value)}</li>`).join('')}</ul>`;

export function organizationView(model){
 if(!model)return '<div class="panel org-card">Загружаем модель компании…</div>';
 const units=new Map(model.units.map(unit=>[unit.id,unit]));
 const processes=new Map(model.processes.map(process=>[process.id,process.name]));
 return `<div class="notice">Учебная модель вымышленной компании. Данные предназначены для проверки следующих этапов проекта.</div>
 <section class="panel org-card"><div class="eyebrow">ЦИФРОВАЯ МОДЕЛЬ</div><h2>${escapeHtml(model.name)}</h2><p>${model.units.length} подразделений · ${model.processes.length} связанных процессов</p>
 <div class="org-grid">${model.units.map(unit=>`<details class="org-unit" ${unit.parentId===null?'open':''}><summary><strong>${escapeHtml(unit.name)}</strong><span>${unit.parentId===null?'Корень структуры':`Подчиняется: ${escapeHtml(units.get(unit.parentId)?.name||'Не определено')}`}</span></summary>
 <div class="org-unit-body"><p><b>Руководитель:</b> ${escapeHtml(unit.head)}</p><h3>Должности</h3>${items(unit.positions)}<h3>Функции</h3>${items(unit.functions)}<h3>Полномочия</h3>${items(unit.authorities)}<h3>Ответственность</h3>${items(unit.responsibilities)}<h3>Связанные процессы</h3>${items(unit.processIds.map(id=>processes.get(id)||id))}</div></details>`).join('')}</div></section>`;
}
