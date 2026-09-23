// Вымышленная учебная организация. Все имена и данные здесь демонстрационные.
export const organization = {
 id:'org-demo', name:'Тестовая телекоммуникационная компания', kind:'demo', version:1,
 processes:[
  {id:'strategy',name:'Стратегическое управление'},
  {id:'security',name:'Управление информационной безопасностью'},
  {id:'incident',name:'Реагирование на инциденты ИБ'},
  {id:'infrastructure',name:'Эксплуатация ИТ-инфраструктуры'},
  {id:'network',name:'Эксплуатация сети связи'},
  {id:'budget',name:'Бюджетирование и платежи'},
  {id:'legal',name:'Правовая экспертиза договоров'},
  {id:'personnel',name:'Управление персоналом'},
  {id:'audit',name:'Внутренний аудит'}
 ],
 units:[
  {id:'leadership',name:'Руководство',parentId:null,head:'Генеральный директор',positions:['Генеральный директор'],functions:['Утверждает стратегию и организационную структуру','Устанавливает цели подразделений'],authorities:['Утверждать внутренние документы','Назначать руководителей подразделений'],responsibilities:['Общее управление компанией','Контроль исполнения стратегии'],processIds:['strategy']},
  {id:'security',name:'Департамент информационной безопасности',parentId:'leadership',head:'Руководитель департамента ИБ',positions:['Руководитель департамента ИБ','Аналитик ИБ','Специалист ИБ'],functions:['Разрабатывает требования ИБ','Анализирует события безопасности','Координирует реагирование на инциденты'],authorities:['Запрашивать сведения об инцидентах','Инициировать проверку соблюдения требований ИБ'],responsibilities:['Контроль рисков ИБ','Методическое сопровождение защиты информации'],processIds:['security','incident']},
  {id:'it',name:'ИТ-департамент',parentId:'leadership',head:'Руководитель ИТ-департамента',positions:['Руководитель ИТ-департамента','Системный администратор','Сетевой инженер'],functions:['Поддерживает серверы и рабочие станции','Обеспечивает эксплуатацию сети','Исполняет технические изменения по согласованным заявкам'],authorities:['Администрировать ИТ-системы в рамках ролей','Проводить технические работы по утверждённым заявкам'],responsibilities:['Доступность ИТ-сервисов','Техническое выполнение изменений'],processIds:['infrastructure','network','incident']},
  {id:'finance',name:'Финансовый департамент',parentId:'leadership',head:'Руководитель финансового департамента',positions:['Руководитель финансового департамента','Финансовый аналитик'],functions:['Формирует бюджет','Организует проведение платежей'],authorities:['Запрашивать финансовые планы подразделений','Подготавливать платёжные документы'],responsibilities:['Достоверность бюджетных данных','Соблюдение финансовых процедур'],processIds:['budget']},
  {id:'legal',name:'Юридический департамент',parentId:'leadership',head:'Руководитель юридического департамента',positions:['Руководитель юридического департамента','Юрист'],functions:['Проводит правовую экспертизу договоров','Консультирует подразделения по правовым вопросам'],authorities:['Запрашивать проекты договоров','Выдавать правовые заключения'],responsibilities:['Качество правовых заключений','Сопровождение договорной работы'],processIds:['legal']},
  {id:'hr',name:'HR',parentId:'leadership',head:'Руководитель HR',positions:['Руководитель HR','Специалист по персоналу'],functions:['Ведёт кадровый учёт','Организует подбор и обучение персонала'],authorities:['Запрашивать кадровые сведения в пределах полномочий','Организовывать обучение'],responsibilities:['Актуальность кадровых данных','Координация развития персонала'],processIds:['personnel']},
  {id:'audit',name:'Внутренний аудит',parentId:'leadership',head:'Руководитель внутреннего аудита',positions:['Руководитель внутреннего аудита','Внутренний аудитор'],functions:['Планирует и проводит внутренние проверки','Готовит независимые рекомендации по результатам проверок'],authorities:['Запрашивать документы по утверждённому плану проверки','Представлять результаты руководству'],responsibilities:['Объективность выводов','Сохранность материалов проверки'],processIds:['audit','security','budget']}
 ]
};

export function validateOrganization(model){
 const errors=[];
 if(!model||!Array.isArray(model.units)||!Array.isArray(model.processes))return ['Отсутствуют подразделения или процессы'];
 const ids=new Set(),processes=new Set(model.processes.map(p=>p.id));
 for(const u of model.units){
  if(ids.has(u.id))errors.push(`Повторяется ID подразделения: ${u.id}`);ids.add(u.id);
  for(const field of ['id','name','head'])if(!u[field])errors.push(`${u.id}: не заполнено поле ${field}`);
  for(const field of ['positions','functions','authorities','responsibilities','processIds'])if(!Array.isArray(u[field])||!u[field].length)errors.push(`${u.id}: не заполнено поле ${field}`);
  if(Array.isArray(u.positions)&&u.head&&!u.positions.includes(u.head))errors.push(`${u.id}: руководитель отсутствует в должностях`);
 }
 if(model.units.filter(u=>u.parentId===null).length!==1)errors.push('Должно быть ровно одно корневое подразделение');
 for(const u of model.units){
  if(u.parentId!==null&&!ids.has(u.parentId))errors.push(`${u.id}: неизвестное вышестоящее подразделение ${u.parentId}`);
  for(const id of u.processIds||[])if(!processes.has(id))errors.push(`${u.id}: неизвестный процесс ${id}`);
  const path=new Set();let current=u;
  while(current?.parentId){if(path.has(current.id)){errors.push(`${u.id}: цикл подчинённости`);break;}path.add(current.id);current=model.units.find(x=>x.id===current.parentId);}
 }
 return errors;
}
