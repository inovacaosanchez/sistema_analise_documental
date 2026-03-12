(function () {
  async function hpoApi(path, options = {}) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
    const baseHeaders = { "Content-Type": "application/json", "X-CSRF-Token": csrfToken };
    const response = await fetch(path, { headers: { ...baseHeaders, ...(options.headers || {}) }, ...options });

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    let payload = null;
    let rawText = "";
    if (contentType.includes("application/json")) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    } else {
      try {
        rawText = await response.text();
      } catch {
        rawText = "";
      }
    }

    if (!response.ok) {
      const message = (payload && payload.message) || rawText || `Erro HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload || {};
  }

  window.hpoApi = hpoApi;
})();
