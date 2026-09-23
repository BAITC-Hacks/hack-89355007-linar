import {test} from 'node:test';
import assert from 'node:assert/strict';
import {semanticCandidates} from '../lib/semantic.js';
test('Смысловые кандидаты сохраняют ID и используют исходные тексты',async()=>{
 let sent;
 const functions=[{id:'old',period:'before',text:'Управление бюджетом'},{id:'new',period:'after',text:'Планирование финансов'}];
 const fetcher=async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({data:[{index:1,embedding:[1,0]},{index:0,embedding:[1,0]}]})};};
 const found=await semanticCandidates(functions,{key:'test',fetcher});
 assert.deepEqual(found,[{beforeId:'old',afterId:'new',score:1}]);
 assert.equal(sent.url,'https://api.openai.com/v1/embeddings');
 assert.deepEqual(JSON.parse(sent.options.body).input,functions.map(f=>f.text));
});
test('Без ключа смысловой поиск отключён',async()=>{
 await assert.rejects(()=>semanticCandidates([],{key:''}),/OPENAI_API_KEY/);
});
