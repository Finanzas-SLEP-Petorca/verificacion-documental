#!/usr/bin/env bash
# Corre todas las pruebas: las del registro simulado y del revisor de la credencial
# (Python, sin dependencias) y las de la página (Playwright con Chromium).
#
#   pruebas/correr.sh
#
# Sale con código distinto de 0 si algo falla.
set -euo pipefail
cd "$(dirname "$0")"

echo "── Credencial: la dirección del flujo no está en el repositorio"
python3 revisar_credencial.py --historial

echo
echo "── Registro simulado y revisor (Python)"
python3 -m unittest discover -s . -p "test_*.py"

echo
echo "── Página (Playwright)"
node --test --test-reporter=spec ./*.test.js
