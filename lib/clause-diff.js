const normalize=s=>s.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').replace(/[.,;:()«»"']/g,'').trim();
// Pair revisions of the same named document. A clause number alone is not a document identity.
export function documentFamily(name){return String(name).toLowerCase().replace(/ё/g,'е').replace(/\.(docx|pdf|xlsx|txt|md)$/,'').replace(/_/g,' ').replace(/\(\d+\)\s*$/,'').replace(/(?:редакци[яи]|ред\.|верси[яи]|version|revision)\s*\d+/g,'').replace(/\b(?:before|after)\b/g,'').replace(/(?:^|\s)(?:до|после)(?:\s+реорганизации)?(?=\s|$)/g,' ').replace(/\s+/g,' ').trim();}
const source=s=>s&&({documentId:s.documentId,document:s.document,point:s.section,page:s.page,sheet:s.sheet,quote:s.text,segmentId:s.id});
export function compareClauses(documents){
 const periods={before:new Map(),after:new Map()};
 for(const doc of documents)for(const s of doc.segments||[]){
  if(!/^\d+(?:\.\d+)+$/.test(s.section||'')||!s.text.match(/^\d+(?:\.\d+)*\./))continue;
  const key=JSON.stringify([documentFamily(doc.name),s.section]);
  const candidate=periods[doc.period].get(key);
  if(!candidate||candidate.text.length<s.text.length)periods[doc.period].set(key,s);
 }
 const changes=[];
 for(const key of new Set([...periods.before.keys(),...periods.after.keys()])){
  const before=periods.before.get(key),after=periods.after.get(key);
  if(before&&after&&normalize(before.text)===normalize(after.text))continue;
  changes.push({clause:(before||after).section,type:!before?'added':!after?'removed':'changed',before:source(before),after:source(after)});
 }
 return changes.sort((a,b)=>a.clause.localeCompare(b.clause,'ru',{numeric:true}));
}
