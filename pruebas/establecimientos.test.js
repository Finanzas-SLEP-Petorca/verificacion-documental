/* Un set del Programa 02 puede abarcar varios establecimientos. Se elige el principal
   como siempre y, sólo con ese programa, se agregan los demás. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { ANIO, entorno, abrir, llenarFormulario, emitir, registrosLocales, irAlRegistro,
        cerrarVistaPrevia, registroEmitido, elegirUnidad, valorUnidad } = require("./apoyo");

const E = [
  "COLEGIO BICENTENARIO — RBD 40242-7",
  "CTRO.REC.ATENC.DIVERS.CRAD PAUL PERCY HARRIS — RBD 11196-1",
  "ESCUELA BASICA G-45 — RBD 1180-0",
  "ESCUELA BASICA G-47 — RBD 1182-7",
  "ESCUELA BASICA LA FRONTERA DE ALICAHUE — RBD 1171-1",
  "ESCUELA BASICA LA VIÑA — RBD 1178-9",
  "ESCUELA BASICA LOS ANGELES — RBD 1181-9",
  "ESCUELA BASICA MUNICIPAL ARAUCARIA — RBD 14479-7",
  "ESCUELA BASICA SAN LORENZO — RBD 1174-6"
];

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

async function agregar(pagina, nombre){
  await pagina.click("#addUnidadBtn");
  await elegirUnidad(pagina, pagina.locator("[data-unidad-extra]").last(), nombre);
}

/* Un certificado completo de Programa 02 con el principal y los adicionales dados. */
async function conVarios(pagina, principal, adicionales){
  await llenarFormulario(pagina, { programa: "Programa 02", financiamiento: "SUBV. GENERAL" });
  await elegirUnidad(pagina, "#unitSelect .sel-est", principal);
  for(const u of adicionales) await agregar(pagina, u);
}

test("sólo el Programa 02 ofrece agregar establecimientos", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  assert.ok(await pagina.isHidden("#unidadesExtraField"), "sin programa");
  for(const programa of ["Programa 01", "Programa Extrapresupuestario"]){
    await pagina.selectOption("#programaSelect", programa);
    assert.ok(await pagina.isHidden("#unidadesExtraField"), programa);
  }
  await pagina.selectOption("#programaSelect", "Programa 02");
  assert.ok(await pagina.isVisible("#unidadesExtraField"));
  await pagina.context().close();
});

test("la lista ofrece sólo establecimientos y no repite los ya elegidos", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.selectOption("#programaSelect", "Programa 02");
  await elegirUnidad(pagina, "#unitSelect .sel-est", E[0]);
  await agregar(pagina, E[1]);
  await pagina.click("#addUnidadBtn");
  await pagina.locator("[data-unidad-extra]").last().click();

  const opciones = await pagina.$$eval("#selUnidadPanel .op", os => os.map(o =>
    ({ v: o.dataset.v, off: o.getAttribute("aria-disabled") === "true" })));
  assert.ok(!opciones.some(o => o.v.startsWith("Subdirección") || o.v.startsWith("Gabinete")),
    "las subdirecciones de la Unidad Central no son establecimientos");
  assert.equal(opciones.length, 68);
  assert.deepEqual(opciones.filter(o => o.off).map(o => o.v).sort(), [E[0], E[1]].sort());
  await pagina.context().close();
});

test("una fila sin elegir o un establecimiento repetido no se emiten", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await conVarios(pagina, E[0], [E[1]]);
  await pagina.click("#addUnidadBtn");
  let errores = await pagina.evaluate(() => validate());
  assert.ok(errores.includes("Seleccione el establecimiento N° 3 o quítelo."), errores.join("\n"));

  await pagina.locator("[data-unidad-rm]").last().click();
  assert.deepEqual(await pagina.evaluate(() => validate()), []);

  // Si el principal se cambia a uno que ya estaba entre los adicionales.
  await elegirUnidad(pagina, "#unitSelect .sel-est", E[1]);
  errores = await pagina.evaluate(() => validate());
  assert.ok(errores.includes(`El establecimiento "${E[1]}" está repetido en el set.`), errores.join("\n"));
  await pagina.context().close();
});

test("cambiar a otro programa descarta los establecimientos adicionales", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await conVarios(pagina, E[0], [E[1], E[2]]);
  await pagina.selectOption("#programaSelect", "Programa 01");
  assert.ok(await pagina.isHidden("#unidadesExtraField"));
  await pagina.selectOption("#subvencionSelect", "RESTO");
  assert.deepEqual(await pagina.evaluate(() => makeRecord("draft").unidadesExtra), []);
  await pagina.click("#previewBtn");
  const impreso = await pagina.textContent("#certificatePreview");
  assert.match(impreso, /COLEGIO BICENTENARIO/, "el principal se queda");
  assert.doesNotMatch(impreso, /PAUL PERCY HARRIS|G-45/, "los adicionales se van");
  await pagina.context().close();
});

test("el certificado imprime todos los establecimientos", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await conVarios(pagina, E[0], [E[1], E[2]]);
  await pagina.click("#previewBtn");
  const cert = pagina.locator("#certificatePreview");
  // El encabezado es angosto: el principal y cuántos más. La lista va en la sección I.
  const meta = await cert.locator(".cert-meta").textContent();
  assert.match(meta, /Establecimientos del set:/);
  assert.ok(meta.includes(`${E[0]} y 2 más (detalle en I.)`), meta);
  const fila = await cert.locator("tr", { hasText: "Unidad / Establecimiento del set" }).textContent();
  for(const u of E.slice(0, 3)) assert.ok(fila.includes(u), `${u} en la identificación`);
  await pagina.context().close();
});

test("al emitir, el Servicio recibe la lista en Unidad y el certificado completo en Datos", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina } = await abrir(ent);
  await conVarios(pagina, E[0], [E[1], E[2]]);
  await emitir(pagina);

  const [rec] = await registrosLocales(pagina);
  assert.equal(rec.folio, `CMF-${ANIO}-P02-GAB700-010`);
  assert.equal(rec.unit, E[0], "el principal sigue en unit");
  assert.deepEqual(rec.unidadesExtra, [E[1], E[2]]);
  const [fila] = await ent.registro.filas();
  assert.equal(fila.Unidad, E.slice(0, 3).join("; "));
  assert.deepEqual(JSON.parse(fila.Datos).unidadesExtra, [E[1], E[2]]);

  // En el registro se ve el principal con cuántos más, y la búsqueda encuentra a todos.
  await cerrarVistaPrevia(pagina);
  await irAlRegistro(pagina);
  const celda = pagina.locator("#recordsBody tr", { hasText: rec.folio }).locator("td").nth(4);
  assert.match(await celda.textContent(), /COLEGIO BICENTENARIO.*\+2/s);
  await pagina.fill("#recordSearch", "G-45");
  assert.match(await pagina.textContent("#recordsBody"), new RegExp(rec.folio));
  await pagina.context().close();
});

test("con muchos establecimientos, Unidad no pasa de 255 caracteres y se emite igual", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina, dialogos } = await abrir(ent);
  await conVarios(pagina, E[0], E.slice(1));
  await emitir(pagina);

  const [rec] = await registrosLocales(pagina);
  assert.ok(rec && rec.folio, "se emitió: " + (dialogos.ultimo() || {}).texto);
  const [fila] = await ent.registro.filas();
  assert.ok(fila.Unidad.length <= 255, fila.Unidad.length);
  assert.equal(fila.Unidad, `${E[0]} y 8 establecimientos más`);
  assert.deepEqual(JSON.parse(fila.Datos).unidadesExtra, E.slice(1), "la lista completa va en Datos");
  // El certificado los imprime todos igual.
  for(const u of E) assert.ok((await pagina.textContent("#certificatePreview")).includes(u), u);
  await pagina.context().close();
});

test("duplicar y retomar un borrador conservan los establecimientos", async () => {
  const borrador = registroEmitido({ id: "b-varios", folio: null, status: "draft", issuedAt: null,
    programa: "Programa 02", subvencion: "SUBV. GENERAL", unit: E[0], unidadesExtra: [E[1], E[2]] });
  const emitido = registroEmitido({ id: "e-varios", folio: `CMF-${ANIO}-P02-GAB700-012`,
    programa: "Programa 02", subvencion: "SUBV. GENERAL", unit: E[3], unidadesExtra: [E[4]] });
  const { pagina } = await abrir(ent, { conectado: false, registros: [borrador, emitido] });

  await pagina.evaluate(() => editRecord("b-varios"));
  assert.equal(await valorUnidad(pagina.locator("#unitSelect .sel-est")), E[0]);
  assert.deepEqual(await pagina.$$eval("[data-unidad-extra]", ss => ss.map(s => s.dataset.valor)), [E[1], E[2]]);

  await pagina.evaluate(() => duplicateRecord("e-varios"));
  assert.equal(await valorUnidad(pagina.locator("#unitSelect .sel-est")), E[3]);
  assert.deepEqual(await pagina.$$eval("[data-unidad-extra]", ss => ss.map(s => s.dataset.valor)), [E[4]]);
  await pagina.context().close();
});

test("los certificados de un solo establecimiento se imprimen como antes", async () => {
  const antiguo = registroEmitido({ id: "uno", folio: `CMF-${ANIO}-P01-GAB700-013`, unit: E[0] });
  const { pagina } = await abrir(ent, { conectado: false, registros: [antiguo] });
  await pagina.evaluate(() => viewRecord("uno"));
  const meta = await pagina.textContent("#certificatePreview .cert-meta");
  assert.match(meta, /Unidad \/ Establecimiento:\s*COLEGIO BICENTENARIO/);
  assert.doesNotMatch(meta, /Establecimientos del set/);
  await pagina.context().close();
});

/* ── El selector con buscador ─────────────────────────────────────────────── */

async function lista(pagina){
  return pagina.$$eval("#selUnidadPanel .lista > *", els => els.map(e =>
    e.classList.contains("grupo") ? `# ${e.textContent}` :
    e.classList.contains("sub") ? `## ${e.textContent}` : e.dataset.v || e.textContent.trim()));
}

test("la lista separa, en cada comuna, establecimientos y jardines infantiles", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.locator("#unitSelect .sel-est").click();
  const l = await lista(pagina);
  assert.equal(l[0], "# Unidad Central", "el principal también ofrece la Unidad Central");
  const laLigua = l.slice(l.indexOf("# La Ligua"), l.indexOf("# Papudo"));
  const jardines = laLigua.slice(laLigua.indexOf("## Jardines infantiles") + 1);
  assert.deepEqual(jardines, ["EL CARMEN CUNCUNITA — RBD 33530", "HUMBERTO BASULTO", "MANITOS DE ANGEL",
    "MANITOS DE COLORES", "PULMAHUE — RBD 33527", "SANTA TERESA — RBD 33526"]);
  assert.ok(laLigua.includes("LICEO PULMAHUE DE LA LIGUA — RBD 1121-5"));
  assert.ok(laLigua.indexOf("LICEO PULMAHUE DE LA LIGUA — RBD 1121-5") < laLigua.indexOf("## Jardines infantiles"),
    "el liceo va con los establecimientos");
  assert.equal(l.filter(x => x === "## Jardines infantiles").length, 4, "las cuatro comunas tienen jardines");
  await pagina.context().close();
});

test("el buscador encuentra por RBD, por nombre sin tildes, por comuna y por tipo", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  await pagina.locator("#unitSelect .sel-est").click();
  const buscar = async q => { await pagina.fill("#selUnidadPanel input", q); return (await lista(pagina)).filter(x => !x.startsWith("#")); };

  assert.deepEqual(await buscar("1180"), [E[2]], "RBD sin dígito");
  assert.deepEqual(await buscar("11800"), [E[2]], "RBD sin guion");
  assert.deepEqual(await buscar("vina"), [E[5]], "sin tilde encuentra LA VIÑA");
  assert.deepEqual(await buscar("papudo jardines"), ["BARQUITO DE PAPEL", "RAYITO DE SOL"]);
  assert.equal((await buscar("petorca liceo")).length, 2);
  assert.deepEqual(await buscar("no existe"), ["Ningún establecimiento coincide con la búsqueda."]);
  await pagina.context().close();
});

test("con el teclado: flechas y Enter eligen, Escape cierra sin cambiar", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  const boton = pagina.locator("#unitSelect .sel-est");
  await boton.click();
  await pagina.keyboard.type("G-4");
  await pagina.keyboard.press("ArrowDown");
  await pagina.keyboard.press("Enter");
  assert.equal(await valorUnidad(boton), E[3], "la segunda coincidencia: G-47");
  assert.equal(await pagina.evaluate(() => state.unit), E[3]);
  assert.equal(await pagina.locator("#selUnidadPanel").count(), 0, "se cierra al elegir");

  await pagina.locator("#unitSelect .sel-est").click();
  await pagina.keyboard.type("1180");
  await pagina.keyboard.press("Escape");
  assert.equal(await pagina.locator("#selUnidadPanel").count(), 0);
  assert.equal(await pagina.evaluate(() => state.unit), E[3], "Escape no cambia lo elegido");
  await pagina.context().close();
});
