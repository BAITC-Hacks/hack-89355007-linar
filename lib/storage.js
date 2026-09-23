import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {vectorize} from './knowledge.js';
import {organization} from './organization.js';
import {employees} from './employees.js';
import {functionMap} from './function-map.js';
import {requirements} from './regulatory.js';

let pool;
export function databaseEnabled(){return !!process.env.DATABASE_URL;}
async function getPool(){if(!databaseEnabled())throw Error('Задайте DATABASE_URL для хранения в PostgreSQL');
 if(!pool){const {default:pg}=await import('pg');pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000});}return pool;
}
export async function migrate(){const db=await getPool();await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));}
export async function saveAudit(audit){const db=await getPool(),id=randomUUID(),client=await db.connect();
 try{await client.query('BEGIN');
  await client.query('INSERT INTO audit_runs(id,object_name,analysis) VALUES($1,$2,$3)',[id,audit.auditObject,JSON.stringify(audit)]);
  for(const u of organization.units)await client.query('INSERT INTO departments(id,name,parent_id,head) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,parent_id=EXCLUDED.parent_id,head=EXCLUDED.head',[u.id,u.name,null,u.head]);
  for(const u of organization.units)if(u.parentId)await client.query('UPDATE departments SET parent_id=$2 WHERE id=$1',[u.id,u.parentId]);
  for(const person of employees.employees)await client.query('INSERT INTO employees(id,full_name,department_id,profile) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET profile=EXCLUDED.profile',[person.id,person.fullName||person.name,person.unitId,JSON.stringify(person)]);
  for(const row of functionMap.rows||[])if(row.employeeId&&row.unitId)await client.query('INSERT INTO org_functions(id,department_id,employee_id,function_name,authority,responsibility) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',[row.id,row.unitId,row.employeeId,row.function,row.authority||null,row.responsibility||null]);
  for(const item of requirements.requirements)await client.query('INSERT INTO requirements(id,source_id,clause,criterion,properties) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET properties=EXCLUDED.properties',[item.id,item.sourceId,item.clause,item.criterion,JSON.stringify(item)]);
  for(const doc of audit.documents)for(const s of doc.segments||[])await client.query('INSERT INTO document_fragments(id,run_id,document_name,period,section,page,sheet,cell,content,embedding) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector)',[`${id}-${s.id}`,id,doc.name,doc.period,s.section,s.page,s.sheet,s.cell,s.text,`[${vectorize(s.text).join(',')}]`]);
  await client.query('COMMIT');return id;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function loadAudit(id){if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Некорректный ID анализа');const db=await getPool(),{rows}=await db.query('SELECT analysis,decisions FROM audit_runs WHERE id=$1',[id]);return rows[0]||null;}
export async function saveDecisions(id,decisions){const db=await getPool();await db.query('UPDATE audit_runs SET decisions=$2 WHERE id=$1',[id,JSON.stringify(decisions)]);}
export async function searchStored(id,query,limit=5){const db=await getPool(),vector=`[${vectorize(query).join(',')}]`;const {rows}=await db.query('SELECT id,document_name,period,section,page,sheet,cell,content,1-(embedding <=> $2::vector) AS score FROM document_fragments WHERE run_id=$1 ORDER BY embedding <=> $2::vector LIMIT $3',[id,vector,Math.min(20,Math.max(1,Number(limit)||5))]);return rows;}
