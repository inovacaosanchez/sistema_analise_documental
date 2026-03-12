"""
SISTEMA DE LOG DETALHADO
Responsavel por logging auditavel do sistema.
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Optional
from flask import has_request_context, g


class SystemLogger:
    """Logger personalizado para o sistema."""

    def __init__(self, log_sink: Optional[Callable[[str], None]] = None):
        self.log_sink = log_sink
        self.log_history: List[str] = []
        self.summary_history: List[str] = []
        self.max_history = 1000
        self.setup_file_logging()

    def setup_file_logging(self):
        """Configura logging para arquivo."""
        try:
            log_dir = Path("logs")
            log_dir.mkdir(exist_ok=True)
            log_file = log_dir / f"sistema_{datetime.now().strftime('%Y%m%d')}.log"

            logger_name = "sistema_analise_documental"
            self.file_logger = logging.getLogger(logger_name)
            self.file_logger.setLevel(logging.INFO)
            self.file_logger.handlers.clear()

            formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
            fh = logging.FileHandler(log_file, encoding="utf-8")
            fh.setFormatter(formatter)
            sh = logging.StreamHandler()
            sh.setFormatter(formatter)

            self.file_logger.addHandler(fh)
            self.file_logger.addHandler(sh)
            self.file_logger.propagate = False
        except Exception as exc:
            print(f"Erro ao configurar logging: {exc}")

    def info(self, message: str):
        self._log("INFO", message)

    def warning(self, message: str):
        self._log("WARNING", message)

    def error(self, message: str):
        self._log("ERROR", message)

    def debug(self, message: str):
        self._log("DEBUG", message)

    def summary(self, message: str):
        self._log("INFO", message, summary=True)

    def _log(self, level: str, message: str, summary: bool = False):
        timestamp = datetime.now().strftime("%H:%M:%S")
        request_id = ""
        try:
            if has_request_context():
                request_id = getattr(g, "request_id", "") or ""
        except Exception:
            request_id = ""

        rid_part = f" [rid={request_id}]" if request_id else ""
        formatted_message = f"[{timestamp}] [{level}]{rid_part} {message}"

        self.log_history.append(formatted_message)
        if len(self.log_history) > self.max_history:
            self.log_history.pop(0)
        if summary:
            self.summary_history.append(formatted_message)
            if len(self.summary_history) > self.max_history:
                self.summary_history.pop(0)

        if hasattr(self, "file_logger"):
            log_method = getattr(self.file_logger, level.lower(), None)
            if callable(log_method):
                log_method(message)

        if self.log_sink:
            try:
                self.log_sink(formatted_message)
            except Exception:
                pass

        try:
            print(formatted_message)
        except UnicodeEncodeError:
            encoding = sys.stdout.encoding or "utf-8"
            safe_message = formatted_message.encode(encoding, errors="replace").decode(
                encoding, errors="replace"
            )
            print(safe_message)

    def clear_log(self):
        self.log_history.clear()
        self.summary_history.clear()

    def get_log_history(self) -> List[str]:
        return self.log_history.copy()

    def get_summary_history(self) -> List[str]:
        return self.summary_history.copy()

    # Backward compatibility with legacy Tkinter UI.
    def set_log_widget(self, widget):
        def sink(msg: str):
            try:
                widget.insert("end", msg + "\n")
                widget.see("end")
                widget.update_idletasks()
            except Exception:
                pass

        self.log_sink = sink
