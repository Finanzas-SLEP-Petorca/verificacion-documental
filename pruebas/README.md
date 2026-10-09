# Pruebas

Pruebas automatizadas del Certificado de Ministro de Fe. El sitio no las necesita para
funcionar ni para publicarse: viven aquí para que cualquier cambio a `index.html` se
pueda comprobar antes de subirlo.

```sh
pruebas/correr.sh
```

Tarda unos 20 segundos y sale con código distinto de 0 si algo falla.

## Qué se necesita

- **Python 3.9 o superior**, sin paquetes adicionales.
- **Node 20 o superior** y **Playwright** con Chromium. En las sesiones de Claude Code en
  la nube ya vienen instalados. En otro equipo:

  ```sh
  cd pruebas
  npm install
  npx playwright install chromium
  ```

Nada de esto toca el registro central de verdad ni necesita su dirección.

El navegador de las pruebas corre en hora de Chile (`America/Santiago`), como el de los
Ministros de Fe, aunque el equipo que las corra esté en otra zona: en UTC no se ven los
errores que corren una fecha al día anterior.

## Qué hay

| Archivo | Qué es |
|---|---|
| `correr.sh` | Corre todo, en este orden: credencial, Python, Playwright. |
| `registro_simulado.py` | El flujo de Power Automate y la lista de SharePoint, simulados según [`docs/registro-central.md`](../docs/registro-central.md). |
| `revisar_credencial.py` | Busca en el repositorio, y con `--historial` en todos los commits, algo con forma de dirección del flujo. |
| `apoyo.js` | Lo que comparten las pruebas de la página: servidores, navegador, llenar el formulario, responder diálogos. |
| `*.test.js` | Pruebas de la página con Playwright, una por tema. |
| `test_*.py` | Pruebas del registro simulado y del revisor de la credencial. |

### Pruebas de la página

| Archivo | Comprueba |
|---|---|
| `emision.test.js` | Sin conexión no se emite. Con conexión el folio lo asigna el Servicio, la serie arranca en 010 y corre por Ministro de Fe y año, no por programa. Si el Servicio falla o no devuelve folio, no se emite y el formulario queda intacto. |
| `reintento.test.js` | Reintentar no gasta otro folio: respuesta perdida, tiempo agotado y preflight CORS rechazado terminan con una sola fila en el correlativo. |
| `estado.test.js` | El estado lo manda el Servicio: lo que allá está anulado se imprime anulado; al revés no. Los certificados de otro equipo se piden completos al Servicio, una sola vez, y se imprimen anulados aunque el endpoint devuelva `Datos` sin superponer. |
| `anulacion.test.js` | Anular exige el Servicio, pide motivo y deja el folio consumido. Un emitido o anulado no vuelve a ser borrador, no se revive y no se elimina. |
| `pilotaje.test.js` | Los certificados del pilotaje, en los tres formatos de folio, se reconocen, se marcan, se imprimen con **PILOTAJE** y nunca se borran. |
| `verificacion.test.js` | *Verificar correlativos*: folios repetidos, números saltados desde el 010, lo emitido aquí que el Servicio no tiene, filas sin folio. |
| `establecimientos.test.js` | Varios establecimientos por set, sólo con Programa 02: qué se ofrece, qué no se repite, qué se imprime, qué recibe el Servicio en `Unidad` sin pasar de 255 caracteres, y que lo de un solo establecimiento siga igual. El selector con buscador: establecimientos y jardines separados en cada comuna, búsqueda por RBD, nombre sin tildes, comuna o tipo, y manejo con el teclado. |
| `detalle.test.js` | El establecimiento (RBD) de cada documento del detalle: la lista del formulario con los del set primero y el RBD a la vista, la columna en el certificado sólo cuando se usa, la plantilla `.xlsx` con sus listas desplegables y su reimportación, el reconocimiento por nombre o RBD al importar, y que las planillas y certificados de antes sigan igual. |
| `llamadas.test.js` | La tabla *Cuántas veces llama la aplicación*: abrir, recargar, entrar al registro, Actualizar, Probar conexión, y que salir de la página no dispare un segundo POST. |
| `formulario.test.js` | Financiamiento según programa, complementario D.1, campos del PME, aviso del borrador, importación de planilla sin duplicar montos y fechas del detalle impresas sin correrse un día. Los antecedentes agregados después: Compra Ágil en Adquisiciones; la recepción conforme de Servicios Básicos según programa (del Servicio con el 01, del establecimiento con el 02 y el extrapresupuestario); Datos Bancarios en Servicios Básicos, Honorarios y Viáticos; el ítem Otros en Servicios Básicos. Y que lo ya emitido se reimprima tal como se emitió, sin esas filas ni la numeración corrida. La referencia del set, con tope de 255 caracteres. |

### Los simulacros

`registro_simulado.py` responde como el flujo en producción —incluido que SharePoint
rechaza una columna de texto de más de 255 caracteres— y, cuando una prueba lo pide,
falla de una de cinco maneras:

| Simulacro | Qué hace el Servicio | Qué debe hacer la página |
|---|---|---|
| `caido` | Responde 500 | No emitir ni anular, y decir por qué. |
| `pierde-respuesta` | Anota la fila y corta la respuesta a medio camino | Reintentar con el mismo `idEmision` y recibir el mismo folio. |
| `lento` | Anota la fila y tarda en responder | Cortar a los 20 s sin reintentar sola; el reintento de la persona recibe el mismo folio. |
| `sin-cors` | Rechaza el preflight | Llegar con `text/plain`, sin gastar dos folios. |
| `crudo` | `obtener` devuelve `Datos` sin el estado de las columnas | Superponer el estado por su cuenta: un anulado se imprime anulado. |

Se puede levantar a mano para probar la página en el navegador:

```sh
python3 pruebas/registro_simulado.py --puerto 8765
```

y pegar `http://127.0.0.1:8765/` en **Registro de certificados → Configurar**. La
página acepta `http://` sólo para `localhost` y `127.0.0.1`.
