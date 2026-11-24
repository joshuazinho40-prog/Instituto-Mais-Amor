CREATE TABLE op_profissionais (id TEXT PRIMARY KEY NOT NULL,nome TEXT NOT NULL,funcao TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',disponibilidade TEXT NOT NULL DEFAULT '',ativo INTEGER NOT NULL DEFAULT 1,criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE op_familias (id TEXT PRIMARY KEY NOT NULL,nome_referencia TEXT NOT NULL,contato TEXT NOT NULL DEFAULT '',notas TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE op_apoios (id TEXT PRIMARY KEY NOT NULL,cadastro_id TEXT NOT NULL REFERENCES cadastros(id),familia_id TEXT REFERENCES op_familias(id),projeto_id TEXT REFERENCES projetos_gestao(id),projeto_publico_id TEXT REFERENCES projetos_publicos(id),profissional_id TEXT REFERENCES op_profissionais(id),etapa TEXT NOT NULL DEFAULT 'recebido',proxima_acao TEXT NOT NULL DEFAULT '',notas TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX op_apoios_acompanhamento ON op_apoios(cadastro_id,etapa,atualizado_em);
--> statement-breakpoint
CREATE TABLE op_voluntarios (id TEXT PRIMARY KEY NOT NULL,cadastro_id TEXT NOT NULL UNIQUE REFERENCES cadastros(id),projeto_id TEXT REFERENCES projetos_gestao(id),projeto_publico_id TEXT REFERENCES projetos_publicos(id),profissional_id TEXT REFERENCES op_profissionais(id),etapa TEXT NOT NULL DEFAULT 'interessado',disponibilidade TEXT NOT NULL DEFAULT '',notas TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX op_voluntarios_etapa ON op_voluntarios(etapa,atualizado_em);
--> statement-breakpoint
CREATE TABLE op_agenda (id TEXT PRIMARY KEY NOT NULL,apoio_id TEXT REFERENCES op_apoios(id),cadastro_id TEXT NOT NULL REFERENCES cadastros(id),familia_id TEXT REFERENCES op_familias(id),projeto_id TEXT REFERENCES projetos_gestao(id),projeto_publico_id TEXT REFERENCES projetos_publicos(id),profissional_id TEXT NOT NULL REFERENCES op_profissionais(id),data_hora TEXT NOT NULL,duracao_minutos INTEGER NOT NULL,tipo TEXT NOT NULL,situacao TEXT NOT NULL DEFAULT 'agendado',notas TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX op_agenda_periodo ON op_agenda(data_hora,situacao,cadastro_id);
--> statement-breakpoint
CREATE INDEX op_agenda_profissional ON op_agenda(profissional_id,data_hora);
--> statement-breakpoint
CREATE TABLE op_agenda_voluntarios (agenda_id TEXT NOT NULL REFERENCES op_agenda(id) ON DELETE CASCADE,voluntario_id TEXT NOT NULL REFERENCES op_voluntarios(id),aprovado_na_sessao INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(agenda_id,voluntario_id));
