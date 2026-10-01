/* Reintentar una emisión no gasta otro folio. El identificador de la emisión se fija
   antes de llamar, así que si la respuesta se pierde después de que el Servicio anotó
   la fila, el reintento —el automático del navegador o el de la persona que vuelve a
   pulsar Emitir— recibe el mismo número. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { ANIO, entorno, abrir, llenarFormulario, emitir, registrosLocales,
        cerrarVistaPrevia } = require("./apoyo");

const FOLIO = `CMF-${ANIO}-P01-GAB700-010`;

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

async function abrirLimpio(opciones){
  await ent.registro.control({ reiniciar: true });
  const abierta = await abrir(ent, opciones);
  await abierta.pagina.waitForFunction(() =>
    !/Consultando/.test(document.getElementById("rcEstado").textContent));
  return abierta;
}

test("respuesta perdida una vez: el reintento automático recibe el mismo folio", async () => {
  const { pagina } = await abrirLimpio();
  await ent.registro.control({ fallas: { emitir: { modo: "pierde-respuesta" } } });
  await llenarFormulario(pagina);
  await emitir(pagina);

  const [rec] = await registrosLocales(pagina);
  assert.equal(rec.folio, FOLIO);
  const llamadas = await ent.registro.peticiones("emitir");
  assert.equal(llamadas.length, 2, "la primera se perdió y el navegador reintentó");
  assert.equal(llamadas[0].idEmision, llamadas[1].idEmision);
  assert.match(llamadas[1].contentType, /text\/plain/);
  assert.equal((await ent.registro.filas()).length, 1, "una sola fila en el correlativo");
  await pagina.context().close();
});

test("respuesta perdida dos veces: volver a pulsar Emitir recibe el mismo folio", async () => {
  const { pagina, dialogos } = await abrirLimpio();
  await ent.registro.control({ fallas: { emitir: { modo: "pierde-respuesta", veces: 2 } } });
  await llenarFormulario(pagina);
  await emitir(pagina);

  assert.match(dialogos.ultimo().texto, /No es posible emitir/);
  assert.deepEqual(await registrosLocales(pagina), [], "no se dio por emitido");
  assert.equal((await ent.registro.filas()).length, 1, "pero el Servicio sí anotó la fila");

  await emitir(pagina);                      // la persona reintenta
  const [rec] = await registrosLocales(pagina);
  assert.equal(rec.folio, FOLIO);
  const filas = await ent.registro.filas();
  assert.equal(filas.length, 1, "el reintento no dejó una fila huérfana");
  assert.equal(filas[0].IdEmision, rec.id);
  assert.equal(new Set((await ent.registro.peticiones("emitir")).map(p => p.idEmision)).size, 1);
  await pagina.context().close();
});

test("si el Servicio no responde a tiempo no se emite, y el reintento no gasta otro folio", async () => {
  const { pagina, dialogos } = await abrirLimpio({ reloj: true });
  await ent.registro.control({ fallas: { emitir: { modo: "lento", segundos: 4 } } });
  await llenarFormulario(pagina);
  await pagina.click("#issueBtn");
  await pagina.waitForFunction(() => document.getElementById("issueBtn").textContent === "Emitiendo…");
  // Espera a que el Servicio reciba la petición antes de adelantar el reloj.
  for(let i = 0; i < 50 && !(await ent.registro.peticiones("emitir")).length; i++)
    await new Promise(r => setTimeout(r, 50));
  await pagina.clock.runFor(21000);          // más que RC_TIMEOUT_MS
  await pagina.waitForFunction(() => !document.getElementById("issueBtn").disabled);

  assert.match(dialogos.ultimo().texto, /no respondió a tiempo/);
  assert.deepEqual(await registrosLocales(pagina), []);
  assert.equal((await ent.registro.peticiones("emitir")).length, 1,
    "un tiempo agotado no se reintenta solo");

  await new Promise(r => setTimeout(r, 4500));   // el Servicio termina de anotar la fila
  await emitir(pagina);
  const [rec] = await registrosLocales(pagina);
  assert.equal(rec.folio, FOLIO);
  assert.equal((await ent.registro.filas()).length, 1);
  await pagina.context().close();
});

test("con el preflight CORS rechazado, emite por la solicitud simple sin gastar dos folios", async () => {
  /* Antes de abrir: el navegador guarda unos segundos el preflight aprobado del listar
     de la carga, y entonces la emisión ni siquiera lo pediría. */
  await ent.registro.control({ reiniciar: true, sinCors: true });
  const { pagina } = await abrir(ent);
  await pagina.waitForFunction(() =>
    !/Consultando/.test(document.getElementById("rcEstado").textContent));
  await llenarFormulario(pagina);
  await emitir(pagina);

  const [rec] = await registrosLocales(pagina);
  assert.equal(rec.folio, FOLIO);
  const llamadas = await ent.registro.peticiones("emitir");
  assert.equal(llamadas.length, 1, "el POST con JSON nunca pasó del preflight");
  assert.match(llamadas[0].contentType, /text\/plain/);
  assert.equal((await ent.registro.filas()).length, 1);
  await ent.registro.control({ sinCors: false });
  await pagina.context().close();
});

test("un certificado nuevo, en cambio, lleva otro identificador y otro folio", async () => {
  const { pagina } = await abrirLimpio();
  await llenarFormulario(pagina);
  await emitir(pagina);
  await cerrarVistaPrevia(pagina);
  const primero = (await registrosLocales(pagina))[0];

  // Duplicar abre un borrador nuevo, que se emite con su propio identificador.
  await pagina.evaluate(id => window.duplicateRecord(id), primero.id);
  await pagina.check("#declarationCheck");
  await emitir(pagina);

  const locales = await registrosLocales(pagina);
  assert.equal(locales.length, 2);
  assert.notEqual(locales[0].id, primero.id);
  assert.equal(locales[0].folio, `CMF-${ANIO}-P01-GAB700-011`);
  assert.equal((await ent.registro.filas()).length, 2);
  await pagina.context().close();
});
