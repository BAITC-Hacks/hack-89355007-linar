import {organization} from './organization.js';
import {employees} from './employees.js';
import {functionMap} from './function-map.js';
import {catalog,requirements} from './regulatory.js';

export const VECTOR_DIM=64;
export function vectorize(text){const vector=Array(VECTOR_DIM).fill(0),words=String(text).toLowerCase().replace(/ё/g,'е').match(/[а-яa-z0-9]{3,}/g)||[];
 for(const word of words){let hash=2166136261;for(const c of word)hash=Math.imul(hash^c.charCodeAt(0),16777619);vector[(hash>>>0)%VECTOR_DIM]+=1;}
 const norm=Math.hypot(...vector)||1;return vector.map(x=>x/norm);
}
const cosine=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
export function buildKnowledge(documents){
 const fragments=documents.flatMap(d=>d.segments||[]);
 return {departments:organization.units,employees:employees.employees,assignments:functionMap,requirements:requirements.requirements,sources:catalog.sources,fragments};
}
export function searchKnowledge(knowledge,query,{limit=5}={}){
 if(typeof query!=='string'||query.length<3||query.length>500)throw Error('Запрос должен содержать 3–500 символов');
 const q=vectorize(query);
 return knowledge.fragments.map(s=>({segmentId:s.id,document:s.document,period:s.period,point:s.section||s.sheet&&`${s.sheet}!${s.row}`||'фрагмент',page:s.page,quote:s.text,score:cosine(q,vectorize(s.text))})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.min(20,limit));
}
