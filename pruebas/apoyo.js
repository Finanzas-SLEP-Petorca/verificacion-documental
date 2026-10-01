/* Lo que comparten las pruebas de la página: un servidor estático con el sitio, el
   registro simulado en Python, un navegador y unos pocos atajos para llenar el
   formulario y responder los diálogos.

   Cada archivo de prueba levanta lo suyo y lo apaga al terminar, de modo que pueden
   correr en paralelo sin pisarse. */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const readline = require("node:readline");

const RAIZ = path.resolve(__dirname, "..");
const ANIO = new Date().getFullYear();

/* Playwright se toma de pruebas/node_modules si se instaló con npm, y si no, de la
   instalación global (así viene en las sesiones de Claude Code en la nube). */
function cargarPlaywright(){
  try{ return require("playwright"); }
  catch(_){
    const { execSync } = require("node:child_process");
    const global = execSync("npm root -g").toString().trim();
    return require(path.join(global, "playwright"));
  }
}
const { chromium } = cargarPlaywright();

/* ── servidores ──────────────────────────────────────────────────────────── */

const TIPOS = { ".html":"text/html; charset=utf-8", ".png":"image/png", ".pdf":"application/pdf",
                ".js":"text/javascript", ".css":"text/css", ".md":"text/markdown" };

function servirSitio(){
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if(ruta.endsWith("/")) ruta += "index.html";
      const archivo = path.join(RAIZ, path.normalize(ruta));
      if(!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()){
        res.writeHead(404); return res.end();
      }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve({
      url: `http://127.0.0.1:${srv.address().port}/`,
      cerrar: () => new Promise(r => srv.close(r))
    }));
  });
}

function servirRegistro(){
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [path.join(__dirname, "registro_simulado.py"), "--puerto", "0"],
                       { stdio: ["ignore", "pipe", "inherit"] });
    proc.on("error", reject);
    readline.createInterface({ input: proc.stdout }).once("line", linea => {
      /* La página exige https, salvo para localhost y 127.0.0.1. */
      const url = linea.trim(), base = url;
      resolve({
        url,
        async control(orden){
          const r = await fetch(base + "__control", { method:"POST", body: JSON.stringify(orden) });
          if(!r.ok) throw new Error("control: " + r.status);
        },
        async estado(){ return (await fetch(base + "__estado")).json(); },
        async peticiones(accion){
          const { peticiones } = await this.estado();
          return accion ? peticiones.filter(p => p.accion === accion) : peticiones;
        },
        async filas(){ return (await this.estado()).filas; },
        cerrar(){ proc.kill(); }
      });
    });
  });
}

/* Todo lo que una prueba necesita, levantado y listo. */
async function entorno(){
  const [sitio, registro] = await Promise.all([servirSitio(), servirRegistro()]);
  const navegador = await chromium.launch();
  return {
    sitio, registro, navegador,
    async cerrar(){
      await navegador.close();
      registro.cerrar();
      await sitio.cerrar();
    }
  };
}

/* ── página ─────────────────────────────────────────────────────────────── */

const CLAVES = {
  registros: "slep_ministro_fe_records_v1",
  endpoint:  "slep_ministro_fe_endpoint_v1",
  cache:     "slep_ministro_fe_cache_v1"
};

/* Abre la aplicación en un contexto limpio. `conectado` deja guardada la dirección
   del registro simulado, como si el Ministro de Fe la hubiera pegado en Configurar;
   `registros` siembra el localStorage antes de que cargue la página. */
async function abrir(ent, { conectado = true, registros = null, reloj = false } = {}){
  const contexto = await ent.navegador.newContext();
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", e => errores.push(e.message));
  if(reloj) await pagina.clock.install();

  /* El sembrado va sólo en la primera carga: si se repitiera en cada una, recargar
     restauraría el localStorage y escondería justo lo que se quiere ver. */
  await pagina.addInitScript(({ claves, endpoint, registros }) => {
    if(sessionStorage.getItem("__sembrado")) return;
    sessionStorage.setItem("__sembrado", "1");
    if(endpoint) localStorage.setItem(claves.endpoint, endpoint);
    if(registros) localStorage.setItem(claves.registros, JSON.stringify(registros));
  }, { claves: CLAVES, endpoint: conectado ? ent.registro.url : null, registros });

  const dialogos = new Dialogos(pagina);
  await pagina.goto(ent.sitio.url);
  return { pagina, contexto, dialogos, errores };
}

/* Los alert, confirm y prompt de la página. Las respuestas se encolan antes de la
   acción que los dispara; lo que no tenga respuesta encolada se acepta (confirm) o se
   cancela (prompt). Todos los textos quedan guardados para revisarlos después. */
class Dialogos {
  constructor(pagina){
    this.vistos = [];
    this.respuestas = [];
    pagina.on("dialog", async d => {
      this.vistos.push({ tipo: d.type(), texto: d.message() });
      const r = this.respuestas.shift();
      if(d.type() === "alert") return d.accept();
      if(r === false) return d.dismiss();
      if(d.type() === "prompt") return typeof r === "string" ? d.accept(r) : d.dismiss();
      return d.accept();
    });
  }
  responder(...rs){ this.respuestas.push(...rs); }
  ultimo(){ return this.vistos[this.vistos.length - 1]; }
  alertas(){ return this.vistos.filter(d => d.tipo === "alert").map(d => d.texto); }
}

/* Llena un certificado de Remuneraciones completo y válido: cada antecedente
   verificado, con sus campos. Es la naturaleza más corta que no lleva tabla de
   detalle. */
async function llenarFormulario(pagina, { ministro = "GAB700", programa = "Programa 01",
                                         financiamiento = "RESTO", referencia = "Set de prueba" } = {}){
  await pagina.selectOption("#ministerNameSelect", ministro);
  await pagina.selectOption("#natureSelect", "remuneraciones");
  await pagina.selectOption("#programaSelect", programa);
  await pagina.selectOption("#subvencionSelect", financiamiento);
  const unidad = await pagina.$eval("#unitSelect", s =>
    [...s.options].find(o => o.value && !o.disabled).value);
  await pagina.selectOption("#unitSelect", unidad);
  await pagina.fill("#referenceInput", referencia);
  await pagina.fill("#periodInput", "Septiembre 2026");
  await pagina.fill("#amountInput", "1.000.000");

  const filas = await pagina.$$eval("#docList [data-row]", rs => rs.map(r => r.dataset.row));
  for(const no of filas){
    const fila = pagina.locator(`#docList [data-row="${no}"]`);
    for(const sel of await fila.locator("select[data-field]").all()){
      const valor = await sel.evaluate(s => [...s.options].find(o => o.value).value);
      await sel.selectOption(valor);
    }
    for(const campo of await fila.locator("input[data-field]").all()) await campo.fill("123");
    // Marcar vuelve a pintar el checklist: se busca de nuevo cada vez.
    await pagina.locator(`#docList [data-check="${no}"]`).check();
  }
  await pagina.check("#declarationCheck");
}

/* Pulsa Emitir y espera a que la emisión termine, bien o mal. */
async function emitir(pagina){
  await pagina.click("#issueBtn");
  await pagina.waitForFunction(() => {
    const b = document.getElementById("issueBtn");
    return !b.disabled && b.textContent !== "Emitiendo…";
  });
}

async function registrosLocales(pagina){
  return pagina.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), CLAVES.registros);
}

async function irAlRegistro(pagina){
  await pagina.click("#tabRecords");
  await pagina.waitForFunction(() => !/Consultando/.test(document.getElementById("rcEstado").textContent));
}

async function cerrarVistaPrevia(pagina){
  await pagina.click("#closePreviewBtn");
}

/* Un certificado ya emitido, como lo guarda la página en localStorage. */
function registroEmitido({ id, folio, ministro = "GAB700", status = "issued", ...resto }){
  const ahora = new Date().toISOString();
  return Object.assign({
    id, folio, status,
    ministerId: ministro, ministerCode: ministro, ministerName: "Alejandro Barrientos Rojas",
    ministerRut: "15.372.938-7", ministerCargo: "Jefe de Gabinete", ministerRole: "Ministro de Fe",
    ministerUnit: "Gabinete", nature: "remuneraciones", natureLabel: "Remuneraciones",
    programa: "Programa 01", subvencion: "RESTO", unit: "Unidad de prueba", reference: "Set sembrado",
    period: "Agosto 2026", amount: "1000", declaration: true, docs: {}, detalle: [], otros: [],
    createdAt: ahora, updatedAt: ahora, issuedAt: ahora, origen: "central"
  }, resto);
}

module.exports = {
  ANIO, CLAVES, entorno, abrir, llenarFormulario, emitir, registrosLocales, irAlRegistro,
  cerrarVistaPrevia, registroEmitido
};
