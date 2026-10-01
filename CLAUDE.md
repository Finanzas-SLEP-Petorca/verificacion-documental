# Reglas de trabajo en este repositorio

Certificado de Ministro de Fe: sitio estático de una sola página (`index.html`,
sin compilación ni dependencias) publicado en GitHub Pages. Emite certificados de
verificación documental para los sets de pago que el Servicio rinde a la
Contraloría General de la República, bajo la REX N° 450 de 2026.

## Una sola rama

Este repositorio trabaja con **una única rama**, `claude/doc-verification-open-project-61fkab`,
que además es la predeterminada y la que publica la página.

- Los cambios van en **commits directos** sobre esa rama.
- **No crees otra rama**, por pequeño o experimental que sea el cambio.
- **No fusiones ni combines nada**: con una sola rama no hay nada que fusionar.
- **No abras pull requests** salvo que la persona lo pida expresamente.

Es una decisión del Subdepartamento de Finanzas: quieren ver una sola rama en
GitHub y ninguna fusión. Si un cambio parece necesitar una rama aparte,
pregunta antes en vez de crearla.

## Sólo este repositorio

No abras, clones ni modifiques otros repositorios del Servicio desde una sesión
de este proyecto, aunque la conversación derive hacia ellos. En particular, el
panel de nóminas de pago (*Generador de Nóminas de Pago en BancoEstado*) es un
proyecto distinto, con su propia conversación: si lo que se pide corresponde a
ese panel, dilo y no lo toques desde aquí.

## Antes de dar algo por terminado

- El certificado es un documento de fe pública: el folio lo asigna el registro
  central del Servicio y **sin conexión no se emite**. No agregues caminos
  alternativos de numeración local.
- Los certificados de la etapa de pilotaje (folio menor a `010`) **no se borran**:
  son el único rastro de lo que se emitió entonces.
- La dirección del flujo de Power Automate es una credencial: no va en el
  repositorio, ni en un archivo versionado, ni en la salida.
- Un certificado emitido o anulado **no vuelve a ser borrador, no se revive y no
  se elimina**: sólo se edita o borra un borrador que nunca tuvo folio.
- Prueba los cambios de verdad antes de decir que funcionan. El `README.md`
  explica el modelo de datos, la anulación y la verificación; `docs/` tiene el
  montaje del registro central.

## Pruebas

Las pruebas automatizadas viven en `pruebas/` y van **versionadas en el
repositorio**, nunca en un directorio temporal de la sesión: las anteriores se
perdieron así.

- `pruebas/correr.sh` corre todo (unos 20 segundos) y debe terminar sin fallas
  antes de cada commit que toque `index.html`.
- Corre contra `pruebas/registro_simulado.py`, un registro central simulado con
  sus cinco simulacros de falla. **Nunca** apuntes las pruebas al registro de
  verdad ni uses su dirección.
- Si cambias un comportamiento, cambia o agrega la prueba que lo cubre en el
  mismo commit. Si una prueba falla, se corrige la causa: no se salta, no se
  desactiva y no se afloja para que pase.
- Si cambias el protocolo con el flujo (`docs/registro-central.md`), actualiza
  también el simulador y `pruebas/test_registro_simulado.py`.
- Qué cubre cada archivo y cómo instalar Playwright fuera de la nube:
  `pruebas/README.md`.
