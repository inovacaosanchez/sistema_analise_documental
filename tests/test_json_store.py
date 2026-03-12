import tempfile
import unittest
from pathlib import Path

from repositories.json_store import JsonRepositoryStore


class JsonRepositoryStoreTests(unittest.TestCase):
    def test_read_write_roundtrip(self):
        store = JsonRepositoryStore()
        with tempfile.TemporaryDirectory() as td:
            fp = Path(td) / "sample.json"
            payload = [{"id": 1, "nome": "Teste"}]
            store.write(fp, payload)
            loaded = store.read(fp, default=[])
            self.assertEqual(payload, loaded)

    def test_read_default_when_missing(self):
        store = JsonRepositoryStore()
        with tempfile.TemporaryDirectory() as td:
            fp = Path(td) / "missing.json"
            loaded = store.read(fp, default=[])
            self.assertEqual([], loaded)


if __name__ == "__main__":
    unittest.main()
