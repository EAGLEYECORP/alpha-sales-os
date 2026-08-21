import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync, deflateSync } from "node:zlib";
import {
  extractFile, extractHtml, extractPdf, extractDocx, kindFromName, decodeEntities, suggestTitle,
} from "../lib/file-extract";

const enc = (s: string) => new TextEncoder().encode(s);
const toAB = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

test("type de fichier — reconnu par extension et par mime", () => {
  assert.equal(kindFromName("audit.pdf"), "pdf");
  assert.equal(kindFromName("cr.DOCX"), "docx");
  assert.equal(kindFromName("mail.htm"), "html");
  assert.equal(kindFromName("notes.md"), "markdown");
  assert.equal(kindFromName("liste.csv"), "texte");
  assert.equal(kindFromName("photo.jpg"), "inconnu");
  assert.equal(kindFromName("sans-extension", "application/pdf"), "pdf");
});

test("entités HTML — les accents français sont restitués", () => {
  assert.equal(decodeEntities("caf&eacute; &amp; cr&egrave;me"), "café & crème");
  assert.equal(decodeEntities("&#233;t&#xE9;"), "été");
  assert.equal(decodeEntities("10&nbsp;000&euro;"), "10 000€");
});

test("HTML — le script et le style ne polluent pas le texte", () => {
  const html = `
    <html><head><style>.a{color:red}</style></head>
    <body><script>var x = "ne doit pas apparaitre";</script>
    <h1>Audit ***NOM-RETIRE***</h1><p>600 leads par mois.</p><p>Gain estim&eacute; : 76&nbsp;000&euro;.</p>
    </body></html>`;
  const r = extractHtml(html);
  assert.equal(r.ok, true);
  assert.doesNotMatch(r.text, /ne doit pas apparaitre/);
  assert.doesNotMatch(r.text, /color:red/);
  assert.match(r.text, /Audit ***NOM-RETIRE***/);
  assert.match(r.text, /Gain estimé : 76 000€/);
  // Les blocs deviennent des lignes, pas une bouillie d'une seule phrase.
  assert.ok(r.text.split("\n").length >= 3);
});

/** Construit un PDF minimal mais VALIDE, avec un flux de contenu compressé. */
function makePdf(lines: string[], compress = true): ArrayBuffer {
  const content = lines.map((l) => `BT /F1 12 Tf 72 700 Td (${l}) Tj ET`).join("\n");
  const body = compress ? deflateSync(Buffer.from(content, "latin1")) : Buffer.from(content, "latin1");
  const head = Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Length ${body.length}${compress ? " /Filter /FlateDecode" : ""} >>\nstream\n`,
    "latin1"
  );
  const tail = Buffer.from("\nendstream\nendobj\n%%EOF", "latin1");
  return toAB(new Uint8Array(Buffer.concat([head, body, tail])));
}

test("PDF — le texte d'un flux compressé est extrait", async () => {
  const r = await extractPdf(makePdf(["Audit Carrosserie des Brotteaux", "9 appels manques par semaine"]));
  assert.equal(r.ok, true);
  assert.match(r.text, /Audit Carrosserie des Brotteaux/);
  assert.match(r.text, /9 appels manques/);
});

test("PDF — un flux non compressé marche aussi", async () => {
  const r = await extractPdf(makePdf(["Proposition commerciale ScintIA"], false));
  assert.equal(r.ok, true);
  assert.match(r.text, /Proposition commerciale ScintIA/);
});

test("PDF — un scan sans texte est SIGNALÉ, pas rendu vide en silence", async () => {
  // Un PDF valide dont le seul flux est une image : aucun opérateur de texte.
  const img = Buffer.from("\xff\xd8\xff\xe0 donnees binaires", "latin1");
  const pdf = Buffer.concat([
    Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Subtype /Image /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, "latin1"),
    img,
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);
  const r = await extractPdf(toAB(new Uint8Array(pdf)));
  assert.equal(r.ok, false);
  assert.match(r.warning!, /SCANN/i);
  assert.match(r.warning!, /OCR/);
});

test("PDF — un fichier qui n'en est pas un est refusé clairement", async () => {
  const r = await extractPdf(toAB(enc("ceci est du texte brut")));
  assert.equal(r.ok, false);
  assert.match(r.warning!, /pas un PDF/i);
});

/** Construit un .docx minimal : un ZIP contenant word/document.xml. */
function makeDocx(paragraphs: string[]): ArrayBuffer {
  const xml =
    `<?xml version="1.0"?><w:document><w:body>` +
    paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("") +
    `</w:body></w:document>`;
  const name = Buffer.from("word/document.xml", "latin1");
  const data = deflateRawSync(Buffer.from(xml, "utf-8"));

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // signature PK\x03\x04
  local.writeUInt16LE(8, 8); // méthode : deflate
  local.writeUInt32LE(data.length, 18); // taille compressée
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  return toAB(new Uint8Array(Buffer.concat([local, name, data])));
}

test("DOCX — les paragraphes sont extraits et séparés", async () => {
  const r = await extractDocx(makeDocx(["Compte rendu de cadrage", "Budget débloqué en septembre"]));
  assert.equal(r.ok, true);
  assert.match(r.text, /Compte rendu de cadrage/);
  assert.match(r.text, /Budget débloqué en septembre/);
  assert.equal(r.text.split("\n").length, 2, "un paragraphe = une ligne");
});

test("DOCX — un fichier non-ZIP est refusé avec une explication", async () => {
  const r = await extractDocx(toAB(enc("pas un zip")));
  assert.equal(r.ok, false);
  assert.match(r.warning!, /signature ZIP/i);
});

test("point d'entrée — chaque format passe par extractFile", async () => {
  assert.equal((await extractFile("a.txt", toAB(enc("bonjour")))).text, "bonjour");
  assert.equal((await extractFile("a.md", toAB(enc("# Titre")))).kind, "markdown");
  assert.match((await extractFile("m.html", toAB(enc("<p>salut</p>")))).text, /salut/);
  assert.equal((await extractFile("d.pdf", makePdf(["ok"]))).kind, "pdf");

  // Format non géré : refus explicite qui liste ce qui est accepté.
  const img = await extractFile("photo.jpg", toAB(enc("...")));
  assert.equal(img.ok, false);
  assert.match(img.warning!, /Format non géré/);
  assert.match(img.warning!, /PDF, DOCX, HTML/);
});

test("titre — proposé depuis la première ligne utile, sinon le nom du fichier", () => {
  assert.equal(suggestTitle("audit.pdf", "Audit ***NOM-RETIRE*** × Scintia\nsuite du texte"), "Audit ***NOM-RETIRE*** × Scintia");
  // Lignes trop courtes → repli sur le nom, sans extension.
  assert.equal(suggestTitle("mon-audit.pdf", "a\nb\nc"), "mon-audit");
});
