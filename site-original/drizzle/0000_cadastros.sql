CREATE TABLE cadastros (id TEXT PRIMARY KEY NOT NULL,tipo TEXT NOT NULL,nome TEXT NOT NULL,contato TEXT NOT NULL,organizacao TEXT NOT NULL DEFAULT '',mensagem TEXT NOT NULL DEFAULT '',situacao TEXT NOT NULL DEFAULT 'novo',notas TEXT NOT NULL DEFAULT '',privacidade_versao TEXT NOT NULL,criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX cadastros_tipo_situacao ON cadastros(tipo,situacao,criado_em);
--> statement-breakpoint
CREATE TABLE auditoria (id TEXT PRIMARY KEY NOT NULL,ator TEXT NOT NULL,acao TEXT NOT NULL,registro_id TEXT NOT NULL,criado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE limites (chave TEXT PRIMARY KEY NOT NULL,quantidade INTEGER NOT NULL,expira_em INTEGER NOT NULL);
