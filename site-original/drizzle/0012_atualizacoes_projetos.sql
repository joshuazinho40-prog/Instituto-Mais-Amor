ALTER TABLE acoes ADD COLUMN projeto_publico_id TEXT REFERENCES projetos_publicos(id);
--> statement-breakpoint
ALTER TABLE acoes ADD COLUMN versao INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE acoes ADD COLUMN fotos_autorizadas INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX acoes_projeto_data ON acoes(projeto_publico_id,publicada,data_realizacao);
--> statement-breakpoint
CREATE TABLE acoes_fotos (
 acao_id TEXT NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
 caminho TEXT NOT NULL REFERENCES projetos_capas(caminho),
 descricao TEXT NOT NULL DEFAULT '',
 legenda TEXT NOT NULL DEFAULT '',
 ordem INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(acao_id,caminho)
);
