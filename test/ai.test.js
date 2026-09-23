import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from '../lib/analyzer.js';
import {demoDocuments} from '../lib/demo.js';
import {publicProviders,providerConfigs,requestReview,reviewWithProviders,validateReview} from '../lib/ai.js';
const baseline=analyze(demoDocuments);
const env={OPENAI_API_KEY:'test-openai-secret',NVIDIA_API_KEY:'test-nvidia-secret'};
const providers=providerConfigs(env);
function review(){return {
 matches:baseline.table.map(row=>({beforeId:row.before.id,afterIds:row.matches.map(m=>m.function.id),explanation:row.matches.length?'Предмет и обязанности совпадают.':'Функция не найдена в распознанном комплекте.'})),
 findings:baseline.findings.filter(f=>f.type!=='loss').map(f=>({type:f.type,severity:f.severity,title:f.title,description:f.description,explanation:f.explanation,recommendation:f.recommendation,functionIds:f.sources.map(s=>baseline.functions.find(x=>x.source.documentId===s.documentId&&x.source.point===s.point).id)}))
};}
function apiResponse(provider,raw=review()){
 return new Response(JSON.stringify(provider==='openai'?{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}],usage:{input_tokens:100,output_tokens:200}}:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}],usage:{prompt_tokens:100,completion_tokens:200}}),{status:200});
}
test('API status exposes configuration, never keys',()=>{
 const json=JSON.stringify(publicProviders(env));assert.ok(!json.includes('secret'));assert.equal(publicProviders(env)[0].configured,true);assert.equal(publicProviders({})[0].configured,false);
});
test('OpenAI uses Responses, strict schema, server-side key and store:false',async()=>{
 const r=await requestReview(baseline,providers.openai,{fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-openai-secret');
  const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.ok(!body.input.includes('test-openai-secret'));
  return apiResponse('openai');
 }});
 assert.equal(r.findings.length,3);assert.equal(r.usage.inputTokens,100);assert.equal(r.table[0].matches[0].score,null);
 for(const finding of r.findings)for(const source of finding.sources)assert.ok(baseline.documents.find(d=>d.id===source.documentId).text.includes(source.quote));
});
test('NVIDIA uses its endpoint and Chat Completions format',async()=>{
 const r=await requestReview(baseline,providers.nvidia,{fetchImpl:async(url,options)=>{
  assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-nvidia-secret');
  const body=JSON.parse(options.body);assert.equal(body.max_tokens,4096);assert.equal(body.messages[0].role,'system');assert.equal(body.messages[1].role,'user');return apiResponse('nvidia');
 }});assert.equal(r.findings.length,3);
});
test('Rejects invented IDs, omitted functions, duplicate IDs and invalid evidence',()=>{
 let raw=review();raw.matches[0].afterIds=['invented'];assert.throws(()=>validateReview(raw,baseline,providers.openai),/несуществующую/);
 raw=review();raw.matches.pop();assert.throws(()=>validateReview(raw,baseline,providers.openai),/все исходные/);
 raw=review();raw.matches[1]=raw.matches[0];assert.throws(()=>validateReview(raw,baseline,providers.openai),/Некорректное сопоставление/);
 raw=review();raw.findings[0].functionIds=['invented','missing'];assert.throws(()=>validateReview(raw,baseline,providers.openai),/несуществующий источник/);
 raw=review();raw.findings[0].functionIds=[baseline.functions[0].id,baseline.functions[1].id];assert.throws(()=>validateReview(raw,baseline,providers.openai),/несуществующий источник/);
});
test('Missing key never triggers an external request',async()=>{
 let calls=0;await assert.rejects(requestReview(baseline,providerConfigs({}).openai,{fetchImpl:async()=>{calls++;}}),/OPENAI_API_KEY/);assert.equal(calls,0);
});
test('An unsupported risk grouping is omitted with a warning, preserving valid matches',()=>{
 const raw=review();const originalCount=raw.findings.length;
 raw.findings[0].functionIds=baseline.functions.filter(f=>f.period==='after'&&f.unit==='Департамент экономики и финансов').slice(0,2).map(f=>f.id);
 const validated=validateReview(raw,baseline,providers.openai);
 assert.equal(validated.table.length,baseline.table.length);assert.equal(validated.warnings.length,1);assert.equal(validated.findings.length,originalCount);
});
test('HTTP errors do not expose upstream secrets; no automatic retries',async()=>{
 let calls=0;await assert.rejects(requestReview(baseline,providers.openai,{fetchImpl:async()=>{calls++;return new Response('test-openai-secret',{status:401});}}),error=>error.message.includes('Ключ отклонён')&&!error.message.includes('secret'));assert.equal(calls,1);
});
test('Truncated or malformed output is never applied',async()=>{
 await assert.rejects(requestReview(baseline,providers.openai,{fetchImpl:async()=>new Response(JSON.stringify({status:'incomplete',output:[]}))}),/не завершил/);
 await assert.rejects(requestReview(baseline,providers.nvidia,{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]}))}),/не завершил/);
 await assert.rejects(requestReview(baseline,providers.nvidia,{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'not json'}}]}))}),/корректный JSON/);
});
test('Dual mode retains successful provider and reports failed provider',async()=>{
 const outcome=await reviewWithProviders(baseline,'both',{env,fetchImpl:async url=>url.includes('openai.com')?apiResponse('openai'):new Response('{}',{status:429})});
 assert.equal(outcome.reviews.length,1);assert.equal(outcome.errors[0].provider,'nvidia');assert.match(outcome.errors[0].error,/лимит/);
});
test('Dual mode reports differences in semantic matches',async()=>{
 const different=review();different.matches[0].afterIds=[];
 const outcome=await reviewWithProviders(baseline,'both',{env,fetchImpl:async url=>url.includes('openai.com')?apiResponse('openai'):apiResponse('nvidia',different)});
 assert.equal(outcome.reviews.length,2);assert.equal(outcome.disagreements.length,1);assert.equal(outcome.disagreements[0].beforeId,different.matches[0].beforeId);
});
test('Oversized context fails before calling API',async()=>{
 const large=structuredClone(baseline);large.functions[0].text='x'.repeat(60001);let called=false;
 await assert.rejects(requestReview(large,providers.openai,{fetchImpl:async()=>{called=true;}}),/разделите комплект/);assert.equal(called,false);
});
