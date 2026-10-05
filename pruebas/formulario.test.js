/* Reglas del formulario que describe el README: qué se pide según el programa y el
   financiamiento, y la importación de la planilla de documentos. Ninguna necesita el
   registro central. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { entorno, abrir, registroEmitido } = require("./apoyo");

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

const opciones = (pagina, sel) =>
  pagina.$eval(sel, s => [...s.options].map(o => o.value).filter(Boolean));

test("el rótulo y la lista de financiamiento cambian con el programa", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#programaSelect", "Programa 01");
  assert.equal(await pagina.textContent("#subvencionLabel"), "Financiamiento *");
  assert.deepEqual(await opciones(pagina, "#subvencionSelect"),
    ["RESTO", "Remuneración P01", "Fondos No Ley", "Otros Ingresos P01"]);

  await pagina.selectOption("#programaSelect", "Programa 02");
  assert.equal(await pagina.textContent("#subvencionLabel"), "Subvención *");
  assert.deepEqual(await opciones(pagina, "#subvencionSelect"),
    ["SUBV. GENERAL", "PIE", "SEP", "FAEP", "JUNJI", "MANTENIMIENTO", "PRO-RETENCIÓN", "RESTO", "OTRO"]);
  await pagina.context().close();
});

test("la opción abierta exige detalle, y el extrapresupuestario exige nombre", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#programaSelect", "Programa 02");
  await pagina.selectOption("#subvencionSelect", "OTRO");
  assert.ok(await pagina.isVisible("#subvencionDetalleField"));
  let errores = await pagina.evaluate(() => validate());
  assert.ok(errores.includes('Especifique a qué corresponde "OTRO".'), errores.join("\n"));

  await pagina.selectOption("#programaSelect", "Programa Extrapresupuestario");
  assert.ok(await pagina.isVisible("#programaNombreField"));
  errores = await pagina.evaluate(() => validate());
  assert.ok(errores.includes("Indique el nombre del programa extrapresupuestario."));
  await pagina.context().close();
});

test("el complementario D.1 se pide sólo con Programa 02 y SEP, PRO-RETENCIÓN o PIE", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "adquisiciones");
  const filas = () => pagina.$$eval("#docList .doc-name", ds => ds.map(d => d.textContent).join(" | "));

  for(const [programa, fin, aplica] of [
    ["Programa 02", "SEP", true], ["Programa 02", "PIE", true], ["Programa 02", "PRO-RETENCIÓN", true],
    ["Programa 02", "FAEP", false], ["Programa 01", "RESTO", false]
  ]){
    await pagina.selectOption("#programaSelect", programa);
    await pagina.selectOption("#subvencionSelect", fin);
    assert.equal(/[Ll]ista de asistencia/.test(await filas()), aplica, `${programa} ${fin}`);
  }

  // Con SEP la Solicitud de Compra pide la acción y la dimensión del PME.
  await pagina.selectOption("#programaSelect", "Programa 02");
  await pagina.selectOption("#subvencionSelect", "SEP");
  const campos = await pagina.$$eval('#docList [data-row="02"] [data-field]', es => es.map(e => e.dataset.field));
  assert.ok(campos.includes("pmeAccion") && campos.includes("pmeDimension"), campos.join());
  await pagina.selectOption("#subvencionSelect", "PIE");
  const sinPme = await pagina.$$eval('#docList [data-row="02"] [data-field]', es => es.map(e => e.dataset.field));
  assert.ok(!sinPme.includes("pmeAccion"), sinPme.join());
  await pagina.context().close();
});

test("la vista previa de un borrador lista lo que falta para emitir", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "honorarios");
  await pagina.click("#previewBtn");
  const aviso = await pagina.textContent("#previewWarning");
  assert.match(aviso, /Borrador — este documento no es válido como certificado/);
  assert.match(aviso, /Seleccione el programa presupuestario/);
  assert.match(aviso, /Debe aceptar la declaración/);
  assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "BORRADOR");
  await pagina.context().close();
});

test("importar la misma planilla dos veces no duplica montos", async () => {
  const { pagina, dialogos } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  const csv = "Tipo de documento;Folio;Fecha de emisión;Monto\n" +
              "Factura electrónica;101;15-09-2026;$1.250.000\n" +
              "Boleta;102;2026-09-16;35.990\n" +
              ";;;\n" +
              "Nota de crédito;103;16/09/2026;no es monto\n";
  const archivo = { name: "detalle.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") };

  await pagina.setInputFiles("#impDetalleFile", archivo);
  await pagina.waitForFunction(() => state.detalle.length === 2);
  const resumen = dialogos.ultimo().texto;
  assert.match(resumen, /Se leyeron 2 documento\(s\)/);
  assert.match(resumen, /monto ilegible/);
  assert.deepEqual(await pagina.evaluate(() => state.detalle.map(d => [d.folio, d.fecha, d.monto])),
    [["101", "2026-09-15", "1250000"], ["102", "2026-09-16", "35990"]]);

  const vistos = dialogos.vistos.length;
  await pagina.setInputFiles("#impDetalleFile", []);
  await pagina.setInputFiles("#impDetalleFile", archivo);
  for(let i = 0; i < 100 && dialogos.vistos.length === vistos; i++) await pagina.waitForTimeout(20);
  assert.match(dialogos.ultimo().texto, /No se agregó ninguna fila[\s\S]*2 ya estaban en la tabla/);
  assert.equal(await pagina.evaluate(() => state.detalle.length), 2);
  await pagina.context().close();
});

test("la fecha del detalle se imprime tal como se ingresó, sin correrse un día", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "adquisiciones");
  await pagina.click("#addDetalleBtn");
  const fila = pagina.locator("#detalleBox tbody tr").first();
  await fila.locator('[data-det-field="tipo"]').fill("Factura Electrónica");
  await fila.locator('[data-det-field="fecha"]').fill("2026-10-01");
  await fila.locator('[data-det-field="monto"]').fill("50000");

  await pagina.click("#previewBtn");
  const detalle = await pagina.locator("#certificatePreview").textContent();
  assert.match(detalle, /01-10-2026/);
  assert.doesNotMatch(detalle, /30-09-2026/, "medianoche UTC es el día anterior en Chile");

  // Lo mismo en el borde del año, y con una fecha importada desde la planilla.
  assert.deepEqual(await pagina.evaluate(() =>
    ["2026-01-01", "2026-12-31", normalizarFecha("45931")].map(f => shortDate(f))),
    ["01-01-2026", "31-12-2026", "01-10-2025"]);
  await pagina.context().close();
});

const RECEPCION = "Recepción Conforme (Establecimiento / Director o Directora)";

test("Servicios Básicos pide la Recepción Conforme del establecimiento", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#natureSelect", "servicios");
  const nombres = await pagina.$$eval("#docList .doc-name", ds => ds.map(d => d.textContent.trim()));
  assert.ok(nombres.some(n => n.startsWith(RECEPCION)), nombres.join(" | "));
  const fila = pagina.locator("#docList .doc-row", { hasText: RECEPCION });
  const rotulo = `${(await fila.locator(".doc-no").textContent()).trim()} ${RECEPCION}`;

  let errores = await pagina.evaluate(() => validate());
  assert.ok(errores.includes(`${rotulo}: debe verificarse o registrar una excepción.`), errores.join("\n"));

  // Si no corresponde —un set de la Unidad Central— se registra la excepción "No aplica".
  await fila.locator("[data-ex]").click();
  await fila.locator("[data-ex-type]").selectOption("No aplica");
  errores = await pagina.evaluate(() => validate());
  assert.ok(!errores.some(e => e.includes(RECEPCION)), errores.join("\n"));
  await pagina.context().close();
});

test("los Servicios Básicos ya emitidos se reimprimen como se emitieron, sin la fila nueva", async () => {
  // Un certificado emitido antes del cambio: su checklist no trae la recepción conforme.
  const docs = {};
  for(const no of ["01", "02", "03", "05", "06", "07"]) docs[no] = { checked: true, fields: { number: "1" } };
  const emitido = registroEmitido({ id: "sb-1", folio: "CMF-2026-P01-SAF104-011", nature: "servicios",
    natureLabel: "Servicios Básicos", docs });
  const borrador = registroEmitido({ id: "sb-2", folio: null, status: "draft", issuedAt: null,
    nature: "servicios", natureLabel: "Servicios Básicos", docs });
  const { pagina } = await abrir(ent, { conectado: false, registros: [emitido, borrador] });

  await pagina.evaluate(() => viewRecord("sb-1"));
  const impreso = await pagina.textContent("#certificatePreview");
  assert.doesNotMatch(impreso, /Recepción Conforme/, "lo emitido no cambia");
  assert.match(impreso, /06\s*Compromiso Presupuestario/, "ni se corre la numeración");
  await pagina.click("#closePreviewBtn");

  // Un borrador, en cambio, sí la pide: todavía no se ha certificado.
  await pagina.evaluate(() => editRecord("sb-2"));
  const nombres = await pagina.$$eval("#docList .doc-name", ds => ds.map(d => d.textContent.trim()));
  assert.ok(nombres.some(n => n.startsWith(RECEPCION)), nombres.join(" | "));
  await pagina.context().close();
});
