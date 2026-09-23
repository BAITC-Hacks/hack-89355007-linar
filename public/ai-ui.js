export function createAI({getResult,applyResult,esc,download}) {
 const $=s=>document.querySelector(s);
 let baseline=null,reviews=[],errors=[],disagreements=[],providers=[],busy=false,active='local';
 function render(){
  $('#ai-run').disabled=busy||!baseline||!providers.some(p=>p.configured);
  $('#ai-provider').disabled=busy;
  $('#ai-run').textContent=busy?'Модели анализируют…':'Запустить ИИ-анализ';
  $('#new-analysis').disabled=busy;$('#load-demo').disabled=busy;
  $('#ai-status').textContent=providers.length?providers.map(p=>`${p.label}: ${p.configured?'ключ задан':'нет ключа'} · ${p.model}`).join(' | '):'Не удалось прочитать настройки API';
  $('#ai-error').textContent=errors.map(e=>`${e.provider}: ${e.error}`).join(' ');
  $('#ai-results').innerHTML=reviews.length?`<div class="ai-result-switch"><span>Показать результат:</span><button class="secondary ${active==='local'?'selected':''}" data-review="local">Локальные правила</button>${reviews.map(r=>`<button class="secondary ${active===r.provider?'selected':''}" data-review="${r.provider}">${esc(r.label)} · ${r.findings.length} рисков</button>`).join('')}<button class="text-button" id="ai-export">Скачать оба анализа</button></div><p class="ai-disclosure">${reviews.map(r=>`${esc(r.label)}: вход ${r.usage.inputTokens??'—'} / выход ${r.usage.outputTokens??'—'} токенов`).join(' · ')}. Это расход запроса, не остаток кредитов.</p>${disagreements.length?`<div class="notice warning"><span>Расхождения сопоставления: ${disagreements.length}. Нужна экспертная проверка.<br>${disagreements.map(d=>esc(d.text)).join('<br>')}</span></div>`:reviews.length===2?'<p class="ai-disclosure">Сопоставления функций совпали. Наборы рисков смотрите отдельно у каждого провайдера; совпадение моделей не доказывает правильность.</p>':''}`:'';
 }
 function select(id){
  active=id;
  const review=reviews.find(r=>r.provider===id);
  applyResult(review?{...baseline,table:review.table,findings:review.findings,method:review.method,ai:{provider:review.provider,model:review.model,usage:review.usage},warnings:[...baseline.warnings,...(review.warnings||[]),...errors.map(e=>`${e.provider}: ${e.error}`)]}:baseline);
  render();
 }
 $('#ai-results').addEventListener('click',event=>{
  const button=event.target.closest('[data-review]');if(button&&!busy)select(button.dataset.review);
  if(event.target.closest('#ai-export'))download('OrgLens-ИИ-анализы.json',JSON.stringify({reviews,errors,disagreements,documents:baseline.documents},null,2),'application/json;charset=utf-8');
 });
 $('#ai-run').onclick=async()=>{
  if(busy||!baseline)return;
  const mode=$('#ai-provider').value;
  const required=mode==='both'?['openai','nvidia']:[mode];
  const missing=required.filter(id=>!providers.find(p=>p.id===id)?.configured);
  if(missing.length){errors=[{provider:missing.join(', '),error:'Добавьте ключи в .env и перезапустите сервер.'}];render();return;}
  busy=true;errors=[];render();
  try {
   const response=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:baseline.documents,mode})});
   const data=await response.json();
   if(!Array.isArray(data.reviews))throw Error(data.error||'Не удалось прочитать ответ сервера.');
   reviews=data.reviews;errors=data.errors||[];disagreements=data.disagreements||[];
   select(reviews[0]?.provider||'local');
  }catch(e){errors=[{provider:'ИИ-анализ',error:e.message}];}finally{busy=false;render();}
 };
 fetch('/api/providers').then(r=>{if(!r.ok)throw Error('Ошибка чтения настроек');return r.json();}).then(data=>{providers=data.providers;const enabled=providers.filter(p=>p.configured);if(enabled.length)$('#ai-provider').value=enabled.find(p=>p.id==='openai')?.id||enabled[0].id;render();}).catch(()=>render());
 return {reset(){baseline=getResult();reviews=[];errors=[];disagreements=[];active='local';render();}};
}
