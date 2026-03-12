#!/usr/bin/env python
"""
SISTEMA DE ANALISE E GERACAO DOCUMENTAL - WEB
"""

import logging
import threading
import webbrowser
import os
import socket

from ui.web_app import WebApp


def main():
    """Ponto de entrada principal do sistema web."""
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    web = WebApp()
    web.logger.info("Iniciando servidor web do Sistema de Analise Documental")
    app_host = str(os.getenv("APP_HOST", "127.0.0.1")).strip() or "127.0.0.1"
    app_port = int(str(os.getenv("APP_PORT", "5400")).strip() or "5400")
    public_host = str(os.getenv("APP_PUBLIC_HOST", "")).strip()
    local_url = f"http://127.0.0.1:{app_port}"
    display_host = public_host or (socket.gethostname() if app_host == "0.0.0.0" else app_host)
    access_url = f"http://{display_host}:{app_port}"
    web.logger.summary(f"Acesso local: {local_url}")
    if access_url != local_url:
        web.logger.summary(f"Acesso em rede: {access_url}")
    use_reloader = str(os.getenv("USE_RELOADER", "0")).strip() != "0"
    is_reloader_child = str(os.getenv("WERKZEUG_RUN_MAIN", "")).lower() == "true"
    should_open_browser = (not use_reloader) or is_reloader_child
    if should_open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(local_url)).start()
    web.app.run(host=app_host, port=app_port, debug=False, use_reloader=use_reloader)


if __name__ == "__main__":
    main()
