from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List

import requests

from repositories.base import RepositoryStore, EntityRepository


class SupabaseRepositoryStore(RepositoryStore):
    """Persistencia via Supabase REST (PostgREST), com contrato compativel ao JSON store."""

    def __init__(
        self,
        url: str,
        service_role_key: str,
        table_map: Dict[str, str],
        timeout_sec: int = 20,
    ):
        self.base_url = str(url or "").strip().rstrip("/")
        self.service_role_key = str(service_role_key or "").strip()
        self.table_map = {str(k).lower(): str(v) for k, v in (table_map or {}).items()}
        self.timeout_sec = int(timeout_sec)
        if not self.base_url or not self.service_role_key:
            raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios")
        if not self.table_map:
            raise ValueError("table_map do Supabase nao pode ser vazio")

    def _table_for(self, file_path: Path) -> str:
        table = self.table_map.get(str(file_path.name).lower())
        if not table:
            raise ValueError(f"Arquivo sem mapeamento para tabela Supabase: {file_path.name}")
        return table

    def _headers(self, prefer: str | None = None) -> Dict[str, str]:
        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def _request(self, method: str, endpoint: str, **kwargs):
        url = f"{self.base_url}/rest/v1/{endpoint.lstrip('/')}"
        response = requests.request(
            method=method.upper(),
            url=url,
            timeout=self.timeout_sec,
            **kwargs,
        )
        response.raise_for_status()
        if not response.text:
            return []
        return response.json()

    def read(self, file_path: Path, default: Any) -> Any:
        try:
            table = self._table_for(file_path)
            rows = self._request(
                "GET",
                table,
                params={"select": "id,data", "order": "updated_at.asc"},
                headers=self._headers(),
            )
            if not isinstance(rows, list):
                return default
            out: List[Dict[str, Any]] = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                data = row.get("data") or {}
                if not isinstance(data, dict):
                    continue
                if not data.get("id"):
                    data["id"] = row.get("id", "")
                out.append(data)
            return out
        except Exception:
            return default

    def write(self, file_path: Path, data: Any) -> None:
        table = self._table_for(file_path)
        items = data if isinstance(data, list) else []
        rows: List[Dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            row_id = str(item.get("id", "")).strip()
            if not row_id:
                # Mantem comportamento resiliente (dados sem id nao devem quebrar a escrita).
                continue
            rows.append({"id": row_id, "data": item})

        if not rows:
            self._request(
                "DELETE",
                table,
                params={"id": "not.is.null"},
                headers=self._headers(),
            )
            return

        # UPSERT de todas as linhas atuais.
        self._request(
            "POST",
            table,
            params={"on_conflict": "id"},
            headers=self._headers(prefer="resolution=merge-duplicates,return=minimal"),
            json=rows,
        )

        # Remove linhas deletadas localmente.
        existing = self._request(
            "GET",
            table,
            params={"select": "id"},
            headers=self._headers(),
        )
        existing_ids = [str(x.get("id", "")).strip() for x in existing if isinstance(x, dict)]
        target_ids = {str(r["id"]).strip() for r in rows}
        to_delete = [x for x in existing_ids if x and x not in target_ids]
        for chunk in _chunks(to_delete, 80):
            in_expr = "in.(" + ",".join(chunk) + ")"
            self._request(
                "DELETE",
                table,
                params={"id": in_expr},
                headers=self._headers(),
            )


class SupabaseEntityRepository(EntityRepository):
    """Repositorio por entidade para uso futuro quando o app migrar para DB 100%."""

    def __init__(self, store: RepositoryStore, file_path: Path):
        self.store = store
        self.file_path = file_path

    def list_all(self):
        data = self.store.read(self.file_path, default=[])
        return data if isinstance(data, list) else []

    def save_all(self, items):
        self.store.write(self.file_path, items)


class SupabaseProjectRepository(SupabaseEntityRepository):
    pass


class SupabaseProcessRepository(SupabaseEntityRepository):
    pass


class SupabaseUserRepository(SupabaseEntityRepository):
    pass


class SupabaseRoleRepository(SupabaseEntityRepository):
    pass


class SupabaseDepartmentRepository(SupabaseEntityRepository):
    pass


class SupabaseCargoRepository(SupabaseEntityRepository):
    pass


class SupabaseSectorRepository(SupabaseEntityRepository):
    pass


def _chunks(items: Iterable[str], size: int) -> Iterable[List[str]]:
    batch: List[str] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch
