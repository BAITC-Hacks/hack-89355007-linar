export function auditPanel(result,esc){
 if(!result.auditId)return '';
 const changes=result.clauseChanges||[],stats=result.knowledge||{};
 return `<section class="panel quality" id="audit-panel">
  <h2>Аудит документов и база знаний</h2>
  <p>Извлечено фрагментов: ${stats.fragments||0}. Кандидатов на изменение пунктов: ${changes.length}. Для DOCX номер страницы не устанавливается автоматически; ссылка ведёт к номеру пункта и цитате. Выводы требуют решения аудитора.</p>
  <div class="dialog-actions"><button class="secondary" id="download-approved">Скачать заключение по подтверждённым выводам</button></div>
  <label>Поиск фрагментов <input id="knowledge-query" placeholder="Например, полномочия главного аудитора"></label><button class="secondary" id="knowledge-search">Найти источники</button><div id="knowledge-results"></div>
  <h3>Пункты до и после</h3>
  ${changes.slice(0,80).map((c,i)=>`<details><summary>Пункт ${esc(c.clause)} · ${c.type==='added'?'добавлен':c.type==='removed'?'удалён':'изменён'}</summary>${c.before?`<p><strong>До: ${esc(c.before.document)}</strong></p><blockquote>${esc(c.before.quote.slice(0,950))}</blockquote>`:''}${c.after?`<p><strong>После: ${esc(c.after.document)}</strong></p><blockquote>${esc(c.after.quote.slice(0,950))}</blockquote>`:''}</details>`).join('')||'<p>Изменённых нумерованных пунктов не найдено.</p>'}
  ${changes.length>80?`<p>Показаны первые 80 из ${changes.length}; остальные доступны через исходные документы и поиск.</p>`:''}
 </section>`;
}

export async function auditAction(event,{result,reviews,download,esc,toast}){
 if(!result?.auditId)return false;
 const reportButton=event.target.closest('#download-approved');
 if(reportButton){
  try{const response=await fetch('/api/audit/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({auditId:result.auditId,decisions:reviews})});const body=await response.json();if(!response.ok)throw Error(body.error||'Ошибка заключения');download('Аудиторское-заключение.md',body.report,'text/markdown;charset=utf-8');toast(`Скачано заключение. Подтверждено наблюдений: ${body.confirmed}.`);}catch(error){toast(error.message);}return true;
 }
 if(event.target.closest('#knowledge-search')){
  const input=document.querySelector('#knowledge-query'),container=document.querySelector('#knowledge-results');if(!input||!container)return true;
  try{const response=await fetch('/api/audit/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({auditId:result.auditId,query:input.value,limit:8})});const body=await response.json();if(!response.ok)throw Error(body.error||'Ошибка поиска');container.innerHTML=body.matches.map(m=>`<blockquote><strong>${esc(m.document)} · ${esc(m.point||m.section||'пункт')}</strong><br>${esc((m.quote||m.content||'').slice(0,800))}</blockquote>`).join('')||'<p>Совпадений не найдено.</p>';}catch(error){container.textContent=error.message;}return true;
 }
 return false;
}
