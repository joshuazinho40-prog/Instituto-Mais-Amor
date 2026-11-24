# Instituto Mais Amor — exportação da versão publicada

Projeto Sites `appgprj_6aedf46d381081919fa001194da091f0`, versão **33**, commit de origem `202ff3ee7546cdf1a2d482f835329ffcc2939c2f`. O código foi recuperado do repositório do projeto existente, incluindo os arquivos públicos, as rotas e o painel dessa revisão. Site oficial: https://instituto-mais-amor-inclusao.joshuazinho40.chatgpt.site/

## Desenvolvimento local

Pré-requisitos: Node.js 22.13 ou superior (recomendado Node 24), npm e Python 3. O pacote utiliza módulos nativos do Node e a biblioteca padrão do Python. Não há dependências npm externas nem arquivo de lock nesta revisão.

Da raiz do ZIP extraído:

```bash
npm run build
npm run dev
```

Abra http://127.0.0.1:8765/ para o site e http://127.0.0.1:8765/admin para o painel. O servidor local escuta apenas no loopback, simula a sessão administrativa e inicializa um SQLite vazio em memória com o esquema de `drizzle/`. Os arquivos enviados no painel ficam em memória. Ao reiniciar, os dados de teste desaparecem. A execução local é independente do site publicado.

`npm run check` valida páginas, links e recursos. `npm test` monta bancos SQLite descartáveis e roda os testes dos módulos. Use os comandos de teste com a configuração local padrão.

## Arquivos e dependências

| Recurso | Onde fica e do que depende |
| --- | --- |
| Páginas, estilos, JavaScript e mídias estáticas | `dist/`; fontes tipográficas, imagens e vídeos do repositório já estão no ZIP. Conteúdo e configurações base em `content.json`, `config.json` e `config.js`. |
| Templates, compilação e verificações | `scripts/` e `scripts/templates/`. O build compõe o Worker e inclui nele os arquivos estáticos. |
| Rotas e regras do servidor | `worker/`; `dist/server/index.js` é a saída compilada. Formulários, CRM, agenda, resultados, projetos dinâmicos e documentos precisam do servidor. |
| D1 (`DB`) | Esquema em `drizzle/*.sql` e ordem no journal. Guarda cadastros, famílias, pedidos, ações, projetos, indicadores, auditoria, ajustes e referências a mídias. Os dados de produção ficam no D1. |
| R2 (`BUCKET`) | Guarda mídias e anexos enviados pelo painel, como capas, galerias, documentos e substituições do vídeo. O ZIP inclui a mídia estática rastreada pelo Git. Os uploads da hospedagem e configurações salvas no D1 ficam no serviço de origem. |
| Login administrativo e MCP | `.openai/hosting.json` declara o vínculo com o Sites, os bindings e a capacidade MCP. A produção depende da autenticação do Sites e de cabeçalhos de identidade fornecidos pela plataforma. O servidor local simula esses cabeçalhos para teste. Num host diferente, é obrigatório integrar autenticação confiável, removendo cabeçalhos de identidade vindos do cliente. |
| Conta administrativa | Na cópia, `MAIS_AMOR_ADMIN_EMAIL` é uma variável **opcional de build**, com padrão fictício `admin@example.test`. Se usada num ambiente autorizado, o valor entra no bundle. Não versione o bundle resultante nem arquivos `.env`. `PORT` é opcional para o servidor local. |
| Canais públicos | E-mail, WhatsApp e Instagram são links configuráveis. As configurações de produção são armazenadas no D1. O código não depende de uma chave de API desses serviços nem envia notificações externas. |

O ZIP exclui o PDF da biblioteca interna e sua cópia incorporada no bundle. O código e as rotas de documentos foram incluídos. Se tiver uma cópia autorizada do estatuto, coloque-a localmente em `private/documentos/estatuto-social-instituto-mais-amor.pdf` antes do build. O arquivo é ignorado pelo Git. O binário não deve entrar em um repositório público nem na pasta de arquivos estáticos.

Procedência das imagens ilustrativas e vídeos em `dist/midia.html`. A cópia preserva o identificador original do Sites como referência. O documento `MODELAGEM-DADOS.md` descreve as entidades e se complementa com as migrações SQL.

## Importação para revisão no GitHub

Repositório `joshuazinho40-prog/Instituto-Mais-Amor`, branch `importacao/sites-v33`. A área `site-original/` é destinada ao código do site existente. A branch pública contém os fontes textuais para revisão. Os arquivos binários de marca e mídia estão no ZIP e constam do inventário `ARQUIVOS-MIDIA.sha256`. Para preparar a cópia de desenvolvimento a partir da branch, sobreponha o conteúdo da pasta extraída `Instituto-Mais-Amor/` à pasta `site-original/` e use as instruções acima. Isso preserva os caminhos relativos do projeto. Confirme a autorização de redistribuição antes de versionar as mídias no GitHub.

O pacote não contém histórico do Git, credenciais, banco de produção nem anexos da hospedagem. O código publicado e o banco de produção não foram modificados durante a exportação.
