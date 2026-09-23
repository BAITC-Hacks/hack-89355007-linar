import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('./document-data.json',import.meta.url),'utf8'));
for(const period of ['before','after']){
 const wb=Workbook.create(), sheet=wb.worksheets.add('Оргструктура');
 sheet.getRange('A1:D1').values=[['Учебная компания — оргструктура',period==='before'?'До реорганизации':'После реорганизации','','']];
 sheet.getRange('A2:D2').values=[['Подразделение','Руководитель','Подчинённость','Основная функция']];
 const heads=['Генеральный директор','Руководитель ИБ','Руководитель ИТ','Руководитель финансов','Руководитель юридического департамента','Руководитель HR','Руководитель внутреннего аудита'];
 const primary=['Координация деятельности компании','Мониторинг событий информационной безопасности','Управление серверами','Финансовая отчётность','Правовая экспертиза договоров','Кадровый учёт','Планирование внутренних проверок'];
 for(let i=0;i<data.units.length;i++)sheet.getRange(`A${i+3}:D${i+3}`).values=[[`Подразделение: ${data.units[i]}`,heads[i],i?'Руководство':'Совет директоров',primary[i]]];
 sheet.getRange('A1:D1').format={fill:'#17324D',font:{name:'Arial',bold:true,color:'#FFFFFF',size:12}};
 sheet.getRange('A2:D2').format={fill:'#DCEAF4',font:{name:'Arial',bold:true,color:'#111111',size:10}};
 sheet.getRange('A3:D9').format.font={name:'Arial',size:10};
 sheet.getRange('A1:A9').format.columnWidth=49;
 sheet.getRange('B1:B9').format.columnWidth=43;
 sheet.getRange('C1:C9').format.columnWidth=24;
 sheet.getRange('D1:D9').format.columnWidth=53;
 wb.recalculate();
 const file=await SpreadsheetFile.exportXlsx(wb);
 await file.save(fileURLToPath(new URL(`../company_${period}/Оргструктура компании.xlsx`,import.meta.url)));
}