/* Detalle de documentos, folios y montos: cada documento puede indicar, si se quiere,
   el establecimiento (RBD) al que pertenece. En el formulario se elige de una lista; en
   la plantilla de Excel, de una lista desplegable nativa. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { entorno, abrir, registroEmitido } = require("./apoyo");

const BICENTENARIO = "COLEGIO BICENTENARIO — RBD 40242-7";
const G45 = "ESCUELA BASICA G-45 — RBD 1180-0";
const G47 = "ESCUELA BASICA G-47 — RBD 1182-7";
const LA_VINA = "ESCUELA BASICA LA VIÑA — RBD 1178-9";

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

const filasDetalle = pagina => pagina.evaluate(() =>
  state.detalle.map(d => [d.tipo, d.folio, d.monto, d.establecimiento || ""]));

async function importar(pagina, dialogos, nombre, contenido){
  const vistos = dialogos.vistos.length;
  await pagina.setInputFiles("#impDetalleFile", { name: nombre,
    mimeType: nombre.endsWith(".csv") ? "text/csv" : "application/octet-stream",
    buffer: Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, "utf-8") });
  for(let i = 0; i < 100 && dialogos.vistos.length === vistos; i++) await pagina.waitForTimeout(20);
  return dialogos.ultimo().texto;
}

test("cada documento puede indicar su establecimiento; los del set van primero", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  await pagina.selectOption("#programaSelect", "Programa 02");
  await pagina.selectOption("#unitSelect", G45);
  await pagina.click("#addUnidadBtn");
  await pagina.locator("[data-unidad-extra]").last().selectOption(G47);
  await pagina.click("#addDetalleBtn");

  const encabezados = await pagina.locator("#detalleBox thead th").allTextContents();
  assert.ok(encabezados.includes("Establecimiento (opcional)"), encabezados.join(" | "));
  const select = pagina.locator('[data-det-field="establecimiento"]').first();
  const grupos = await select.evaluate(s => [...s.querySelectorAll("optgroup")].map(g =>
    [g.label, [...g.querySelectorAll("option")].map(o => o.value)]));
  assert.deepEqual(grupos[0], ["Del set", [G45, G47]]);
  assert.equal(grupos.slice(1).reduce((n, [, os]) => n + os.length, 0), 66, "el resto, sin repetir");
  assert.equal(await select.inputValue(), "", "es opcional: parte vacío");

  await select.selectOption(G47);
  assert.equal(await pagina.evaluate(() => state.detalle[0].establecimiento), G47);
  await pagina.context().close();
});

test("el certificado agrega la columna sólo si algún documento indica establecimiento", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  for(let i = 0; i < 2; i++) await pagina.click("#addDetalleBtn");
  for(const [i, folio, monto] of [[0, "101", "1000"], [1, "102", "2500"]]){
    await pagina.locator(`[data-det="${i}"][data-det-field="tipo"]`).fill("Factura Electrónica");
    await pagina.locator(`[data-det="${i}"][data-det-field="folio"]`).fill(folio);
    await pagina.locator(`[data-det="${i}"][data-det-field="monto"]`).fill(monto);
  }
  const cabeceraII_b = async () => {
    await pagina.click("#previewBtn");
    const t = await pagina.locator(".cert-section", { hasText: "II.b" }).locator("thead th").allTextContents();
    await pagina.click("#closePreviewBtn");
    return t;
  };
  assert.ok(!(await cabeceraII_b()).includes("Establecimiento"), "sin establecimientos, como antes");

  await pagina.locator('[data-det="0"][data-det-field="establecimiento"]').selectOption(LA_VINA);
  assert.ok((await cabeceraII_b()).includes("Establecimiento"));
  await pagina.click("#previewBtn");
  const filas = await pagina.locator(".cert-section", { hasText: "II.b" }).locator("tbody tr").allTextContents();
  assert.match(filas[0], /LA VIÑA — RBD 1178-9/);
  assert.match(filas[1], /—/, "el que no lo indica, con guion");
  assert.match(filas[2], /Total\s*\$3\.500/);
  await pagina.context().close();
});

test("la plantilla es un Excel con listas desplegables, y se vuelve a importar tal cual", async () => {
  const { pagina, dialogos } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  const [descarga] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#tplDetalleBtn")]);
  assert.equal(descarga.suggestedFilename(), "detalle-documentos-plantilla.xlsx");
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "plantilla-")), "p.xlsx");
  await descarga.saveAs(archivo);
  const bytes = fs.readFileSync(archivo);
  fs.rmSync(path.dirname(archivo), { recursive: true, force: true });

  // Se guarda sin comprimir, así que el XML se puede revisar directamente.
  const texto = bytes.toString("utf-8");
  assert.equal(bytes.readUInt32LE(0), 0x04034b50, "es un ZIP");
  assert.match(texto, /<sheet name="Detalle"[^>]*\/><sheet name="Listas"/);
  assert.match(texto, /<dataValidation type="list"[^>]*sqref="E2:E1000"><formula1>Listas!\$A\$2:\$A\$69<\/formula1>/);
  assert.match(texto, /<dataValidation type="list"[^>]*sqref="A2:A1000"><formula1>Listas!\$B\$2:\$B\$6<\/formula1>/);
  assert.ok(texto.includes("MUNDO DE PEQUES — RBD 33549-5"), "trae los 68 establecimientos");

  const resumen = await importar(pagina, dialogos, "plantilla.xlsx", bytes);
  assert.match(resumen, /Se leyeron 2 documento\(s\)/);
  assert.deepEqual(await filasDetalle(pagina), [
    ["Factura Electrónica", "55501", "1250000", BICENTENARIO],
    ["Nota de Crédito", "128", "-90000", ""]
  ]);
  await pagina.context().close();
});

test("al importar, el establecimiento se reconoce por nombre o por RBD, con o sin dígito", async () => {
  const { pagina, dialogos } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  const csv = "Tipo de documento;Folio;Fecha de emisión;Monto;RBD\n" +
              "Boleta;1;01-10-2026;100;1180-0\n" +
              "Boleta;2;01-10-2026;200;RBD 1182-7\n" +
              "Boleta;3;01-10-2026;300;1178\n" +
              "Boleta;4;01-10-2026;400;Escuela Básica La Viña\n" +
              `Boleta;5;01-10-2026;500;${BICENTENARIO}\n` +
              "Boleta;6;01-10-2026;600;9999-9\n" +
              "Boleta;7;01-10-2026;700;\n";
  const resumen = await importar(pagina, dialogos, "rbd.csv", csv);
  assert.match(resumen, /Se leyeron 7 documento\(s\)/);
  assert.match(resumen, /1 documento\(s\) traen un establecimiento o RBD que no es del Servicio[\s\S]*fila 7: "9999-9"/);
  assert.deepEqual((await filasDetalle(pagina)).map(f => f[3]),
    [G45, G47, LA_VINA, LA_VINA, BICENTENARIO, "", ""]);
  await pagina.context().close();
});

test("una planilla de antes, sin la columna, se importa igual", async () => {
  const { pagina, dialogos } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  const resumen = await importar(pagina, dialogos, "antigua.csv",
    "Tipo de documento;Folio;Fecha de emisión;Monto\nFactura Electrónica;9;01-09-2026;1.000\n");
  assert.match(resumen, /Se leyeron 1 documento\(s\)/);
  assert.deepEqual(await filasDetalle(pagina), [["Factura Electrónica", "9", "1000", ""]]);
  await pagina.context().close();
});

test("un certificado emitido antes del cambio se imprime igual", async () => {
  const antiguo = registroEmitido({ id: "det-viejo", folio: "CMF-2026-P01-GAB700-017",
    nature: "servicios", natureLabel: "Servicios Básicos",
    detalle: [{ tipo: "Boleta", folio: "77", fecha: "2026-09-01", monto: "5000" }] });
  const { pagina } = await abrir(ent, { conectado: false, registros: [antiguo] });
  await pagina.evaluate(() => viewRecord("det-viejo"));
  const seccion = pagina.locator(".cert-section", { hasText: "II.b" });
  assert.deepEqual(await seccion.locator("thead th").allTextContents(),
    ["N.º", "Tipo de documento", "Folio", "Fecha de emisión", "Monto"]);
  await pagina.context().close();
});

test("en la lista del detalle, el RBD se ve primero", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  await pagina.click("#addDetalleBtn");
  const opcion = await pagina.locator('[data-det-field="establecimiento"] option', { hasText: "G-45" })
    .evaluate(o => [o.value, o.textContent]);
  assert.deepEqual(opcion, [G45, "RBD 1180-0 · ESCUELA BASICA G-45"]);
  await pagina.context().close();
});
