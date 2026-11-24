CREATE TABLE registros_operacionais (id TEXT PRIMARY KEY NOT NULL,cadastro_id TEXT,tipo TEXT NOT NULL,data_ocorrencia TEXT NOT NULL,quantidade INTEGER NOT NULL,notas TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX registros_operacionais_periodo ON registros_operacionais(data_ocorrencia,tipo);
