/* Cada ejecución del flujo cuesta: la página no consulta más de lo necesario. Es la
   tabla "Cuántas veces llama la aplicación" de docs/registro-central.md. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { CLAVES, entorno, abrir, irAlRegistro } = require("./apoyo");

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

const contar = async accion => (await ent.registro.peticiones(accion)).length;
const esperarLectura = pagina => pagina.waitForFunction(() =>
  !/Consultando/.test(document.getElementById("rcEstado").textContent));

test("abrir, recargar, entrar al registro, Actualizar", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina } = await abrir(ent, { reloj: true });
  await esperarLectura(pagina);
  assert.equal(await contar("listar"), 1, "abrir en una pestaña nueva: 1 listar");

  await pagina.reload();
  await esperarLectura(pagina);
  assert.equal(await contar("listar"), 1, "recargar: ninguna, sale de sessionStorage");

  await irAlRegistro(pagina);
  await pagina.click("#tabNew");
  await irAlRegistro(pagina);
  assert.equal(await contar("listar"), 1, "entrar y salir del registro dentro de 30 s: ninguna");

  await pagina.click("#tabNew");
  await pagina.clock.fastForward(31000);
  await irAlRegistro(pagina);
  assert.equal(await contar("listar"), 2, "pasados 30 s, entrar al registro: 1 listar");

  await pagina.click("#rcSyncBtn");
  await esperarLectura(pagina);
  assert.equal(await contar("listar"), 3, "Actualizar: 1 listar, siempre");
  await pagina.context().close();
});

test("Probar conexión hace un ping y nada más", async () => {
  await ent.registro.control({ reiniciar: true });
  const { pagina } = await abrir(ent);
  await irAlRegistro(pagina);
  const listarAntes = await contar("listar");
  await pagina.click("#rcTestBtn");
  await pagina.waitForFunction(() => /Conexión correcta/.test(document.getElementById("rcEstado").textContent));
  assert.equal(await contar("ping"), 1);
  assert.equal(await contar("listar"), listarAntes);
  await pagina.context().close();
});

test("al salir de la página se aborta lo que está en vuelo, sin un segundo POST", async () => {
  await ent.registro.control({ reiniciar: true, fallas: { listar: { modo: "lento", segundos: 2 } } });
  const { pagina } = await abrir(ent);
  for(let i = 0; i < 40 && !(await contar("listar")); i++) await new Promise(r => setTimeout(r, 50));
  await pagina.goto("about:blank");
  await new Promise(r => setTimeout(r, 2500));
  const listar = await ent.registro.peticiones("listar");
  assert.equal(listar.length, 1, "sin reintento como text/plain mientras la página se iba");
  await pagina.context().close();
});

test("Configurar exige https, salvo en el propio equipo", async () => {
  const { pagina, dialogos } = await abrir(ent, { conectado: false });
  await pagina.click("#tabRecords");
  dialogos.responder("http://registro.ejemplo.cl/flujo");
  await pagina.click("#rcConfigBtn");
  assert.match(dialogos.ultimo().texto, /debe empezar con https/);
  assert.equal(await pagina.evaluate(k => localStorage.getItem(k), CLAVES.endpoint), null);

  for(const [u, valida] of [["https://x.ejemplo.cl/a", true], ["http://localhost:9/", true],
                            ["http://127.0.0.1:9/", true], ["ftp://x/", false], ["javascript:alert(1)", false]])
    assert.equal(await pagina.evaluate(u => rcUrlValida(u), u), valida, u);
  await pagina.context().close();
});

test("cambiar la dirección olvida lo leído del registro anterior", async () => {
  await ent.registro.control({ reiniciar: true, filas: [{ Folio: "CMF-2026-P01-SAF103-010" }] });
  const { pagina, dialogos } = await abrir(ent);
  await irAlRegistro(pagina);
  assert.match(await pagina.textContent("#recordsBody"), /SAF103-010/);

  dialogos.responder("https://otro-registro.invalid/");
  await pagina.click("#rcConfigBtn");
  assert.doesNotMatch(await pagina.textContent("#recordsBody"), /SAF103-010/);
  const cache = await pagina.evaluate(k => sessionStorage.getItem(k), CLAVES.cache);
  assert.ok(!cache || !cache.includes("SAF103-010"));
  await pagina.context().close();
});
