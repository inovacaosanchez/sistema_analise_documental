# Architecture

## Visao geral
Aplicacao monolitica Flask com frontend vanilla. O servidor serve templates, API JSON e recursos estaticos.

## Camadas
- UI/API: `ui/web_app.py`
- Nucleo de dominio tecnico: `core/*`
- Persistencia: `repositories/*` com implementacao JSON atual
- Frontend: `web/templates`, `web/static`

## Persistencia atual
- JSON por entidade na pasta `data/`.
- Escrita atomica (temp + replace) e lock por arquivo.

## Preparacao para DB futura
- Contratos em `repositories/base.py`:
  - `RepositoryStore`
  - `EntityRepository`
- Implementacao atual: `JsonRepositoryStore` + repositorios por entidade em `repositories/json_store.py`.
- Ponto de troca futuro: injetar store/repositories SQL mantendo contratos.

## Fluxo principal (analise de processos)
1. Configurar origem/destino
2. Escanear documentos
3. Processar selecionados
4. Revisar preview
5. Aprovar e salvar DOCX
