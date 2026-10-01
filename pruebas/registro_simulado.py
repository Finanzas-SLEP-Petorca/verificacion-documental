#!/usr/bin/env python3
"""Registro central simulado: el flujo de Power Automate y la lista de SharePoint.

Reproduce lo que describe docs/registro-central.md, acción por acción, para que la
página se pueda probar sin tocar el registro de verdad. No usa nada fuera de la
biblioteca estándar.

    python3 pruebas/registro_simulado.py --puerto 8765

Imprime en la primera línea de su salida la dirección en que quedó escuchando.

Además de las cinco acciones del flujo (ping, listar, emitir, obtener, anular),
expone dos rutas de control que sólo usan las pruebas:

    POST /__control   {"reiniciar": true, "filas": [...], "fallas": {...},
                       "sinCors": true}
    GET  /__estado    filas de la lista, peticiones recibidas y su orden

Los simulacros —las formas en que el Servicio puede fallar— se arman con "fallas",
por acción y por número de veces:

    {"fallas": {"emitir": {"modo": "pierde-respuesta", "veces": 1}}}

    caido             responde 500 con {"ok": false, "error": ...}
    pierde-respuesta  hace el trabajo (anota la fila) y corta la respuesta a medio camino
    lento             hace el trabajo y espera "segundos" antes de responder
    crudo             (sólo obtener) devuelve la columna Datos sin superponer el estado,
                      como un endpoint montado de otra manera
    sin-cors          no es una falla por acción: "sinCors": true hace que el preflight
                      CORS se rechace, y el navegador sólo puede llegar con text/plain
"""

import argparse
import json
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Las series definitivas de 2026 arrancan en el 010: del 001 al 009 los consumió el
# pilotaje. El arranque lo impone el flujo, no la página.
SERIE_DESDE = 10


def ahora():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Registro:
    """La lista de SharePoint más la lógica del flujo."""

    def __init__(self):
        # Un solo candado hace las veces de "Control de simultaneidad = 1" y de la
        # columna ClaveCorrelativo con valores únicos.
        self.candado = threading.Lock()
        self.reiniciar()

    def reiniciar(self):
        with self.candado:
            self.filas = []
            self.peticiones = []
            self.fallas = {}
            self.sin_cors = False

    # ── acciones del flujo ──────────────────────────────────────────────────

    def ping(self, entrada):
        return 200, {"ok": True}

    def listar(self, entrada):
        anio = datetime.now().year
        registros = [{
            "id": f.get("IdEmision") or "",
            "folio": f.get("Folio") or "",
            "ministerName": f.get("Ministro") or "",
            "ministerCode": f.get("CodigoMinistro") or "",
            "natureLabel": f.get("Naturaleza") or "",
            "unit": f.get("Unidad") or "",
            "reference": f.get("Referencia") or "",
            "status": "cancelled" if f.get("Estado") == "Anulado" else "issued",
            "cancelReason": f.get("MotivoAnulacion") or "",
            "cancelledAt": f.get("FechaAnulacion") or "",
            "issuedAt": f.get("FechaEmision") or "",
            "updatedAt": f.get("FechaEmision") or "",
        } for f in self.filas if f.get("Anio") == anio]
        return 200, {"ok": True, "registros": registros}

    def emitir(self, entrada):
        id_emision = entrada.get("idEmision")
        if not id_emision:
            return 500, {"ok": False, "error": "No fue posible registrar la emisión."}
        with self.candado:
            # Idempotencia: el mismo idEmision devuelve el folio ya asignado.
            previa = next((f for f in self.filas if f.get("IdEmision") == id_emision), None)
            if previa:
                return 200, {"ok": True, "folio": previa["Folio"], "numero": previa["Numero"]}

            codigo, anio = entrada.get("ministroCodigo"), int(entrada.get("anio") or 0)
            ultimo = max((f["Numero"] for f in self.filas
                          if f.get("CodigoMinistro") == codigo and f.get("Anio") == anio),
                         default=SERIE_DESDE - 1)
            numero = max(ultimo, SERIE_DESDE - 1) + 1
            folio = "-".join([entrada.get("prefijo") or "", str(anio),
                              entrada.get("programaCodigo") or "", codigo or "",
                              str(numero).zfill(3)])
            clave = f"{codigo}|{anio}|{numero}"
            if any(f.get("ClaveCorrelativo") == clave for f in self.filas):
                return 500, {"ok": False, "error": "No fue posible registrar la emisión."}
            self.filas.append({
                "Title": folio, "Folio": folio, "Anio": anio, "Numero": numero,
                "ClaveCorrelativo": clave,
                "CodigoMinistro": codigo, "IdEmision": id_emision,
                "Ministro": entrada.get("ministroNombre"),
                "MinistroRut": entrada.get("ministroRut"),
                "MinistroCargo": entrada.get("ministroCargo"),
                "Programa": entrada.get("programa"),
                "Naturaleza": entrada.get("naturaleza"),
                "Unidad": entrada.get("unidad"),
                "Referencia": entrada.get("referencia"),
                "FechaEmision": ahora(),
                "Estado": "Emitido", "MotivoAnulacion": "", "FechaAnulacion": "",
                # Se escribe una sola vez y no se vuelve a tocar.
                "Datos": json.dumps(entrada.get("registro") or {}, ensure_ascii=False),
            })
            return 200, {"ok": True, "folio": folio, "numero": numero}

    def obtener(self, entrada, crudo=False):
        fila = next((f for f in self.filas if f.get("IdEmision") == entrada.get("idEmision")), None)
        if not fila:
            return 404, {"ok": False, "error": "El certificado no está en el registro del Servicio."}
        datos = json.loads(fila.get("Datos") or "{}")
        if not crudo:
            datos.update({
                "folio": fila["Folio"],
                "status": "cancelled" if fila["Estado"] == "Anulado" else "issued",
                "cancelReason": fila["MotivoAnulacion"],
                "cancelledAt": fila["FechaAnulacion"],
            })
        return 200, {"ok": True, "registro": datos}

    def anular(self, entrada):
        with self.candado:
            fila = next((f for f in self.filas if f.get("IdEmision") == entrada.get("idEmision")), None)
            if not fila:
                return 404, {"ok": False, "error": "El folio no está en el registro del Servicio."}
            # Ni Folio, ni Numero, ni Anio, ni Datos: sólo el estado.
            fila["Estado"] = "Anulado"
            fila["MotivoAnulacion"] = entrada.get("motivo") or ""
            fila["FechaAnulacion"] = ahora()
            return 200, {"ok": True, "folio": entrada.get("folio")}

    # ── fallas ──────────────────────────────────────────────────────────────

    def tomar_falla(self, accion):
        with self.candado:
            falla = self.fallas.get(accion)
            if not falla:
                return None
            if falla.get("veces", 1) <= 1:
                del self.fallas[accion]
            else:
                falla["veces"] -= 1
            return dict(falla)

    def estado(self):
        with self.candado:
            return {"filas": [dict(f) for f in self.filas],
                    "peticiones": [dict(p) for p in self.peticiones]}


def fila_sembrada(datos):
    """Completa una fila sembrada desde las pruebas con lo que pondría el flujo."""
    fila = {"Estado": "Emitido", "MotivoAnulacion": "", "FechaAnulacion": "",
            "FechaEmision": ahora(), "Datos": "{}", "IdEmision": str(uuid.uuid4())}
    fila.update(datos)
    if isinstance(fila.get("Datos"), dict):
        fila["Datos"] = json.dumps(fila["Datos"], ensure_ascii=False)
    partes = (fila.get("Folio") or "").split("-")
    if "Anio" not in fila and len(partes) >= 3:
        fila["Anio"] = int(partes[1])
    if "Numero" not in fila and partes and partes[-1].isdigit():
        fila["Numero"] = int(partes[-1])
    if "CodigoMinistro" not in fila and len(partes) >= 4:
        fila["CodigoMinistro"] = partes[-2]
    fila.setdefault("ClaveCorrelativo",
                    f"{fila.get('CodigoMinistro')}|{fila.get('Anio')}|{fila.get('Numero')}")
    return fila


def crear_manejador(registro):
    class Manejador(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):        # silencio: la salida es de las pruebas
            pass

        def cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")

        def responder(self, codigo, cuerpo):
            datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
            self.send_response(codigo)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(datos)))
            self.cors()
            self.end_headers()
            self.wfile.write(datos)

        def leer(self):
            largo = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(largo).decode("utf-8") if largo else ""

        def do_OPTIONS(self):
            if registro.sin_cors:
                # Preflight rechazado: sin encabezados CORS, el navegador no sigue.
                self.send_response(404)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self.send_response(204)
            self.cors()
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            if self.path.startswith("/__estado"):
                return self.responder(200, registro.estado())
            self.responder(404, {"ok": False, "error": "No encontrado"})

        def do_POST(self):
            texto = self.leer()
            if self.path.startswith("/__control"):
                return self.control(json.loads(texto or "{}"))

            # El flujo acepta el cuerpo como application/json o como text/plain.
            try:
                entrada = json.loads(texto) if texto else {}
            except ValueError:
                entrada = {}
            accion = entrada.get("accion")
            with registro.candado:
                registro.peticiones.append({
                    "accion": accion,
                    "contentType": self.headers.get("Content-Type", ""),
                    "idEmision": entrada.get("idEmision"),
                    "t": time.time(),
                })

            falla = registro.tomar_falla(accion)
            modo = (falla or {}).get("modo")
            if modo == "caido":
                return self.responder(500, {"ok": False, "error": "No fue posible registrar la emisión."})

            metodo = {"ping": registro.ping, "listar": registro.listar,
                      "emitir": registro.emitir, "anular": registro.anular}.get(accion)
            if accion == "obtener":
                codigo, cuerpo = registro.obtener(entrada, crudo=(modo == "crudo"))
            elif metodo:
                codigo, cuerpo = metodo(entrada)
            else:
                codigo, cuerpo = 400, {"ok": False, "error": "Acción desconocida."}

            if modo == "pierde-respuesta":
                # La fila quedó anotada, pero la respuesta se corta a medio camino. Se
                # alcanzan a mandar los encabezados para que el navegador no reintente
                # por su cuenta, como hace con una conexión que se cierra sin responder.
                datos = json.dumps(cuerpo).encode("utf-8")
                self.send_response(codigo)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(datos) + 100))
                self.cors()
                self.end_headers()
                self.wfile.write(datos[:5])
                self.wfile.flush()
                self.close_connection = True
                return
            if modo == "lento":
                time.sleep(float(falla.get("segundos", 3)))
            try:
                self.responder(codigo, cuerpo)
            except (BrokenPipeError, ConnectionResetError):
                pass                              # el navegador ya se fue

        def control(self, orden):
            if orden.get("reiniciar"):
                registro.reiniciar()
            with registro.candado:
                for f in orden.get("filas") or []:
                    registro.filas.append(fila_sembrada(f))
                for accion, falla in (orden.get("fallas") or {}).items():
                    if falla:
                        registro.fallas[accion] = dict(falla)
                    else:
                        registro.fallas.pop(accion, None)
                if "sinCors" in orden:
                    registro.sin_cors = bool(orden["sinCors"])
                for cambio in orden.get("anular") or []:
                    for f in registro.filas:
                        if f["IdEmision"] == cambio.get("idEmision") or f["Folio"] == cambio.get("folio"):
                            f["Estado"] = "Anulado"
                            f["MotivoAnulacion"] = cambio.get("motivo", "")
                            f["FechaAnulacion"] = cambio.get("fecha") or ahora()
            self.responder(200, {"ok": True})

    return Manejador


class Servidor(ThreadingHTTPServer):
    daemon_threads = True
    # La cola por omisión es de 5: con más emisiones simultáneas, el sistema
    # rechazaba conexiones antes de que llegaran al flujo.
    request_queue_size = 128


def servir(puerto=0, anfitrion="127.0.0.1"):
    registro = Registro()
    return Servidor((anfitrion, puerto), crear_manejador(registro)), registro


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--puerto", type=int, default=0)
    args = parser.parse_args()
    servidor, _ = servir(args.puerto)
    print(f"http://127.0.0.1:{servidor.server_address[1]}/", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
