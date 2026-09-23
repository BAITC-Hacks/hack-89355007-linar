const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function functionMapView(map){
 if(!map)return '<section class="panel function-map-panel">Загружаем карту функций…</section>';
 const units=[...new Set(map.rows.map(row=>row.unitName))];
 return `<div class="notice">AS-IS — зафиксированное учебное состояние модели. Связи заданы явно на основе синтетических записей сотрудников и требуют проверки перед применением к реальной организации.</div>
 <section class="panel function-map-panel"><div class="eyebrow">КАРТА ФУНКЦИЙ · ${esc(map.state)}</div><h2>Кто за что отвечает</h2><p>${map.rows.length} функций · ${units.length} подразделений · ${new Set(map.rows.map(row=>row.employeeId)).size} сотрудников</p>
 <div class="map-controls"><input id="map-search" type="search" placeholder="Поиск функции или сотрудника" aria-label="Поиск по карте функций"><select id="map-unit" aria-label="Подразделение"><option value="">Все подразделения</option>${units.map(unit=>`<option value="${esc(unit)}">${esc(unit)}</option>`).join('')}</select></div>
 <div id="map-rows" class="map-rows">${functionRows(map.rows)}</div></section>`;
}

function functionRows(rows){return rows.length?rows.map(row=>`<article class="function-chain" data-unit="${esc(row.unitName)}" data-search="${esc(`${row.unitName} ${row.employeeName} ${row.position} ${row.function} ${row.authority} ${row.responsibility}`.toLowerCase())}"><div><small>ПОДРАЗДЕЛЕНИЕ</small><strong>${esc(row.unitName)}</strong></div><div><small>СОТРУДНИК</small><strong>${esc(row.employeeName)}</strong><span>${esc(row.position)}</span></div><div><small>ФУНКЦИЯ</small><strong>${esc(row.function)}</strong></div><div><small>ПОЛНОМОЧИЕ</small><strong>${esc(row.authority)}</strong></div><div><small>ОТВЕТСТВЕННОСТЬ</small><strong>${esc(row.responsibility)}</strong></div></article>`).join(''):'<p>Связи не найдены</p>'}

export function filterFunctionMap(root){
 const search=root.querySelector('#map-search')?.value.trim().toLowerCase()||'';
 const unit=root.querySelector('#map-unit')?.value||'';
 for(const row of root.querySelectorAll('.function-chain'))row.hidden=Boolean((unit&&row.dataset.unit!==unit)||(search&&!row.dataset.search.includes(search)));
}
