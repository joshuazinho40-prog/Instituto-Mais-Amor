CREATE TABLE projetos_publicos (
 id TEXT PRIMARY KEY NOT NULL,
 titulo TEXT NOT NULL,
 resumo TEXT NOT NULL DEFAULT '',
 descricao TEXT NOT NULL DEFAULT '',
 objetivos TEXT NOT NULL DEFAULT '[]',
 publico_alvo TEXT NOT NULL DEFAULT '',
 atividades TEXT NOT NULL DEFAULT '',
 local TEXT NOT NULL DEFAULT '',
 horarios TEXT NOT NULL DEFAULT '',
 como_participar TEXT NOT NULL DEFAULT '',
 data_inicio TEXT,
 data_fim TEXT,
 situacao TEXT NOT NULL DEFAULT 'planejamento',
 capa TEXT NOT NULL DEFAULT '',
 capa_alt TEXT NOT NULL DEFAULT '',
 capa_credito TEXT NOT NULL DEFAULT '',
 publicada INTEGER NOT NULL DEFAULT 0,
 destaque INTEGER NOT NULL DEFAULT 0,
 ordem INTEGER NOT NULL DEFAULT 0,
 versao INTEGER NOT NULL DEFAULT 1,
 criado_em TEXT NOT NULL,
 atualizado_em TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX projetos_publicos_ordem ON projetos_publicos(publicada,ordem,criado_em);
--> statement-breakpoint
CREATE TABLE projetos_capas (
 caminho TEXT PRIMARY KEY NOT NULL,
 chave TEXT NOT NULL,
 tipo TEXT NOT NULL,
 tamanho INTEGER NOT NULL,
 criado_em TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE site_configuracoes (
 chave TEXT PRIMARY KEY NOT NULL,
 valor TEXT NOT NULL
);
