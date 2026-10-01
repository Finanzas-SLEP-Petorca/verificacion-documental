"""El revisor de la credencial tiene que reconocer la dirección del flujo.

Las direcciones de ejemplo se arman por partes para que este archivo no sea, él mismo,
un hallazgo del revisor.
"""

import unittest

from revisar_credencial import revisar

FIRMA = "sig" + "=" + "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
CLASICA = ("https://prod-00.brazilsouth." + "logic.azure.com:443/workflows/" + "0" * 32 +
           "/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers&sv=1.0&" + FIRMA)
NUEVA = ("https://default0000.00.environment." + "api.powerplatform.com:443/powerautomate/"
         "automations/direct/workflows/" + "a" * 32 + "/triggers/manual/paths/invoke?" + FIRMA)


class RevisarCredencialTest(unittest.TestCase):

    def test_reconoce_la_direccion_clasica(self):
        self.assertTrue(revisar("x", f'localStorage.setItem("k", "{CLASICA}")'))

    def test_reconoce_la_direccion_de_power_platform(self):
        self.assertTrue(revisar("x", NUEVA))

    def test_reconoce_la_firma_suelta(self):
        self.assertTrue(revisar("x", "copie esto: ?" + FIRMA))

    def test_no_tapa_menciones_de_la_firma(self):
        self.assertEqual(revisar("x", "lleva una firma (`sig=`) que funciona como llave"), [])

    def test_no_repite_la_direccion_completa(self):
        hallazgo = revisar("x", CLASICA)[0]
        self.assertNotIn(FIRMA, hallazgo)


if __name__ == "__main__":
    unittest.main()
