import os
import sys
from pathlib import Path
from pprint import pprint

os.environ.setdefault("OPENAI_API_KEY", "x" * 40)
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ui.web_app import WebApp


def main():
    web = WebApp()
    app = web.app

    results = {}
    with app.test_client() as c:
        r_login_page = c.get("/login")
        results["login_page"] = r_login_page.status_code

        r_me = c.get("/api/auth/me")
        results["auth_me_without_login"] = r_me.status_code

        c.get("/login")
        r_csrf = c.post("/api/setores", json={"nome": "SMOKE CSRF"})
        results["csrf_on_mutation"] = r_csrf.status_code

    pprint(results)
    ok = (
        results.get("login_page") == 200
        and results.get("auth_me_without_login") == 401
        and results.get("csrf_on_mutation") == 403
    )
    print("SMOKE_OK" if ok else "SMOKE_FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
