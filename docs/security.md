# Security

## Baseline aplicado
- Chaves sensiveis por variavel de ambiente
- Sessao com cookie endurecido
- Headers de seguranca HTTP
- CSRF para API mutavel
- Rate limit em login (memoria)
- Senha temporaria aleatoria com expiracao
- Escrita JSON atomica + lock por arquivo

## Riscos conhecidos
- Rate-limit em memoria nao e distribuido (multi-worker requer store central)
- Persistencia JSON nao substitui garantias transacionais de banco relacional

## Rotacao de segredos
1. Revogar chave comprometida
2. Gerar nova chave
3. Atualizar `.env`/secret manager
4. Reiniciar app

## Variaveis sensiveis
- `OPENAI_API_KEY`
- `APP_SECRET_KEY`
- `AUTH_SALT`
- `ADMIN_INITIAL_PASSWORD` (quando usado)
- `SUPABASE_SERVICE_ROLE_KEY` (backend only; nunca expor no frontend)

## Supabase
- Script de estrutura/RLS/triggers: `db/supabase/schema.sql`
- RLS habilitado com politica para `service_role`
- Bucket privado `hpo-files` com politicas restritas ao backend
- Modo de ativacao por flag: `SUPABASE_ENABLED=1`

## Feature flags de hardening
- `ENABLE_SECURITY_HEADERS` (default `1`)
- `ENABLE_CSRF` (default `1`)
- `ENABLE_LOGIN_RATE_LIMIT` (default `1`)

## Checklist rapido
- [ ] `.env` fora do git
- [ ] segredos unicos por ambiente
- [ ] producao com `APP_ENV=production`
- [ ] HTTPS na borda
