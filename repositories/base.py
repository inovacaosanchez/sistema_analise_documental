from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class RepositoryStore(ABC):
    """Interface de persistencia para permitir troca futura de backend (DB, API, etc.)."""

    @abstractmethod
    def read(self, file_path: Path, default: Any) -> Any:
        raise NotImplementedError

    @abstractmethod
    def write(self, file_path: Path, data: Any) -> None:
        raise NotImplementedError


class EntityRepository(ABC):
    """Contrato de repositorio por entidade para evolucao futura para banco de dados."""

    @abstractmethod
    def list_all(self):
        raise NotImplementedError

    @abstractmethod
    def save_all(self, items):
        raise NotImplementedError
