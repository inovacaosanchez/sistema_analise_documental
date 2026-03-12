import os
import unittest


class WebSecuritySmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("OPENAI_API_KEY", "x" * 40)
        from ui.web_app import WebApp

        cls.web = WebApp()
        cls.app = cls.web.app

    def test_csrf_blocks_mutation_without_token(self):
        with self.app.test_client() as c:
            c.get("/login")
            resp = c.post("/api/setores", json={"nome": "CSRF Block"})
            self.assertEqual(403, resp.status_code)


if __name__ == "__main__":
    unittest.main()
