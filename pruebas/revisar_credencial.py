#!/usr/bin/env python3
"""La dirección del flujo de Power Automate es una credencial: quien la tenga puede
escribir en el registro del Servicio. No va en el repositorio, que es público.

Revisa todos los archivos versionados (y, con --historial, todo lo que alguna vez se
subió) en busca de algo con forma de esa dirección. Sale con código 1 si encuentra algo
y muestra dónde, sin repetir la dirección completa.

    python3 pruebas/revisar_credencial.py
    python3 pruebas/revisar_credencial.py --historial
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

PATRONES = [
    # Disparador HTTP clásico de Logic Apps / Power Automate.
    re.compile(r"https://[a-z0-9.-]*logic\.azure\.com[^\s\"'<>)]*", re.I),
    # Disparador nuevo, alojado en Power Platform.
    re.compile(r"https://[a-z0-9.-]*\.(?:environment\.)?api\.powerplatform\.com[^\s\"'<>)]*", re.I),
    # La firma, aunque venga sin el resto de la dirección.
    re.compile(r"[?&]sig=[A-Za-z0-9_%-]{20,}"),
    # Un identificador de flujo en una ruta de disparador.
    re.compile(r"/workflows/[0-9a-f]{32}/triggers/", re.I),
]


def tapar(texto):
    return texto[:24] + "…" if len(texto) > 24 else texto


def revisar(nombre, contenido):
    hallazgos = []
    for n, linea in enumerate(contenido.splitlines(), 1):
        for patron in PATRONES:
            for m in patron.finditer(linea):
                hallazgos.append(f"{nombre}:{n}: {tapar(m.group(0))}")
    return hallazgos


def archivos_versionados():
    salida = subprocess.run(["git", "ls-files", "-z"], cwd=RAIZ, check=True,
                            capture_output=True).stdout
    return [p for p in salida.decode().split("\0") if p]


def historial():
    """Todo lo que alguna vez se agregó o quitó en algún commit."""
    salida = subprocess.run(["git", "log", "--all", "-p", "--no-color", "--text"], cwd=RAIZ,
                            check=True, capture_output=True).stdout.decode("utf-8", "replace")
    return revisar("(historial)", salida)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--historial", action="store_true",
                        help="revisar también todos los commits, no sólo lo vigente")
    args = parser.parse_args()

    hallazgos = []
    for nombre in archivos_versionados():
        ruta = RAIZ / nombre
        try:
            contenido = ruta.read_text(encoding="utf-8")
        except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
            continue                       # binarios (logos, PDF) y archivos borrados
        hallazgos += revisar(nombre, contenido)
    if args.historial:
        hallazgos += historial()

    if hallazgos:
        print("Hay algo con forma de dirección del flujo en el repositorio:")
        print("\n".join("  " + h for h in hallazgos))
        print("Sáquelo y, si alguna vez se subió, avise al Subdepartamento de Finanzas.")
        return 1
    print("Sin direcciones del flujo en el repositorio.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
