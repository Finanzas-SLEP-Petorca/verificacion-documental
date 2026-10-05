/* El estado de un certificado lo manda el Servicio, no el navegador. Si el registro
   central lo tiene anulado, se imprime anulado aunque el equipo lo tenga vigente; al
   revés no, porque una lectura vieja no resucita un certificado anulado. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { ANIO, entorno, abrir, irAlRegistro, registroEmitido, registrosLocales } = require("./apoyo");

const FOLIO = `CMF-${ANIO}-P01-GAB700-010`;
const AJENO = `CMF-${ANIO}-P02-SAF103-012`;

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

function filaDe(rec, extra = {}){
  return Object.assign({
    Folio: rec.folio, IdEmision: rec.id, CodigoMinistro: rec.ministerCode,
    Ministro: rec.ministerName, Naturaleza: rec.natureLabel, Unidad: rec.unit,
    Referencia: rec.reference,
    // Datos se escribe al emitir: sin folio y vigente, y no se vuelve a tocar.
    Datos: Object.assign({}, rec, { folio: null, status: "issued" })
  }, extra);
}

function filaDelRegistro(pagina, folio){
  return pagina.locator("#recordsBody tr", { hasText: folio });
}

test("vigente aquí y anulado en el Servicio: se muestra e imprime anulado", async () => {
  const local = registroEmitido({ id: "loc-1", folio: FOLIO });
  await ent.registro.control({ reiniciar: true, filas: [
    filaDe(local, { Estado: "Anulado", MotivoAnulacion: "Anulado desde el otro equipo" })
  ]});
  const { pagina } = await abrir(ent, { registros: [local] });
  await irAlRegistro(pagina);

  const fila = filaDelRegistro(pagina, FOLIO);
  assert.match(await fila.textContent(), /Anulado/);
  assert.equal(await fila.locator("button", { hasText: "Anular" }).count(), 0,
    "no se ofrece anular lo que el Servicio ya anuló");

  await fila.locator("button", { hasText: "Ver" }).click();
  assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "ANULADO");
  assert.match(await pagina.textContent("#certificatePreview"), /Anulado desde el otro equipo/);
  assert.match(await pagina.textContent("#previewWarning"), /Certificado anulado/);

  // El historial del Ministro de Fe dice lo mismo.
  await pagina.click("#closePreviewBtn");
  await pagina.click("#tabNew");
  assert.match(await pagina.textContent("#historyBody"), /anulado/);
  await pagina.context().close();
});

test("anulado aquí y vigente en el Servicio: una lectura vieja no lo resucita", async () => {
  const local = registroEmitido({ id: "loc-2", folio: FOLIO, status: "cancelled",
    cancelReason: "Error en la unidad", cancelledAt: new Date().toISOString() });
  await ent.registro.control({ reiniciar: true, filas: [filaDe(local)] });
  const { pagina } = await abrir(ent, { registros: [local] });
  await irAlRegistro(pagina);

  assert.match(await filaDelRegistro(pagina, FOLIO).textContent(), /Anulado/);
  await filaDelRegistro(pagina, FOLIO).locator("button", { hasText: "Ver" }).click();
  assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "ANULADO");
  assert.equal((await registrosLocales(pagina))[0].status, "cancelled");
  await pagina.context().close();
});

test("un certificado de otro equipo se pide completo al Servicio, y una sola vez", async () => {
  const ajeno = registroEmitido({ id: "ajeno-1", folio: AJENO, ministro: "SAF103",
    ministerName: "Daniela González Campos", reference: "Set del otro equipo" });
  await ent.registro.control({ reiniciar: true, filas: [filaDe(ajeno)] });
  const { pagina } = await abrir(ent);
  await irAlRegistro(pagina);

  const fila = filaDelRegistro(pagina, AJENO);
  assert.match(await fila.textContent(), /otro equipo/);
  assert.deepEqual(await fila.locator("button").allTextContents(), ["Ver"],
    "lo ajeno se ve e imprime, pero no se edita, duplica ni anula desde aquí");
  assert.equal((await ent.registro.peticiones("obtener")).length, 0,
    "pintar la tabla no pide ningún certificado");

  await fila.locator("button", { hasText: "Ver" }).click();
  await pagina.waitForSelector("#previewModal:not(.hidden)");
  assert.match(await pagina.textContent("#certificatePreview"), /Set del otro equipo/);
  assert.match(await pagina.textContent("#certificatePreview"), new RegExp(AJENO));
  assert.equal(await pagina.locator("#certificatePreview .cert-watermark").count(), 0);
  await pagina.click("#closePreviewBtn");

  await fila.locator("button", { hasText: "Ver" }).click();
  await pagina.waitForSelector("#previewModal:not(.hidden)");
  assert.equal((await ent.registro.peticiones("obtener")).length, 1, "la segunda vez sale de memoria");
  await pagina.click("#closePreviewBtn");

  // Si cambia de estado en el Servicio, sí se vuelve a pedir.
  await ent.registro.control({ anular: [{ idEmision: "ajeno-1", motivo: "Anulado por su emisora" }] });
  await pagina.click("#rcSyncBtn");
  await pagina.waitForFunction(() => /al día/.test(document.getElementById("rcEstado").textContent));
  await fila.locator("button", { hasText: "Ver" }).click();
  await pagina.waitForSelector("#previewModal:not(.hidden)");
  assert.equal((await ent.registro.peticiones("obtener")).length, 2);
  assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "ANULADO");
  assert.deepEqual(await registrosLocales(pagina), [], "lo ajeno no se guarda en este equipo");
  await pagina.context().close();
});

test("aunque el endpoint devuelva Datos crudo, el anulado ajeno se imprime anulado y con folio", async () => {
  const ajeno = registroEmitido({ id: "ajeno-2", folio: AJENO, ministro: "SAF103" });
  await ent.registro.control({ reiniciar: true,
    filas: [filaDe(ajeno, { Estado: "Anulado", MotivoAnulacion: "Mal imputado" })],
    fallas: { obtener: { modo: "crudo" } } });
  const { pagina } = await abrir(ent);
  await irAlRegistro(pagina);

  await filaDelRegistro(pagina, AJENO).locator("button", { hasText: "Ver" }).click();
  await pagina.waitForSelector("#previewModal:not(.hidden)");
  const texto = await pagina.textContent("#certificatePreview");
  assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "ANULADO");
  assert.match(texto, new RegExp(AJENO));
  assert.match(texto, /Mal imputado/);
  assert.doesNotMatch(texto, /SIN FOLIO/);
  await pagina.context().close();
});

test("el filtro por ministro incluye lo emitido por esa persona en otros equipos", async () => {
  const ajeno = registroEmitido({ id: "ajeno-3", folio: `CMF-${ANIO}-P01-GAB700-020` });
  await ent.registro.control({ reiniciar: true, filas: [filaDe(ajeno)] });
  const { pagina } = await abrir(ent);
  await irAlRegistro(pagina);
  await pagina.selectOption("#recordMinisterFilter", "GAB700");
  assert.match(await pagina.textContent("#recordsBody"), /GAB700-020/);
  await pagina.selectOption("#recordMinisterFilter", "SAF103");
  assert.doesNotMatch(await pagina.textContent("#recordsBody"), /GAB700-020/);
  await pagina.context().close();
});

test("si el Servicio no responde, se sigue mostrando la última lectura", async () => {
  const ajeno = registroEmitido({ id: "ajeno-4", folio: AJENO, ministro: "SAF103" });
  await ent.registro.control({ reiniciar: true, filas: [filaDe(ajeno)] });
  const { pagina } = await abrir(ent);
  await irAlRegistro(pagina);
  await ent.registro.control({ fallas: { listar: { modo: "caido", veces: 2 } } });
  await pagina.click("#rcSyncBtn");
  await pagina.waitForFunction(() => /No fue posible/.test(document.getElementById("rcEstado").textContent));
  assert.match(await pagina.textContent("#rcEstado"), /última lectura/);
  assert.match(await pagina.textContent("#recordsBody"), new RegExp(AJENO));
  await pagina.context().close();
});

test("el registro muestra la fecha de emisión, en hora de Chile", async () => {
  const propio = registroEmitido({ id: "propio-1", folio: FOLIO, issuedAt: "2026-10-01T15:30:00.000Z" });
  const borrador = registroEmitido({ id: "borr-1", folio: null, status: "draft", issuedAt: null,
    reference: "Borrador sin emitir" });
  const ajeno = registroEmitido({ id: "ajeno-5", folio: AJENO, ministro: "SAF103" });
  // A las 02:00 UTC del 1 de octubre en Chile todavía es el 30 de septiembre.
  await ent.registro.control({ reiniciar: true,
    filas: [filaDe(ajeno, { FechaEmision: "2026-10-01T02:00:00Z" })] });
  const { pagina } = await abrir(ent, { registros: [propio, borrador] });
  await irAlRegistro(pagina);

  const encabezados = await pagina.locator("#recordsView thead th").allTextContents();
  assert.equal(encabezados[1], "Fecha de emisión");
  const fecha = async texto => (await filaDelRegistro(pagina, texto).locator("td").nth(1).textContent()).trim();
  assert.equal(await fecha(FOLIO), "01-10-2026");
  assert.equal(await fecha(AJENO), "30-09-2026");
  assert.equal(await fecha("Borrador"), "—", "un borrador no tiene fecha de emisión");
  await pagina.context().close();
});
