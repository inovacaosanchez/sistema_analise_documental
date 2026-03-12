"""
CONFIGURACOES GLOBAIS DO SISTEMA
Centralizacao de parametros configuraveis + API OpenAI
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


class Settings:
    """Configuracoes globais do sistema."""

    # === API OPENAI ===
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "").strip()
    OPENAI_MAX_TOKENS = _env_int("OPENAI_MAX_TOKENS", 4000)
    OPENAI_TEMPERATURE = _env_float("OPENAI_TEMPERATURE", 0.3)
    OPENAI_TIMEOUT = _env_int("OPENAI_TIMEOUT", 60)  # segundos
    OPENAI_RETRY_MAX_ATTEMPTS = _env_int("OPENAI_RETRY_MAX_ATTEMPTS", 4)
    OPENAI_RETRY_BASE_SECONDS = _env_float("OPENAI_RETRY_BASE_SECONDS", 2.0)
    OPENAI_CALL_INTERVAL_SEC = _env_float("OPENAI_CALL_INTERVAL_SEC", 3.0)

    # === CHUNKING ===
    MAX_CHUNK_SIZE = 3000  # Caracteres por chunk (otimizado para GPT-4o-mini)
    MIN_CHUNK_SIZE = 200   # Tamanho minimo do chunk
    OVERLAP_SIZE = 300     # Sobreposicao entre chunks

    # === PALAVRAS-CHAVE PARA QUEBRA SEMANTICA ===
    SEMANTIC_BREAK_KEYWORDS = [
        "inicio", "depois", "em seguida", "caso", "se", "quando",
        "finaliza", "proximo passo", "etapa", "fase", "entao",
        "posteriormente", "antes", "apos", "durante", "enquanto",
        "primeiro", "segundo", "terceiro", "finalmente", "por fim", "próxima etapa"
    ]

    # === ESTRUTURA DE ARQUIVOS ===
    OUTPUT_FILES = [
        "Ficha_Tecnica.docx",
        "Fluxograma_Mermaid.docx",
        "Riscos_e_Automatizacoes.docx"
    ]

    # === INTERFACE ===
    WINDOW_SIZE = "1400x900"
    MIN_WINDOW_SIZE = (1200, 700)

    # === LOG ===
    LOG_FORMAT = "[{timestamp}] [{level}] {message}"
    MAX_LOG_LINES = 1000

    # === VALIDACAO ===
    SUPPORTED_EXTENSIONS = [".docx"]
    MIN_DOCUMENT_LENGTH = 100  # Caracteres minimos

    @classmethod
    def validate_api_key(cls):
        """Valida se API key esta configurada."""
        if not cls.OPENAI_API_KEY or cls.OPENAI_API_KEY == "SUA_API_KEY_AQUI":
            return False, "API Key do OpenAI nao configurada"

        if len(cls.OPENAI_API_KEY) < 20:
            return False, "API Key parece invalida (muito curta)"

        return True, "API Key configurada"

    @classmethod
    def get_output_folder_structure(cls, departamento, subarea, processo):
        """Retorna estrutura de pastas de saida."""
        return Path(departamento) / subarea / processo
