const cosine=(a,b)=>{let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return dot/(Math.sqrt(aa*bb)||1);};

export async function semanticCandidates(functions,{key=process.env.OPENAI_API_KEY,fetcher=fetch}={}) {
 if(!key)throw Error('Для смыслового поиска задайте OPENAI_API_KEY на сервере');
 if(!Array.isArray(functions)||functions.length>150||functions.some(f=>!['before','after'].includes(f.period)||typeof f.id!=='string'||f.id.length>100||typeof f.text!=='string'||f.text.length>2000))throw Error('Некорректный список функций (не более 150)');
 const before=functions.filter(f=>f.period==='before'),after=functions.filter(f=>f.period==='after');
 if(!before.length||!after.length)throw Error('Нужны функции до и после');
 const response=await fetcher('https://api.openai.com/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'text-embedding-3-small',input:functions.map(f=>f.text)}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Сервис смыслового поиска вернул HTTP ${response.status}`);
 const data=await response.json(),vectors=data.data?.sort((a,b)=>a.index-b.index).map(x=>x.embedding);
 if(vectors?.length!==functions.length||vectors.some(v=>!Array.isArray(v)))throw Error('Некорректный ответ сервиса');
 const candidates=[];
 for(let i=0;i<before.length;i++)for(let j=0;j<after.length;j++){
  const score=cosine(vectors[i],vectors[before.length+j]);
  if(score>=0.72)candidates.push({beforeId:before[i].id,afterId:after[j].id,score:Number(score.toFixed(3))});
 }
 return candidates.sort((a,b)=>b.score-a.score).slice(0,100);
}
