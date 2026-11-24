# Instituto Mais Amor — Site e evolução tecnológica

Repositório de especificações e futuras integrações do **site existente** do Instituto Mais Amor.

**Site de referência publicado:** https://instituto-mais-amor-inclusao.joshuazinho40.chatgpt.site/

> **Importante:** o site publicado não foi recriado nem substituído por este repositório. Aqui estão as especificações para alterações incrementais. O código-fonte integral do site atual não está neste repositório até que sua exportação/integração seja confirmada.

## Objetivo
Preservar a identidade e as páginas já construídas e evoluir, por etapas, os módulos:
- Acolhimento e solicitações;
- Acompanhamento e encaminhamentos humanos;
- Profissionais e serviços de referência verificados;
- Notícias, projetos e transparência;
- Campanhas, doações e voluntariado, após validação operacional.

## Primeira decisão técnica
- Acolhimento feito pelo responsável pelo projeto **e uma pequena equipe** do Instituto.
- Cadastro inicial = **solicitação de contato**; não exige vinculação prévia a "família acompanhada".
- Não solicitar CPF, laudos, CID, diagnósticos e documentos de crianças no primeiro contato.
- Não prometer vaga, terapia, benefício ou encaminhamento confirmado automaticamente.
- Site público e backoffice privado separados, mas integrados ao projeto existente.
- Implantação com dados fictícios, teste de permissões e aprovação antes de produção.

## Documentação
- [01 — Integração incremental no site atual](docs/01-integracao-site-existente.md)
- [02 — Fluxo de acolhimento e responsabilidades](docs/02-fluxo-acolhimento-v1.md)
- [03 — Backlog técnico e critérios de aceite](docs/03-backlog-priorizado.md)

## Identidade visual
Preservar a logomarca institucional aprovada e o design atual como ponto de partida. Cores de referência: azul `#1469BD`, amarelo `#FFD447`, branco `#FFFFFF`, vermelho coral `#EA4E55`, azul-escuro `#173552`. Efeitos 3D devem ser leves, acessíveis e não substituir fotografias humanas.

## Segurança
Nenhum cadastro real, token, senha, chave de API, dado de saúde ou informação de beneficiário deve ser commitado neste repositório, que é **público**.

**Situação:** especificação inicial. Integrações com banco de dados e publicação do site dependem de acesso ao projeto original e aprovação de segurança.
