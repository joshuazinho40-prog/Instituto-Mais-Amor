ALTER TABLE projetos_gestao ADD COLUMN resumo TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE projetos_gestao ADD COLUMN publicado INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE anexos (id TEXT PRIMARY KEY NOT NULL,titulo TEXT NOT NULL,descricao TEXT NOT NULL DEFAULT '',nome TEXT NOT NULL,mime TEXT NOT NULL,tamanho INTEGER NOT NULL,chave TEXT NOT NULL,publico INTEGER NOT NULL DEFAULT 0,criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX anexos_publicacao ON anexos(publico,atualizado_em);
