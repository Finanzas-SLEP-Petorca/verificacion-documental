/* Un certificado emitido no se edita ni se elimina: se anula, con motivo, y el folio
   sigue consumido. Anular exige lo mismo que emitir: sin el Servicio no se anula. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { ANIO, entorno, abrir, llenarFormulario, emitir, registrosLocales, irAlRegistro,
        cerrarVistaPrevia, registroEmitido } = require("./apoyo");

const FOLIO = `CMF-${ANIO}-P01-GAB700-010`;
const MOTIVO = "Se imputó al programa equivocado";

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

/* Emite un certificado de verdad contra el registro simulado y deja la página en el
   registro de certificados. */
async function conUnoEmitido(opciones){
  await ent.registro.control({ reiniciar: true });
  const abierta = await abrir(ent, opciones);
  await llenarFormulario(abierta.pagina);
  await emitir(abierta.pagina);
  await cerrarVistaPrevia(abierta.pagina);
  return abierta;
}

async function anular(pagina, dialogos, id, ...respuestas){
  dialogos.responder(...respuestas);
  await pagina.evaluate(id => window.anularRecord(id), id);
}

test("anular: el Servicio lo registra, Datos no se toca y el folio sigue ocupado", async () => {
  const { pagina, dialogos } = await conUnoEmitido();
  const [rec] = await registrosLocales(pagina);
  const datosAntes = (await ent.registro.filas())[0].Datos;

  // motivo, confirmar, no duplicar todavía
  await anular(pagina, dialogos, rec.id, MOTIVO, true, false);

  const [fila] = await ent.registro.filas();
  assert.equal(fila.Estado, "Anulado");
  assert.equal(fila.MotivoAnulacion, MOTIVO);
  assert.equal(fila.Datos, datosAntes, "Datos es lo certificado: no se reescribe");
  assert.equal(fila.Folio, FOLIO);

  const [local] = await registrosLocales(pagina);
  assert.equal(local.status, "cancelled");
  assert.equal(local.cancelReason, MOTIVO);
  assert.equal(local.folio, FOLIO, "el folio sigue en el certificado anulado");

  await pagina.evaluate(id => window.viewRecord(id), rec.id);
  assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "ANULADO");
  assert.match(await pagina.textContent("#certificatePreview"), /queda\s+consumido y no se reasigna/);
  assert.match(await pagina.textContent("#certificatePreview"), new RegExp(MOTIVO));
  await pagina.context().close();
});

test("un motivo de menos de 10 caracteres no anula", async () => {
  const { pagina, dialogos } = await conUnoEmitido();
  const [rec] = await registrosLocales(pagina);
  await anular(pagina, dialogos, rec.id, "error");
  assert.match(dialogos.ultimo().texto, /al menos 10 caracteres/);
  assert.equal((await registrosLocales(pagina))[0].status, "issued");
  assert.deepEqual(await ent.registro.peticiones("anular"), []);
  await pagina.context().close();
});

test("sin conexión no se anula", async () => {
  const local = registroEmitido({ id: "sin-red", folio: FOLIO });
  const { pagina, dialogos } = await abrir(ent, { conectado: false, registros: [local] });
  await anular(pagina, dialogos, local.id, MOTIVO, true);
  assert.match(dialogos.ultimo().texto, /No es posible anular/);
  assert.equal((await registrosLocales(pagina))[0].status, "issued");
  await pagina.context().close();
});

test("si el Servicio falla al anular, tampoco se anula en el equipo", async () => {
  const { pagina, dialogos } = await conUnoEmitido();
  const [rec] = await registrosLocales(pagina);
  await ent.registro.control({ fallas: { anular: { modo: "caido", veces: 2 } } });
  await anular(pagina, dialogos, rec.id, MOTIVO, true);
  assert.match(dialogos.ultimo().texto, /NO se anuló/);
  assert.equal((await registrosLocales(pagina))[0].status, "issued");
  assert.equal((await ent.registro.filas())[0].Estado, "Emitido");
  await pagina.context().close();
});

test("emitir → anular → duplicar → emitir: el reemplazo toma el folio siguiente", async () => {
  const { pagina, dialogos } = await conUnoEmitido();
  const [rec] = await registrosLocales(pagina);
  await anular(pagina, dialogos, rec.id, MOTIVO, true, true);   // y duplicar

  assert.equal(await pagina.textContent("#statusBadge"), "Borrador");
  assert.equal(await pagina.inputValue("#referenceInput"), "Set de prueba",
    "los antecedentes cargados se conservan");
  assert.ok(!(await pagina.isChecked("#declarationCheck")), "la declaración se vuelve a aceptar");
  await pagina.check("#declarationCheck");
  await emitir(pagina);

  const locales = await registrosLocales(pagina);
  assert.equal(locales.length, 2);
  const nuevo = locales.find(r => r.id !== rec.id);
  assert.equal(nuevo.folio, `CMF-${ANIO}-P01-GAB700-011`);
  assert.equal(locales.find(r => r.id === rec.id).status, "cancelled");
  await pagina.context().close();
});

test("tras anular, pulsar Emitir no revive el certificado anulado", async () => {
  const { pagina, dialogos } = await conUnoEmitido();
  const [rec] = await registrosLocales(pagina);
  await anular(pagina, dialogos, rec.id, MOTIVO, true, false);  // no duplica
  assert.equal(await pagina.textContent("#statusBadge"), "Anulado");

  await emitir(pagina);                       // el formulario sigue siendo el anulado
  const local = (await registrosLocales(pagina)).find(r => r.id === rec.id);
  assert.equal(local.status, "cancelled", "un anulado no vuelve a quedar emitido");
  assert.equal(local.cancelReason, MOTIVO);
  assert.match(dialogos.ultimo().texto, /anulado/i);
  await pagina.context().close();
});

test("tras emitir, Guardar borrador no convierte el certificado en borrador", async () => {
  const { pagina, dialogos } = await conUnoEmitido();
  const [rec] = await registrosLocales(pagina);
  await pagina.click("#saveDraftBtn");

  const local = (await registrosLocales(pagina)).find(r => r.id === rec.id);
  assert.equal(local.status, "issued", "un emitido no se edita");
  assert.equal(local.folio, FOLIO);
  assert.doesNotMatch(dialogos.ultimo().texto, /^Borrador guardado/);

  await irAlRegistro(pagina);
  const fila = pagina.locator("#recordsBody tr", { hasText: FOLIO });
  assert.equal(await fila.locator("button", { hasText: "Eliminar" }).count(), 0);
  assert.equal(await fila.locator("button", { hasText: "Editar" }).count(), 0);
  await pagina.context().close();
});

test("sólo un borrador se puede eliminar; un emitido o anulado, nunca", async () => {
  const emitido = registroEmitido({ id: "e1", folio: FOLIO });
  const anulado = registroEmitido({ id: "a1", folio: `CMF-${ANIO}-P01-GAB700-011`,
    status: "cancelled", cancelReason: MOTIVO, cancelledAt: new Date().toISOString() });
  const borrador = registroEmitido({ id: "b1", folio: null, status: "draft", issuedAt: null });
  await ent.registro.control({ reiniciar: true });
  const { pagina } = await abrir(ent, { registros: [emitido, anulado, borrador] });
  await irAlRegistro(pagina);

  const eliminar = await pagina.locator("#recordsBody tr")
    .filter({ has: pagina.locator("button", { hasText: "Eliminar" }) }).allTextContents();
  assert.equal(eliminar.length, 1);
  assert.match(eliminar[0], /Borrador/);

  // Aunque se llame a mano, no borra lo emitido ni lo anulado.
  for(const id of ["e1", "a1"]) await pagina.evaluate(id => window.deleteRecord(id), id);
  const ids = (await registrosLocales(pagina)).map(r => r.id).sort();
  assert.deepEqual(ids, ["a1", "b1", "e1"]);

  await pagina.evaluate(() => window.deleteRecord("b1"));
  assert.deepEqual((await registrosLocales(pagina)).map(r => r.id).sort(), ["a1", "e1"]);
  await pagina.context().close();
});
