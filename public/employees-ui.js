const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const list=items=>items.length?`<ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:'<p>Не указаны</p>';

export function employeesView(data,organization){
 if(!data||!organization)return '<section class="panel employee-panel">Загружаем сотрудников…</section>';
 const units=new Map(organization.units.map(u=>[u.id,u.name]));
 return `<div class="notice">Все сотрудники вымышлены. Данные используются только в учебной модели компании.</div>
 <section class="panel employee-panel"><div class="eyebrow">СИНТЕТИЧЕСКИЕ ДАННЫЕ</div><h2>Сотрудники компании</h2><p>${data.employees.length} сотрудников · ${organization.units.length} подразделений</p>
 <div class="employee-grid">${data.employees.map(e=>`<details class="employee-card"><summary><strong>${esc(e.fullName)}</strong><span>${esc(e.position)} · ${esc(units.get(e.unitId)||'Неизвестное подразделение')}</span></summary>
 <div class="employee-body"><p><b>Образование:</b> ${esc(e.education)}</p><p><b>Стаж:</b> ${e.yearsExperience} лет</p><h3>Сертификаты</h3>${list(e.certifications)}<h3>Компетенции</h3>${list(e.competencies)}<h3>Функции</h3>${list(e.functions)}<h3>Полномочия</h3>${list(e.authorities)}<h3>Ответственность</h3>${list(e.responsibilities)}</div></details>`).join('')}</div></section>`;
}
