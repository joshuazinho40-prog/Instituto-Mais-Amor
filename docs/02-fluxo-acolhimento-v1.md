# Central Mais Amor — Acolhimento V1 (pequena equipe)

## Perfis iniciais
- **Administrador/coordenador:** configura usuários autorizados, atribui solicitações, revisa diretório verificado, consulta indicadores agregados.
- **Atendente:** visualiza somente solicitações atribuídas, registra contato e ações administrativas objetivas, propõe encaminhamento.
- **Editor de conteúdo (opcional):** edita rascunhos de notícias sem acesso a contatos privados.

Pessoas da equipe usam contas individuais e autenticação multifator; nunca compartilhar a mesma senha.

## Entrada pública (sem vínculo prévio)
Formulário mínimo, quando houver backend seguro:
- primeiro nome;
- WhatsApp/telefone;
- cidade ou região;
- preferência de retorno;
- aviso de privacidade com informação clara de finalidade e canal de direitos.

Nenhum campo obrigatório "pessoa identificada" ou "família acompanhada". Não pedir diagnóstico, CID, laudo, CPF ou dados de crianças. Se ainda não houver backend aprovado, usar o canal de WhatsApp institucional e não simular gravação.

## Situações administrativas
`NOVO` → `AGUARDANDO_CONTATO` → `EM_ACOLHIMENTO` → `ORIENTADO` / `ENCAMINHAMENTO_EM_ANDAMENTO` → `CONCLUIDO`.

Estados alternativos: `AGUARDANDO_RETORNO`, `CANCELADO`. Toda mudança tem autor, data, justificativa objetiva e registro de auditoria. Não confundir "orientado" com "vaga/terapia confirmada".

## Assuntos gerais e encaminhamentos
- Inclusão e acesso a direitos;
- Apoio familiar e assistência social;
- Orientação para serviços de fonoaudiologia;
- Orientação para psicologia;
- Orientação para terapia ocupacional/fisioterapia/psicopedagogia;
- Educação e oportunidades;
- Outra solicitação.

A categoria é **administrativa**, não triagem nem diagnóstico clínico. É possível associar mais de uma categoria ao mesmo pedido. Quando necessário, pessoa habilitada e autorizada decide sobre orientações especializadas.

## Diretorio verificado
`servicos_rede`: identificador, nome institucional, área, canal público, região, critérios informados, status de verificação, data da última revisão e pessoa que conferiu. Não anunciar vaga ou parceria sem confirmação.

## Registros de encaminhamento
`encaminhamentos`: solicitação, serviço verificado, tipo de orientação, situação, data, responsável, retorno e autorização para compartilhamento quando cabível. Compartilhar com terceiros somente o mínimo necessário e com fundamento apropriado.

## Dados previstos para próxima fase (proposta, NÃO banco implantado)
`usuarios_equipe` (id, papel, ativo)
`solicitacoes` (id, primeiro_nome, contato, regiao, preferencia_retorno, status, responsavel_id, criado_em, prazo_retencao)
`categorias` (id, titulo, ativo)
`solicitacao_categorias` (solicitacao_id, categoria_id)
`historico_acoes` (id, solicitacao_id, usuario_id, acao, criado_em)
`servicos_rede` (id, nome, tipo, contato_publico, verificado_em, ativo)
`encaminhamentos` (id, solicitacao_id, servico_id, responsavel_id, situacao, criado_em)
`indicadores_agregados` (periodo, recebidos, respondidos, concluidos)

## Regra do acolhimento
A equipe escuta, verifica possibilidades reais, orienta e acompanha. O sistema **não escolhe beneficiários automaticamente**, não agenda terapias sem equipe habilitada/estrutura e não substitui canais de emergência.

## Testes obrigatórios antes de produção
1. Novo contato não exige família cadastrada.
2. Envio seguro gera protocolo somente depois de persistido.
3. Atendente A não lê solicitação atribuída a B.
4. Coordenador atribui e revoga acesso.
5. Solicitação pode ter múltiplas categorias.
6. Encaminhamento exige destino verificado.
7. Mudança de situação registra auditoria sem expor relatos.
8. Exportação e indicadores não vazam telefone/nome.
9. Usuário desligado perde acesso.
10. Solicitação de exclusão/retificação tem procedimento definido.
