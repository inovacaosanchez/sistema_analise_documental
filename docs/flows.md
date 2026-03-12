# Flows

## Autenticacao
- `GET /login`
- `POST /api/auth/login`
- Sessao por cookie
- Logout em `POST /api/auth/logout`

## CSRF
- Token gerado em sessao
- Injetado em meta tag (`csrf-token`)
- Enviado no header `X-CSRF-Token` em requests mutaveis

## Processos (analise documental)
- Config: `POST /api/config`
- Scan: `POST /api/scan`
- Selecao: `POST /api/documents/select`
- Start/Stop: `POST /api/process/start|stop`
- Preview: `GET /api/process/preview/<index>`
- Aprovar/Cancelar/Regenerar: `POST /api/process/approve|cancel|regenerate`

## Projetos
- CRUD principal via `/api/projects`
- Dashboard: `/api/projects/dashboard`

## Cadastros
- Setores, departamentos, cargos, usuarios e papeis
