from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

from repositories.base import RepositoryStore, EntityRepository


class JsonRepositoryStore(RepositoryStore):
    """Persistencia JSON com lock por arquivo e escrita atomica."""

    def __init__(self):
        self._locks: dict[str, threading.RLock] = {}
        self._locks_guard = threading.RLock()

    def _get_lock(self, file_path: Path) -> threading.RLock:
        key = str(file_path.resolve())
        with self._locks_guard:
            if key not in self._locks:
                self._locks[key] = threading.RLock()
            return self._locks[key]

    def read(self, file_path: Path, default: Any) -> Any:
        lock = self._get_lock(file_path)
        with lock:
            try:
                if not file_path.exists():
                    return default
                return json.loads(file_path.read_text(encoding="utf-8-sig"))
            except Exception:
                return default

    def write(self, file_path: Path, data: Any) -> None:
        lock = self._get_lock(file_path)
        with lock:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            fd, temp_path = tempfile.mkstemp(prefix=f".{file_path.name}.", suffix=".tmp", dir=str(file_path.parent))
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as tmp:
                    json.dump(data, tmp, ensure_ascii=False, indent=2)
                    tmp.flush()
                    os.fsync(tmp.fileno())
                os.replace(temp_path, file_path)
            finally:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except OSError:
                        pass


class JsonEntityRepository(EntityRepository):
    """Repositorio base por entidade usando JSON."""

    def __init__(self, store: RepositoryStore, file_path: Path):
        self.store = store
        self.file_path = file_path

    def list_all(self):
        data = self.store.read(self.file_path, default=[])
        return data if isinstance(data, list) else []

    def save_all(self, items):
        self.store.write(self.file_path, items)


class ProjectRepository(JsonEntityRepository):
    pass


class ProcessRepository(JsonEntityRepository):
    pass


class UserRepository(JsonEntityRepository):
    pass


class RoleRepository(JsonEntityRepository):
    pass


class DepartmentRepository(JsonEntityRepository):
    pass


class CargoRepository(JsonEntityRepository):
    pass


class SectorRepository(JsonEntityRepository):
    pass
