-- Cria banco separado pra Evolution API.
-- Executado automaticamente na primeira subida do container Postgres.
SELECT 'CREATE DATABASE evolution' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
