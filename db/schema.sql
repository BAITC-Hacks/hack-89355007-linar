CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS audit_runs (
 id uuid PRIMARY KEY, object_name text, created_at timestamptz NOT NULL DEFAULT now(),
 analysis jsonb NOT NULL, decisions jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS departments (id text PRIMARY KEY, name text NOT NULL, parent_id text, head text);
CREATE TABLE IF NOT EXISTS employees (id text PRIMARY KEY, full_name text NOT NULL, department_id text REFERENCES departments(id), profile jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS org_functions (id text PRIMARY KEY, department_id text REFERENCES departments(id), employee_id text REFERENCES employees(id), function_name text NOT NULL, authority text, responsibility text);
CREATE TABLE IF NOT EXISTS requirements (id text PRIMARY KEY, source_id text NOT NULL, clause text NOT NULL, criterion text NOT NULL, properties jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS document_fragments (
 id text PRIMARY KEY, run_id uuid NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
 document_name text NOT NULL, period text NOT NULL CHECK(period IN ('before','after')),
 section text, page integer, sheet text, cell text, content text NOT NULL,
 embedding vector(64)
);
CREATE INDEX IF NOT EXISTS document_fragments_run ON document_fragments(run_id);
CREATE INDEX IF NOT EXISTS document_fragments_embedding ON document_fragments USING hnsw (embedding vector_cosine_ops);
