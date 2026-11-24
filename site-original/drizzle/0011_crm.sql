CREATE TABLE crm_pessoas (id TEXT PRIMARY KEY NOT NULL,nome TEXT NOT NULL CHECK(length(trim(nome)) BETWEEN 2 AND 120),ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE crm_pessoa_contatos (pessoa_id TEXT NOT NULL REFERENCES crm_pessoas(id),tipo TEXT NOT NULL CHECK(tipo IN ('email','telefone')),valor TEXT NOT NULL,PRIMARY KEY(pessoa_id,tipo,valor));
--> statement-breakpoint
CREATE INDEX crm_contatos_valor ON crm_pessoa_contatos(valor,pessoa_id);
--> statement-breakpoint
CREATE TABLE crm_cadastro_pessoas (cadastro_id TEXT PRIMARY KEY NOT NULL REFERENCES cadastros(id),pessoa_id TEXT NOT NULL REFERENCES crm_pessoas(id),criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX crm_identidade_pessoa ON crm_cadastro_pessoas(pessoa_id,cadastro_id);
--> statement-breakpoint
CREATE TABLE crm_familia_membros (familia_id TEXT NOT NULL REFERENCES op_familias(id),pessoa_id TEXT NOT NULL REFERENCES crm_pessoas(id),papel TEXT NOT NULL CHECK(papel IN ('referencia','membro','cuidador')),PRIMARY KEY(familia_id,pessoa_id));
--> statement-breakpoint
CREATE INDEX crm_membros_pessoa ON crm_familia_membros(pessoa_id,familia_id);
--> statement-breakpoint
CREATE TABLE crm_servicos (id TEXT PRIMARY KEY NOT NULL,nome TEXT NOT NULL UNIQUE COLLATE NOCASE,tipo TEXT NOT NULL CHECK(tipo IN ('cesta','atendimento','outro')),unidade_medida TEXT NOT NULL DEFAULT 'atividade' CHECK(unidade_medida IN ('cesta','peca','item','atendimento','atividade')),ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE crm_unidades (id TEXT PRIMARY KEY NOT NULL,nome TEXT NOT NULL,tipo TEXT NOT NULL CHECK(tipo IN ('interno','parceiro')),email TEXT NOT NULL DEFAULT '',telefone TEXT NOT NULL DEFAULT '',endereco TEXT NOT NULL DEFAULT '',instrucoes TEXT NOT NULL DEFAULT '',ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE crm_unidade_servicos (unidade_id TEXT NOT NULL REFERENCES crm_unidades(id),servico_id TEXT NOT NULL REFERENCES crm_servicos(id),PRIMARY KEY(unidade_id,servico_id));
--> statement-breakpoint
CREATE INDEX crm_servicos_unidade ON crm_unidade_servicos(servico_id,unidade_id);
--> statement-breakpoint
CREATE TABLE crm_profissional_servicos (profissional_id TEXT NOT NULL REFERENCES op_profissionais(id),servico_id TEXT NOT NULL REFERENCES crm_servicos(id),PRIMARY KEY(profissional_id,servico_id));
--> statement-breakpoint
CREATE INDEX crm_servicos_profissional ON crm_profissional_servicos(servico_id,profissional_id);
--> statement-breakpoint
CREATE TABLE crm_disponibilidades (id TEXT PRIMARY KEY NOT NULL,profissional_id TEXT NOT NULL REFERENCES op_profissionais(id),dia_semana INTEGER NOT NULL CHECK(dia_semana BETWEEN 0 AND 6),inicio_minuto INTEGER NOT NULL CHECK(inicio_minuto BETWEEN 0 AND 1439),fim_minuto INTEGER NOT NULL CHECK(fim_minuto BETWEEN 1 AND 1440 AND fim_minuto>inicio_minuto),capacidade INTEGER NOT NULL CHECK(capacidade BETWEEN 1 AND 100),ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL,UNIQUE(profissional_id,dia_semana,inicio_minuto,fim_minuto));
--> statement-breakpoint
CREATE TABLE crm_apoio_detalhes (apoio_id TEXT PRIMARY KEY NOT NULL REFERENCES op_apoios(id),servico_id TEXT NOT NULL REFERENCES crm_servicos(id),prioridade TEXT NOT NULL DEFAULT 'normal' CHECK(prioridade IN ('baixa','normal','alta','urgente')),prazo TEXT,versao TEXT NOT NULL DEFAULT '');
--> statement-breakpoint
CREATE INDEX crm_apoios_servico ON crm_apoio_detalhes(servico_id,prioridade,prazo);
--> statement-breakpoint
CREATE TABLE crm_encaminhamentos (id TEXT PRIMARY KEY NOT NULL,apoio_id TEXT NOT NULL REFERENCES op_apoios(id),unidade_id TEXT NOT NULL REFERENCES crm_unidades(id),profissional_id TEXT REFERENCES op_profissionais(id),status TEXT NOT NULL CHECK(status IN ('aguardando','aceito','recusado','concluido','cancelado')),retorno_previsto TEXT,notas TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX crm_encaminhamento_ativo ON crm_encaminhamentos(apoio_id) WHERE status IN ('aguardando','aceito');
--> statement-breakpoint
CREATE INDEX crm_encaminhamentos_caso ON crm_encaminhamentos(apoio_id,criado_em);
--> statement-breakpoint
CREATE TABLE crm_realizacoes (id TEXT PRIMARY KEY NOT NULL,apoio_id TEXT NOT NULL REFERENCES op_apoios(id),servico_id TEXT NOT NULL REFERENCES crm_servicos(id),familia_id TEXT REFERENCES op_familias(id),profissional_id TEXT REFERENCES op_profissionais(id),unidade_id TEXT REFERENCES crm_unidades(id),agenda_id TEXT UNIQUE REFERENCES op_agenda(id),data_ocorrencia TEXT NOT NULL,quantidade INTEGER NOT NULL CHECK(quantidade BETWEEN 1 AND 100000),status TEXT NOT NULL CHECK(status IN ('realizado','cancelado')),notas TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX crm_realizacoes_periodo ON crm_realizacoes(data_ocorrencia,status,apoio_id);
--> statement-breakpoint
CREATE TABLE crm_tarefas (id TEXT PRIMARY KEY NOT NULL,apoio_id TEXT NOT NULL REFERENCES op_apoios(id),responsavel_id TEXT REFERENCES op_profissionais(id),titulo TEXT NOT NULL,prazo TEXT NOT NULL,situacao TEXT NOT NULL CHECK(situacao IN ('aberta','concluida','cancelada')),criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX crm_tarefas_fila ON crm_tarefas(situacao,prazo,responsavel_id);
--> statement-breakpoint
CREATE TABLE crm_movimentos (id TEXT PRIMARY KEY NOT NULL,apoio_id TEXT NOT NULL REFERENCES op_apoios(id),tipo TEXT NOT NULL,texto TEXT NOT NULL,ator TEXT NOT NULL,criado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX crm_historico_caso ON crm_movimentos(apoio_id,criado_em DESC);

--> statement-breakpoint
CREATE INDEX crm_realizacoes_caso ON crm_realizacoes(apoio_id,status,data_ocorrencia);
--> statement-breakpoint
CREATE INDEX crm_tarefas_caso ON crm_tarefas(apoio_id,situacao,prazo);
--> statement-breakpoint
CREATE INDEX crm_apoio_responsavel ON op_apoios(profissional_id,etapa,atualizado_em);
