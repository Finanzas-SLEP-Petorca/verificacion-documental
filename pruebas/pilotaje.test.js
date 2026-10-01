/* Los certificados del pilotaje —folio menor a 010, en cualquiera de los tres formatos
   que ha tenido la aplicación— no tienen validez, pero no se borran: son el único rastro
   de lo que se emitió entonces. Quedan marcados y se conservan. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { ANIO, CLAVES, entorno, abrir, irAlRegistro, registroEmitido, registrosLocales } = require("./apoyo");

/* Los tres formatos: el actual, el anterior sin programa y el primero, sin prefijo. */
const PILOTOS = [
  registroEmitido({ id: "p-actual",   folio: `CMF-${ANIO}-P01-GAB700-003` }),
  registroEmitido({ id: "p-anterior", folio: `CMF-${ANIO}-GAB700-005` }),
  registroEmitido({ id: "p-primero",  folio: `GAB700-${ANIO}-001` })
];

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

test("la aplicación lee los tres formatos de folio", async () => {
  const { pagina } = await abrir(ent, { conectado: false });
  const partes = await pagina.evaluate(fs => fs.map(f => partesFolio(f)), [
    `CMF-${ANIO}-P01-GAB700-003`, `CMF-${ANIO}-GAB700-005`, `GAB700-${ANIO}-001`,
    `CMF-${ANIO}-P02-SAF103-010`, "cualquier cosa"
  ]);
  assert.deepEqual(partes, [
    { prefijo: "CMF", anio: ANIO, programa: "P01", codigoMinistro: "GAB700", numero: 3 },
    { prefijo: "CMF", anio: ANIO, programa: null,  codigoMinistro: "GAB700", numero: 5 },
    { prefijo: "",    anio: ANIO, programa: null,  codigoMinistro: "GAB700", numero: 1 },
    { prefijo: "CMF", anio: ANIO, programa: "P02", codigoMinistro: "SAF103", numero: 10 },
    null
  ]);
  const pilotaje = await pagina.evaluate(fs => fs.map(f => esDePilotaje(f)), [
    `CMF-${ANIO}-P01-GAB700-009`, `CMF-${ANIO}-P01-GAB700-010`, `GAB700-${ANIO}-001`, null
  ]);
  assert.deepEqual(pilotaje, [true, false, true, false]);
  await pagina.context().close();
});

test("se etiquetan en el registro y en el historial, sin Editar ni Eliminar", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina } = await abrir(ent, { registros: PILOTOS });
  const historial = await pagina.textContent("#historyBody");
  for(const p of PILOTOS) assert.match(historial, new RegExp(p.folio));
  assert.equal(await pagina.locator("#historyBody .tag-pilotaje").count(), 3);

  await irAlRegistro(pagina);
  for(const p of PILOTOS){
    const fila = pagina.locator("#recordsBody tr", { hasText: p.folio });
    assert.equal(await fila.locator(".tag-pilotaje").count(), 1, p.folio);
    const botones = await fila.locator("button").allTextContents();
    assert.ok(!botones.includes("Eliminar"), `${p.folio} no se puede eliminar`);
    assert.ok(!botones.includes("Editar"), `${p.folio} no se puede editar`);
  }
  await pagina.context().close();
});

test("se imprimen con la marca PILOTAJE y la constancia, nunca como definitivos", async () => {
  const { pagina } = await abrir(ent, { conectado: false, registros: PILOTOS });
  for(const p of PILOTOS){
    await pagina.evaluate(id => window.viewRecord(id), p.id);
    assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "PILOTAJE", p.folio);
    assert.match(await pagina.textContent("#certificatePreview"), /ETAPA DE PILOTAJE/);
    assert.match(await pagina.textContent("#previewWarning"), /no adjuntar al set de pago/);
    await pagina.click("#closePreviewBtn");
  }
  assert.deepEqual(await pagina.evaluate(rs => rs.map(r => esDefinitivo(r)), PILOTOS),
                   [false, false, false]);
  await pagina.context().close();
});

test("no se borran: ni a mano, ni al recargar, ni al cambiar o quitar la dirección", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina, dialogos } = await abrir(ent, { registros: PILOTOS });

  for(const p of PILOTOS) await pagina.evaluate(id => window.deleteRecord(id), p.id);
  assert.equal((await registrosLocales(pagina)).length, 3, "deleteRecord no los toca");

  await pagina.reload();
  await irAlRegistro(pagina);
  await pagina.click("#rcSyncBtn");
  await pagina.waitForFunction(() => /al día/.test(document.getElementById("rcEstado").textContent));
  assert.equal((await registrosLocales(pagina)).length, 3, "sincronizar no los toca");

  dialogos.responder("");                    // quitar la dirección
  await pagina.click("#rcConfigBtn");
  assert.equal(await pagina.evaluate(k => localStorage.getItem(k), CLAVES.endpoint), "");
  assert.deepEqual((await registrosLocales(pagina)).map(r => r.folio).sort(),
                   PILOTOS.map(p => p.folio).sort());
  await pagina.context().close();
});

test("se anulan sólo en el equipo, sin llamar al Servicio, y se conservan anulados", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina, dialogos } = await abrir(ent, { conectado: false, registros: PILOTOS });
  // motivo, confirmar anulación, confirmar que es sólo local, no duplicar
  dialogos.responder("Certificado de prueba del pilotaje", true, true, false);
  await pagina.evaluate(() => window.anularRecord("p-primero"));

  const locales = await registrosLocales(pagina);
  assert.equal(locales.length, 3);
  const anulado = locales.find(r => r.id === "p-primero");
  assert.equal(anulado.status, "cancelled");
  assert.equal(anulado.folio, `GAB700-${ANIO}-001`);
  assert.ok(dialogos.vistos.some(d => /etapa de pilotaje/.test(d.texto)));
  assert.deepEqual(await ent.registro.peticiones("anular"), []);

  await pagina.evaluate(() => window.viewRecord("p-primero"));
  assert.equal(await pagina.textContent("#certificatePreview .cert-watermark"), "PILOTAJE");
  await pagina.context().close();
});

test("la verificación los lista aparte, nunca como faltantes ni como saltos", async () => {
  await ent.registro.control({ reiniciar: true, filas: [
    { Folio: `CMF-${ANIO}-P01-GAB700-010` }, { Folio: `CMF-${ANIO}-P01-GAB700-011` }
  ]});
  const { pagina } = await abrir(ent, { registros: PILOTOS });
  await irAlRegistro(pagina);
  await pagina.click("#rcVerificarBtn");
  await pagina.waitForFunction(() => /Resumen/.test(document.getElementById("verificacionCuerpo").textContent));

  const cuerpo = pagina.locator("#verificacionCuerpo");
  assert.equal(await cuerpo.locator(".chk.mal").count(), 0, await cuerpo.textContent());
  const texto = await cuerpo.textContent();
  assert.match(texto, /Certificados de la etapa de pilotaje/);
  for(const p of PILOTOS) assert.match(texto, new RegExp(p.folio));
  assert.match(texto, /no se borran/);
  assert.match(texto, /Las series corren correlativas, sin saltos/);
  assert.doesNotMatch(texto, /que el Servicio no tiene/);
  await pagina.context().close();
});
