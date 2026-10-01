/* Registro de certificados → Verificar correlativos: lo que un Ministro de Fe puede
   revisar solo, sin entrar a Power Automate ni a SharePoint. */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { ANIO, entorno, abrir, irAlRegistro, registroEmitido } = require("./apoyo");

const F = n => `CMF-${ANIO}-P01-GAB700-${String(n).padStart(3, "0")}`;

let ent;
before(async () => { ent = await entorno(); });
after(async () => { await ent.cerrar(); });

/* Corre la verificación y devuelve cada bloque como { estado, titulo, detalle }. */
async function verificar({ filas = [], registros = null, fallas = null, conectado = true } = {}){
  await ent.registro.control({ reiniciar: true, filas });
  const { pagina } = await abrir(ent, { registros, conectado });
  if(fallas) await ent.registro.control({ fallas });
  await pagina.evaluate(() => verificarRegistro());
  const bloques = await pagina.$$eval("#verificacionCuerpo .chk", cs => cs.map(c => ({
    estado: c.classList.contains("ok") ? "ok" : c.classList.contains("aviso") ? "aviso" : "mal",
    titulo: c.querySelector("b").textContent,
    detalle: c.querySelector(".detalle").textContent
  })));
  await pagina.context().close();
  return bloques;
}
const buscar = (bloques, re) => bloques.find(b => re.test(b.titulo));

test("sin conexión no hay nada que verificar, y no dice que el navegador numera", async () => {
  const [bloque] = await verificar({ conectado: false });
  assert.equal(bloque.estado, "mal");
  assert.match(bloque.titulo, /no está conectado/);
  assert.doesNotMatch(bloque.detalle, /numera este navegador/,
    "desde el 29-09-2026 el navegador no numera: sin conexión no se emite");
  assert.match(bloque.detalle, /se puede emitir: el folio lo asigna el Servicio/);
});

test("todo en orden", async () => {
  const mio = registroEmitido({ id: "m1", folio: F(11) });
  const bloques = await verificar({
    filas: [{ Folio: F(10) }, { Folio: F(11), IdEmision: "m1" }, { Folio: F(12), Estado: "Anulado" }],
    registros: [mio]
  });
  assert.deepEqual(bloques.filter(b => b.estado !== "ok"), []);
  assert.match(buscar(bloques, /responde/).detalle, /devolvió 3 certificado/);
  assert.match(buscar(bloques, /Ningún folio repetido/).detalle, /Los 3 folios/);
  assert.match(buscar(bloques, /desde este equipo está en el Servicio/).detalle, /Los 1 certificado/);
  assert.match(buscar(bloques, /Resumen/).detalle, /2 vigente\(s\) y 1 anulado\(s\)/);
});

test("un folio repetido se denuncia", async () => {
  const bloques = await verificar({ filas: [
    { Folio: F(10), ClaveCorrelativo: "a" }, { Folio: F(10), ClaveCorrelativo: "b" }
  ]});
  const b = buscar(bloques, /repetidos/);
  assert.equal(b.estado, "mal");
  assert.match(b.detalle, new RegExp(`${F(10)} \\(2 veces\\)`));
});

test("un número saltado se avisa, contando desde el 010", async () => {
  const bloques = await verificar({ filas: [{ Folio: F(10) }, { Folio: F(11) }, { Folio: F(13) }] });
  const b = buscar(bloques, /saltados/);
  assert.equal(b.estado, "aviso");
  assert.match(b.detalle, /GAB700: falta el 12/);
  assert.doesNotMatch(b.detalle, /falta(n)? el 1,/, "del 001 al 009 no faltan: los consumió el pilotaje");
});

test("lo emitido aquí que el Servicio no tiene se denuncia", async () => {
  const bloques = await verificar({
    filas: [{ Folio: F(10) }],
    registros: [registroEmitido({ id: "x", folio: F(10) }), registroEmitido({ id: "y", folio: F(11) })]
  });
  const b = buscar(bloques, /que el Servicio no tiene/);
  assert.equal(b.estado, "mal");
  assert.match(b.detalle, new RegExp(F(11)));
  assert.doesNotMatch(b.detalle, new RegExp(F(10)));
});

test("una fila sin folio en el Servicio se avisa", async () => {
  const bloques = await verificar({ filas: [{ Folio: F(10) }, { Folio: "", Anio: ANIO, ClaveCorrelativo: "z" }] });
  assert.equal(buscar(bloques, /sin folio/).estado, "aviso");
});

test("si el Servicio no responde, lo dice y no sigue", async () => {
  const bloques = await verificar({ fallas: { listar: { modo: "caido", veces: 2 } } });
  assert.equal(bloques.length, 1);
  assert.equal(bloques[0].estado, "mal");
  assert.match(bloques[0].titulo, /no responde/);
  assert.match(bloques[0].detalle, /la aplicación no emite/);
});
