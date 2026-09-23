const normalize=s=>s.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').replace(/[.,;:()«»"']/g,'').trim();
export function compareClauses(documents){
 const periods={before:new Map(),after:new Map()};
 for(const doc of documents)for(const s of doc.segments||[]){
  if(!/^\d+(?:\.\d+)+$/.test(s.section||'')||!s.text.match(/^\d+(?:\.\d+)*\./))continue;
  const candidate=periods[doc.period].get(s.section);
  if(!candidate||candidate.text.length<s.text.length)periods[doc.period].set(s.section,s);
 }
 const changes=[];
 for(const clause of new Set([...periods.before.keys(),...periods.after.keys()])){
  const before=periods.before.get(clause),after=periods.after.get(clause);
  if(before&&after&&normalize(before.text)===normalize(after.text))continue;
  const source=s=>s&&({documentId:s.documentId,document:s.document,point:s.section,page:s.page,sheet:s.sheet,quote:s.text,segmentId:s.id});
  changes.push({clause,type:!before?'added':!after?'removed':'changed',before:source(before),after:source(after)});
 }
 return changes.sort((a,b)=>a.clause.localeCompare(b.clause,'ru',{numeric:true}));
}
