# Modelo de Dados por Tela (HPO)

## 1) Objetivo
Este documento consolida, para cada tela do sistema, os campos trafegados, tipos, obrigatoriedade, tabela recomendada e correlacoes de IDs.

Fonte de verdade usada:
- Backend Flask: `ui/web_app.py`
- Frontend: `web/static/app.js`
- Persistencia atual: `data/*.json`

Observacao importante:
- Hoje o sistema persiste em JSON (arquivos locais).
- O modelo abaixo propoe estrutura relacional para equipe tecnica disponibilizar dados de forma escalavel.

## 2) Telas e entidades

### 2.1 Processos
- `view-processos-analise`: operacao de scan/process/preview/aprovacao de documentos
- `view-processos-priorizacao`: calculo de priorizacao e exportacao Word
- `view-processos-cadastro`: CRUD de processo e etapas
- `view-processos-consulta`: consulta de processos e etapas
- `view-processos-dashboard`: KPIs/charts de processos

Entidades principais:
- `processes`
- `process_stages`
- `process_stage_checklist`
- `process_stage_comments`
- `process_stage_comment_history`
- `process_stage_attachments`

### 2.2 Projetos
- `view-projetos-cadastrar`: cadastro de projeto e etapas
- `view-projetos-consultar`: consulta/detalhe/edicao
- `view-projetos-dashboard`: KPIs/charts
- `view-projetos-setores`: setores e impacto em projetos

Entidades principais:
- `projects`
- `project_stages`
- `project_stage_attachments`
- `project_notes`
- `project_note_replies`
- `project_attachments`

### 2.3 Cadastros e seguranca
- `view-cadastros-departamentos`
- `view-cadastros-cargos`
- `view-cadastros-usuarios`
- `view-cadastros-perfis`
- login/logout/change-password

Entidades principais:
- `departments`
- `cargos`
- `sectors`
- `roles`
- `role_permissions`
- `users`

### 2.4 Operacao assistente e processo documental
Entidades recomendadas:
- `assistant_messages` (opcional, caso queira historico)
- `document_runs` (execucao por lote de documentos)
- `document_run_items` (status por documento escaneado)
- `document_previews` (snapshot de preview aprovado/regerado)

## 3) Dicionario de dados por tabela

## 3.1 `roles`
- `id` text PK (hoje IDs em string custom)
- `nome` text not null unique
- `created_at` timestamptz
- `updated_at` timestamptz

Origem de tela:
- Perfis (`/api/roles`)

## 3.2 `role_permissions`
- `role_id` text FK -> `roles.id`
- `view_id` text not null
- PK composta (`role_id`, `view_id`)

Dominios atuais de `view_id`:
- `view-processos-analise`
- `view-processos-priorizacao`
- `view-processos-cadastro`
- `view-processos-consulta`
- `view-processos-dashboard`
- `view-projetos-cadastrar`
- `view-projetos-consultar`
- `view-projetos-dashboard`
- `view-projetos-setores`
- `view-cadastros-departamentos`
- `view-cadastros-cargos`
- `view-cadastros-usuarios`
- `view-cadastros-perfis`
- `*` (acesso total, opcional manter como regra especial)

## 3.3 `departments`
- `id` text PK
- `nome` text not null unique
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.4 `cargos`
- `id` text PK
- `nome` text not null unique
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.5 `sectors`
- `id` text PK
- `nome` text not null unique
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.6 `users`
- `id` text PK
- `nome` text not null
- `email` text not null unique
- `username` text unique
- `role_id` text FK -> `roles.id` (obrigatorio se `has_login=true`)
- `departamento_id` text FK -> `departments.id` nullable
- `cargo_id` text FK -> `cargos.id` nullable
- `has_login` boolean not null default true
- `active` boolean not null default true
- `password_hash` text nullable (vazio quando sem login)
- `must_change_password` boolean not null default false
- `password_is_temporary` boolean not null default false
- `temp_password_expires_at` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.7 `projects`
Campos vindos de cadastro/edicao de projeto:
- `id` text PK
- `nome` text not null
- `descricao` text not null
- `responsavel` text not null
- `status` text not null
- `criticidade` text not null
- `data_inicio_previsto` date nullable
- `dt_inicio_real` date nullable
- `previsao_termino` date nullable
- `termino_real` date nullable
- `setor_projeto` text nullable
- `anotacoes_gerais` text nullable
- `progresso` numeric(5,2) not null default 0
- `tarefas` int not null default 0
- `tarefas_concluidas` int not null default 0
- `orcamento` numeric(14,2) not null default 0
- `custo_atual` numeric(14,2) not null default 0
- `created_at` timestamptz
- `updated_at` timestamptz

Campos derivados (podem ser materializados ou calculados):
- `progresso`
- `tarefas`
- `tarefas_concluidas`

## 3.8 `project_sectors` (N:N)
- `project_id` text FK -> `projects.id`
- `sector_name` text not null
- PK composta (`project_id`, `sector_name`)

Observacao:
- No frontend, `setores_impactados` chega como lista de nomes.
- Recomendado evoluir para `sector_id` quando toda origem estiver normalizada.

## 3.9 `project_attachments`
- `id` text PK
- `project_id` text FK -> `projects.id`
- `nome` text not null
- `tipo` text nullable
- `tamanho` bigint nullable
- `url` text nullable
- `created_at` timestamptz

## 3.10 `project_stages`
- `id` text PK
- `project_id` text FK -> `projects.id`
- `nome` text not null
- `responsavel` text nullable
- `inicio_previsto` date nullable
- `inicio_real` date nullable
- `fim_previsto` date nullable
- `fim_real` date nullable
- `prazo` date nullable
- `descricao` text nullable
- `anotacoes` text nullable
- `criticidade` text nullable
- `complexidade` text nullable
- `status` text not null default `pendente`
- `ordem` int nullable
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.11 `project_stage_attachments`
- `id` text PK
- `project_stage_id` text FK -> `project_stages.id`
- `nome` text not null
- `tipo` text nullable
- `tamanho` bigint nullable
- `url` text nullable
- `created_at` timestamptz

## 3.12 `project_notes`
- `id` text PK
- `project_id` text FK -> `projects.id`
- `usuario` text not null
- `conteudo` text not null
- `status` text not null default `pendente`
- `data` timestamptz not null
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.13 `project_note_replies`
- `id` text PK
- `project_note_id` text FK -> `project_notes.id`
- `usuario` text not null
- `conteudo` text not null
- `data` timestamptz not null
- `created_at` timestamptz

## 3.14 `processes`
- `id` text PK
- `nome` text not null
- `departamento_id` text FK -> `departments.id` not null
- `departamento_nome` text denormalizado (opcional)
- `descricao` text not null
- `status` text not null (`ativo|inativo|rascunho`)
- `versao` text not null
- `responsavel_id` text FK -> `users.id` not null
- `responsavel_nome` text denormalizado (opcional)
- `data_criacao` timestamptz
- `ultima_atualizacao` timestamptz

## 3.15 `process_stages`
- `id` text PK
- `processo_id` text FK -> `processes.id`
- `nome` text not null
- `ordem` int not null
- `departamento_id` text FK -> `departments.id` not null
- `departamento_nome` text denormalizado (opcional)
- `cargo_id` text FK -> `cargos.id` nullable
- `cargo_nome` text denormalizado (opcional)
- `responsavel_id` text FK -> `users.id` nullable
- `responsavel_nome` text denormalizado (opcional)
- `descricao` text nullable
- `sla` text nullable
- `tipo_entrada` text not null default `manual`
- `status` text not null default `ativa`
- `instrucoes` text nullable
- `observacoes` text nullable
- `pontos_atencao` text nullable
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.16 `process_stage_checklist`
- `id` text PK
- `process_stage_id` text FK -> `process_stages.id`
- `texto` text not null
- `concluido` boolean not null default false

## 3.17 `process_stage_attachments`
- `id` text PK
- `process_stage_id` text FK -> `process_stages.id`
- `nome` text not null
- `tipo` text nullable
- `tamanho` bigint nullable
- `url` text nullable
- `data_upload` timestamptz nullable
- `usuario_envio` text nullable

## 3.18 `process_stage_comments`
- `id` text PK
- `process_stage_id` text FK -> `process_stages.id`
- `autor_id` text FK -> `users.id` nullable
- `autor_nome` text nullable
- `data_hora` timestamptz not null
- `texto` text not null

## 3.19 `process_stage_comment_history`
- `id` bigserial PK
- `comment_id` text FK -> `process_stage_comments.id`
- `texto_anterior` text not null
- `editado_em` timestamptz not null
- `editado_por` text nullable

## 3.20 `document_runs` (tela de analise documental)
- `id` text PK
- `origem_path` text not null
- `destino_path` text not null
- `status` text not null (`running|stopped|done|error`)
- `created_by_user_id` text FK -> `users.id` nullable
- `created_at` timestamptz
- `updated_at` timestamptz

## 3.21 `document_run_items`
- `id` text PK
- `run_id` text FK -> `document_runs.id`
- `filename` text not null
- `file_path` text not null
- `departamento` text nullable
- `subarea` text nullable
- `status` text not null (`pendente|gerando|aguardando_aprovacao|processado|erro_geracao|ja_existe`)
- `processed` boolean not null default false
- `selected` boolean not null default false
- `preview_ready` boolean not null default false
- `existing_files` jsonb default `[]`

## 3.22 `document_previews`
- `id` text PK
- `run_item_id` text FK -> `document_run_items.id`
- `ficha_tecnica` text not null
- `fluxograma` text not null
- `riscos` text not null
- `raw_text_size` int nullable
- `normalized_text_size` int nullable
- `chunks` int nullable
- `created_at` timestamptz

## 3.23 `assistant_messages` (opcional)
- `id` text PK
- `user_id` text FK -> `users.id`
- `role` text not null (`user|assistant`)
- `content` text not null
- `context_scope` text nullable
- `created_at` timestamptz

## 4) Correlacoes de IDs (FKs)
- `users.role_id` -> `roles.id`
- `users.departamento_id` -> `departments.id`
- `users.cargo_id` -> `cargos.id`
- `processes.departamento_id` -> `departments.id`
- `processes.responsavel_id` -> `users.id`
- `process_stages.processo_id` -> `processes.id`
- `process_stages.departamento_id` -> `departments.id`
- `process_stages.cargo_id` -> `cargos.id`
- `process_stages.responsavel_id` -> `users.id`
- `process_stage_checklist.process_stage_id` -> `process_stages.id`
- `process_stage_attachments.process_stage_id` -> `process_stages.id`
- `process_stage_comments.process_stage_id` -> `process_stages.id`
- `process_stage_comments.autor_id` -> `users.id`
- `process_stage_comment_history.comment_id` -> `process_stage_comments.id`
- `project_stages.project_id` -> `projects.id`
- `project_stage_attachments.project_stage_id` -> `project_stages.id`
- `project_notes.project_id` -> `projects.id`
- `project_note_replies.project_note_id` -> `project_notes.id`
- `project_attachments.project_id` -> `projects.id`
- `project_sectors.project_id` -> `projects.id`
- `document_run_items.run_id` -> `document_runs.id`
- `document_previews.run_item_id` -> `document_run_items.id`

## 5) Campos por tela (entrada/saida)

## 5.1 Login
Endpoint:
- `POST /api/auth/login`

Entrada:
- `username` string (obrigatorio)
- `password` string (obrigatorio)

Saida principal:
- `ok` boolean
- `user` objeto de sessao:
  - `id`, `nome`, `email`, `username`
  - `role_id`, `role_nome`
  - `departamento_id`, `departamento_nome`
  - `cargo_id`, `cargo_nome`
  - `has_login`, `active`, `must_change_password`
  - `permissions` string[]

## 5.2 Usuarios
Endpoint principal:
- `POST /api/users`

Entrada:
- `nome` string (obrigatorio)
- `email` string (obrigatorio)
- `departamento_id` string (opcional)
- `cargo_id` string (opcional)
- `has_login` boolean
- `role_id` string (obrigatorio quando `has_login=true`)

Saida:
- `user` (publico)
- `temp_password` string (quando `has_login=true`)
- `temp_password_expires_at` datetime ISO

## 5.3 Projetos (cadastro/edicao)
Endpoint principal:
- `POST /api/projects`
- `PUT /api/projects/{id}`

Entrada relevante:
- `nome`, `descricao`, `responsavel` (obrigatorios)
- `status`, `criticidade`
- datas (`data_inicio_previsto`, `dt_inicio_real`, `previsao_termino`, `termino_real`) em `YYYY-MM-DD`
- `setor_projeto`, `setores_impactados[]`
- `etapas[]`
- `anotacoes_gerais`, `anotacoes[]`
- `orcamento`, `custo_atual`

## 5.4 Processos (cadastro/edicao)
Endpoint principal:
- `POST /api/processos`
- `PUT /api/processos/{id}`

Entrada relevante:
- `nome`, `descricao`, `departamento_id`, `responsavel_id` (obrigatorios)
- `status` (`ativo|inativo|rascunho`)
- `versao`
- `etapas[]`
  - `nome` obrigatorio
  - `ordem`, `departamento_id`, `cargo_id`, `responsavel_id`
  - `descricao`, `sla`, `tipo_entrada`, `status`
  - `conhecimento`:
    - `instrucoes`, `observacoes`, `pontos_atencao`
    - `checklist[]` (`id`, `texto`, `concluido`)
    - `anexos[]` (metadados de arquivo)
    - `comentarios[]` (`id`, `autor_id`, `autor_nome`, `data_hora`, `texto`, `edit_history[]`)

## 5.5 Priorizacao
Endpoint:
- `POST /api/priorizacao/calculate`

Entrada:
- `responsavel`, `cargo`, `resumo_processo`
- `qtd_pessoas` number
- `horas_mensais` number
- `custo_mensal` number
- `custo_desenvolvimento` number
- `complexidade` int
- `dev_interno` int

Saida:
- `custo_hora`, `cp_anual`, `economia_mensal`
- `payback_meses`, `cp_score`, `pb_score`
- `score_final`, `prioridade`

## 6) Regras de integridade recomendadas
- Unicidade:
  - `users.email`, `users.username`
  - `roles.nome`, `departments.nome`, `cargos.nome`, `sectors.nome`
- Checks:
  - status de projeto/processo em dominios permitidos
  - datas de fim >= inicio (projeto e etapas de projeto)
  - `ordem` de etapa de processo > 0
- Auditoria:
  - trilha de alteracoes para entidades de negocio
- Indices:
  - `projects(status, criticidade, responsavel, previsao_termino)`
  - `processes(status, departamento_id, responsavel_id)`
  - FKs de alto volume (etapas, comentarios, anotacoes)

## 7) Estrategia de transicao (JSON -> relacional)
- Fase 1: criar tabelas mantendo IDs atuais (`text`) para compatibilidade.
- Fase 2: ETL dos arquivos JSON para tabelas normalizadas.
- Fase 3: ajustar repositorios para leitura/escrita SQL.
- Fase 4: opcional migrar IDs para UUID nativo com tabela de mapeamento.

