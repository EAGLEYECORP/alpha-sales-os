import { test } from "node:test";
import assert from "node:assert/strict";
import { stripHtml, safePublicUrl } from "../lib/site-fetch";

test("site-fetch — stripHtml enlève script/style/balises, garde le texte", () => {
  const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
    <body><h1>Garage ***NOM-RETIRE***</h1><p>Carrosserie à Lyon 7e.</p><div>Avis&nbsp;: 4,2</div></body></html>`;
  const out = stripHtml(html);
  assert.ok(out.includes("Garage ***NOM-RETIRE***"));
  assert.ok(out.includes("Carrosserie à Lyon 7e"));
  assert.ok(out.includes("Avis : 4,2"), "entité &nbsp; convertie");
  assert.ok(!/alert|color:red|<[^>]+>/.test(out), "script/style/balises retirés");
});

test("site-fetch — safePublicUrl accepte un domaine public et complète le schéma", () => {
  assert.equal(safePublicUrl("https://eagleyecorp.fr"), "https://eagleyecorp.fr/");
  assert.equal(safePublicUrl("eagleyecorp.fr"), "https://eagleyecorp.fr/", "https:// ajouté");
  assert.ok(safePublicUrl("http://garage-lyon.fr/contact"));
});

test("site-fetch — safePublicUrl bloque loopback / IP privées / intranet (anti-SSRF)", () => {
  for (const bad of [
    "http://localhost/admin",
    "http://127.0.0.1",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data", // métadonnées cloud
    "http://172.16.0.9",
    "http://intranet", // pas de point → intranet
    "ftp://exemple.fr",
    "file:///etc/passwd",
    "",
  ]) {
    assert.equal(safePublicUrl(bad), null, `doit refuser : ${bad}`);
  }
});
