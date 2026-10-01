/* Emitir: el folio lo asigna el registro central del Servicio y nada más. Sin
   conexión no se emite, y no hay numeración local ni camino alternativo. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { ANIO, entorno, abrir, llenarFormulario, emitir, registrosLocales,
        cerrarVistaPrevia } = require("./apoyo");

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

test("sin dirección configurada no se emite, y lo advierte antes", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina, dialogos } = await abrir(ent, { conectado: false });
  assert.ok(await pagina.isVisible("#avisoLocal"), "el aviso de sin registro central debe verse");

  await llenarFormulario(pagina);
  await emitir(pagina);

  assert.match(dialogos.ultimo().texto, /no está conectado al registro central/);
  assert.deepEqual((await registrosLocales(pagina)).filter(r => r.status !== "draft"), []);
  assert.equal(await pagina.textContent("#statusBadge"), "Borrador");
  assert.ok(await pagina.isHidden("#previewModal"));
  assert.deepEqual(await ent.registro.peticiones(), [], "sin dirección no hay llamada");
  await pagina.context().close();
});

test("sin dirección se puede guardar el borrador y la vista previa sale BORRADOR", async () => {
  const { pagina, dialogos } = await abrir(ent, { conectado: false });
  await llenarFormulario(pagina);
  await pagina.click("#saveDraftBtn");
  assert.equal(dialogos.ultimo().texto, "Borrador guardado.");
  const [borrador] = await registrosLocales(pagina);
  assert.equal(borrador.status, "draft");
  assert.equal(borrador.folio, null);

  await pagina.click("#previewBtn");
  const cert = pagina.locator("#certificatePreview");
  assert.equal(await cert.locator(".cert-watermark").textContent(), "BORRADOR");
  assert.match(await cert.textContent(), /BORRADOR \/ SIN FOLIO/);
  assert.match(await pagina.textContent("#previewWarning"), /ya puede emitirlo/);
  await pagina.context().close();
});

test("un formulario incompleto no se emite ni llama al Servicio", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina, dialogos } = await abrir(ent);
  await ent.registro.control({ reiniciar: true });     // descarta el listar de la carga
  await pagina.selectOption("#natureSelect", "remuneraciones");
  await emitir(pagina);
  const texto = dialogos.ultimo().texto;
  assert.match(texto, /No es posible emitir/);
  assert.match(texto, /programa presupuestario/);
  assert.match(texto, /Debe aceptar la declaración/);
  assert.deepEqual(await ent.registro.peticiones("emitir"), []);
  await pagina.context().close();
});

test("con conexión el folio lo pone el Servicio, y la serie arranca en 010", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina, errores } = await abrir(ent);
  await llenarFormulario(pagina);
  await emitir(pagina);

  const folio = `CMF-${ANIO}-P01-GAB700-010`;
  const [rec] = await registrosLocales(pagina);
  assert.equal(rec.status, "issued");
  assert.equal(rec.folio, folio);
  assert.equal(rec.origen, "central");

  const [fila] = await ent.registro.filas();
  assert.equal(fila.Folio, folio);
  assert.equal(fila.IdEmision, rec.id, "el idEmision es el id del registro");
  assert.equal(fila.CodigoMinistro, "GAB700");
  assert.equal(JSON.parse(fila.Datos).reference, "Set de prueba");

  // El definitivo se imprime limpio, sin marca de agua ni aviso.
  assert.ok(await pagina.isVisible("#previewModal"));
  assert.equal(await pagina.locator("#certificatePreview .cert-watermark").count(), 0);
  assert.ok(await pagina.isHidden("#previewWarning"));
  assert.match(await pagina.textContent("#certificatePreview"), new RegExp(folio));
  assert.equal(await pagina.textContent("#statusBadge"), "Emitido");
  assert.deepEqual(errores, []);
  await pagina.context().close();
});

test("la serie corre por Ministro de Fe y año, no por programa", async () => {
  await ent.registro.control({ reiniciar: true });
  const folios = [];
  for(const [ministro, programa, financiamiento] of [
    ["GAB700", "Programa 01", "RESTO"],
    ["GAB700", "Programa 02", "SUBV. GENERAL"],
    ["SAF103", "Programa 01", "RESTO"]
  ]){
    const { pagina } = await abrir(ent);
    await llenarFormulario(pagina, { ministro, programa, financiamiento });
    await emitir(pagina);
    folios.push((await registrosLocales(pagina))[0].folio);
    await pagina.context().close();
  }
  assert.deepEqual(folios, [
    `CMF-${ANIO}-P01-GAB700-010`,
    `CMF-${ANIO}-P02-GAB700-011`,
    `CMF-${ANIO}-P01-SAF103-010`
  ]);
});

test("el número sigue al último del Servicio, no al de este equipo", async () => {
  await ent.registro.control({ reiniciar: true, filas: [
    { Folio: `CMF-${ANIO}-P01-GAB700-014` }, { Folio: `CMF-${ANIO}-P02-GAB700-015` }
  ]});
  const { pagina } = await abrir(ent);
  await llenarFormulario(pagina);
  await emitir(pagina);
  assert.equal((await registrosLocales(pagina))[0].folio, `CMF-${ANIO}-P01-GAB700-016`);
  await cerrarVistaPrevia(pagina);
  assert.equal(await pagina.textContent("#historyCurrentFolio"), `CMF-${ANIO}-P01-GAB700-016`);
  await pagina.context().close();
});

test("si el Servicio está caído no se emite y el formulario queda intacto", async () => {
  await ent.registro.control({ reiniciar: true, fallas: { emitir: { modo: "caido", veces: 2 } } });
  const { pagina, dialogos } = await abrir(ent);
  await llenarFormulario(pagina, { referencia: "No se pierde" });
  await emitir(pagina);

  assert.match(dialogos.ultimo().texto, /No es posible emitir/);
  assert.match(dialogos.ultimo().texto, /500/);
  assert.deepEqual(await registrosLocales(pagina), []);
  assert.equal(await pagina.inputValue("#referenceInput"), "No se pierde");
  assert.ok(await pagina.isChecked("#declarationCheck"));
  assert.equal(await pagina.textContent("#statusBadge"), "Borrador");
  assert.deepEqual(await ent.registro.filas(), []);
  await pagina.context().close();
});

test("si el Servicio responde sin folio no se emite", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina, dialogos } = await abrir(ent);
  await pagina.route(ent.registro.url, async ruta => {
    const cuerpo = JSON.parse(ruta.request().postData() || "{}");
    if(cuerpo.accion !== "emitir") return ruta.continue();
    await ruta.fulfill({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ ok: true }) });
  });
  await llenarFormulario(pagina);
  await emitir(pagina);
  assert.match(dialogos.ultimo().texto, /no devolvió un folio/);
  assert.deepEqual(await registrosLocales(pagina), []);
  await pagina.context().close();
});

test("volver a pulsar Emitir sobre uno ya emitido no pide otro folio", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina } = await abrir(ent);
  await llenarFormulario(pagina);
  await emitir(pagina);
  await cerrarVistaPrevia(pagina);
  await emitir(pagina);

  const locales = await registrosLocales(pagina);
  assert.equal(locales.length, 1);
  assert.equal(locales[0].folio, `CMF-${ANIO}-P01-GAB700-010`);
  assert.equal((await ent.registro.peticiones("emitir")).length, 1);
  assert.equal((await ent.registro.filas()).length, 1);
  await pagina.context().close();
});
