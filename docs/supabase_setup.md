# Setup Supabase (HPO)

## 1) Criar estrutura no banco
1. Abra o projeto no Supabase.
2. Acesse **SQL Editor**.
3. Execute o script:
   - `db/supabase/schema.sql`

Esse script cria:
- Tabelas de dados do HPO (`hpo_*`)
- Constraints de validacao basica
- Triggers de `updated_at`
- Auditoria (`hpo_audit_log`)
- Indices principais
- RLS e politicas restritas ao `service_role`
- Bucket privado `hpo-files` + politicas

## 2) Configurar variaveis no backend
No `.env`:

```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ENABLED=1
```

## 3) Subir aplicacao
```powershell
.\venv\Scripts\python.exe .\main.py
```

## 4) Validacao rapida
1. Login no sistema.
2. Criar/editar um setor.
3. Criar/editar um projeto.
4. Verificar no Supabase as tabelas:
   - `hpo_sectors`
   - `hpo_projects`
5. Verificar auditoria:
   - `hpo_audit_log`

## 5) Fallback seguro
Se houver erro de configuracao/conexao, o backend faz fallback automatico para JSON local.
Para forcar modo local:

```env
SUPABASE_ENABLED=0
```

## 6) Observacoes de seguranca
- `SUPABASE_SERVICE_ROLE_KEY` deve ficar somente no backend.
- Nao expor `service_role` em frontend.
- Em producao, armazenar segredos em secret manager.
