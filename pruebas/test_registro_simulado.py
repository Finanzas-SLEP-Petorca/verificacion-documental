"""El registro simulado tiene que comportarse como el flujo, o las pruebas de la página
no prueban nada. Estas lo comprueban contra docs/registro-central.md.

    python3 -m unittest discover -s pruebas -p "test_*.py"
"""

import http.client
import json
import threading
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from registro_simulado import servir

ANIO = datetime.now().year


class RegistroSimuladoTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.servidor, cls.registro = servir(0)
        cls.puerto = cls.servidor.server_address[1]
        cls.url = f"http://127.0.0.1:{cls.puerto}/"
        threading.Thread(target=cls.servidor.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()
        cls.servidor.server_close()

    def setUp(self):
        self.registro.reiniciar()

    def llamar(self, cuerpo, tipo="application/json", ruta="/"):
        pedido = urllib.request.Request(
            f"http://127.0.0.1:{self.puerto}{ruta}", data=json.dumps(cuerpo).encode(),
            headers={"Content-Type": tipo}, method="POST")
        try:
            with urllib.request.urlopen(pedido, timeout=10) as r:
                return r.status, json.loads(r.read()), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}"), dict(e.headers)

    def emitir(self, id_emision, codigo="GAB700", programa="P01", **extra):
        cuerpo = {"accion": "emitir", "idEmision": id_emision, "anio": ANIO, "prefijo": "CMF",
                  "programaCodigo": programa, "ministroCodigo": codigo,
                  "registro": {"id": id_emision, "folio": None, "status": "issued"}}
        cuerpo.update(extra)
        return self.llamar(cuerpo)

    def test_la_serie_arranca_en_010(self):
        _, r, _ = self.emitir("a")
        self.assertEqual(r["folio"], f"CMF-{ANIO}-P01-GAB700-010")
        self.assertEqual(r["numero"], 10)

    def test_la_serie_corre_por_ministro_y_no_por_programa(self):
        self.emitir("a", programa="P01")
        _, r, _ = self.emitir("b", programa="P02")
        self.assertEqual(r["folio"], f"CMF-{ANIO}-P02-GAB700-011")
        _, r, _ = self.emitir("c", codigo="SAF103", programa="EXT")
        self.assertEqual(r["folio"], f"CMF-{ANIO}-EXT-SAF103-010")

    def test_el_mismo_idemision_no_gasta_otro_folio(self):
        _, r1, _ = self.emitir("mismo")
        _, r2, _ = self.emitir("mismo")
        self.assertEqual(r1["folio"], r2["folio"])
        self.assertEqual(len(self.registro.filas), 1)

    def test_emisiones_simultaneas_no_repiten_folio(self):
        with ThreadPoolExecutor(max_workers=16) as ex:
            folios = list(ex.map(lambda i: self.emitir(f"id-{i}")[1]["folio"], range(40)))
        self.assertEqual(len(set(folios)), 40)
        numeros = sorted(f["Numero"] for f in self.registro.filas)
        self.assertEqual(numeros, list(range(10, 50)))

    def test_acepta_el_cuerpo_como_text_plain(self):
        codigo, r, _ = self.llamar({"accion": "ping"}, tipo="text/plain;charset=UTF-8")
        self.assertEqual((codigo, r), (200, {"ok": True}))

    def test_responde_con_cors(self):
        _, _, encabezados = self.llamar({"accion": "ping"})
        self.assertEqual(encabezados.get("Access-Control-Allow-Origin"), "*")

    def test_anular_cambia_el_estado_y_no_toca_datos_ni_numero(self):
        self.emitir("x")
        antes = dict(self.registro.filas[0])
        codigo, r, _ = self.llamar({"accion": "anular", "idEmision": "x",
                                    "folio": antes["Folio"], "motivo": "Error de digitación"})
        self.assertEqual(codigo, 200)
        despues = self.registro.filas[0]
        self.assertEqual(despues["Estado"], "Anulado")
        self.assertEqual(despues["MotivoAnulacion"], "Error de digitación")
        for columna in ("Folio", "Numero", "Anio", "Datos"):
            self.assertEqual(despues[columna], antes[columna], columna)
        # El folio anulado sigue ocupado.
        _, r, _ = self.emitir("y")
        self.assertTrue(r["folio"].endswith("-011"))

    def test_anular_lo_que_no_existe_es_404(self):
        codigo, r, _ = self.llamar({"accion": "anular", "idEmision": "nada"})
        self.assertEqual(codigo, 404)
        self.assertFalse(r["ok"])

    def test_obtener_superpone_el_estado_de_las_columnas(self):
        self.emitir("x")
        self.llamar({"accion": "anular", "idEmision": "x", "motivo": "Duplicado del set 14"})
        _, r, _ = self.llamar({"accion": "obtener", "idEmision": "x"})
        self.assertEqual(r["registro"]["status"], "cancelled")
        self.assertEqual(r["registro"]["folio"], f"CMF-{ANIO}-P01-GAB700-010")
        self.assertEqual(r["registro"]["cancelReason"], "Duplicado del set 14")

    def test_obtener_crudo_devuelve_datos_tal_cual(self):
        self.emitir("x")
        self.llamar({"accion": "anular", "idEmision": "x", "motivo": "Duplicado del set 14"})
        self.registro.fallas["obtener"] = {"modo": "crudo"}
        _, r, _ = self.llamar({"accion": "obtener", "idEmision": "x"})
        self.assertIsNone(r["registro"]["folio"])
        self.assertEqual(r["registro"]["status"], "issued")

    def test_listar_devuelve_los_doce_campos(self):
        self.emitir("x")
        _, r, _ = self.llamar({"accion": "listar"})
        self.assertEqual(set(r["registros"][0]), {
            "id", "folio", "ministerName", "ministerCode", "natureLabel", "unit", "reference",
            "status", "cancelReason", "cancelledAt", "issuedAt", "updatedAt"})

    def test_simulacro_caido(self):
        self.registro.fallas["emitir"] = {"modo": "caido"}
        codigo, r, encabezados = self.emitir("x")
        self.assertEqual(codigo, 500)
        self.assertFalse(r["ok"])
        self.assertEqual(encabezados.get("Access-Control-Allow-Origin"), "*")
        self.assertEqual(self.registro.filas, [])

    def test_simulacro_pierde_respuesta_anota_la_fila(self):
        self.registro.fallas["emitir"] = {"modo": "pierde-respuesta"}
        with self.assertRaises((http.client.IncompleteRead, ConnectionError, urllib.error.URLError)):
            self.emitir("x")
        self.assertEqual(len(self.registro.filas), 1)
        # El reintento con el mismo idEmision recibe el folio ya anotado.
        _, r, _ = self.emitir("x")
        self.assertEqual(r["folio"], self.registro.filas[0]["Folio"])
        self.assertEqual(len(self.registro.filas), 1)

    def test_simulacro_lento(self):
        self.registro.fallas["ping"] = {"modo": "lento", "segundos": 0.3}
        inicio = datetime.now()
        self.llamar({"accion": "ping"})
        self.assertGreaterEqual((datetime.now() - inicio).total_seconds(), 0.3)

    def test_simulacro_sin_cors_rechaza_el_preflight(self):
        self.registro.sin_cors = True
        conexion = http.client.HTTPConnection("127.0.0.1", self.puerto, timeout=5)
        conexion.request("OPTIONS", "/", headers={"Origin": "http://localhost",
                                                  "Access-Control-Request-Method": "POST"})
        respuesta = conexion.getresponse()
        self.assertNotEqual(respuesta.status // 100, 2)
        self.assertIsNone(respuesta.getheader("Access-Control-Allow-Origin"))
        conexion.close()

    def test_las_fallas_se_agotan(self):
        self.registro.fallas["ping"] = {"modo": "caido", "veces": 2}
        self.assertEqual(self.llamar({"accion": "ping"})[0], 500)
        self.assertEqual(self.llamar({"accion": "ping"})[0], 500)
        self.assertEqual(self.llamar({"accion": "ping"})[0], 200)


if __name__ == "__main__":
    unittest.main()
