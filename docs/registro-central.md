# Registro central en Microsoft 365

Guía para el Subdepartamento de Finanzas y el área de informática del Servicio.
Tiempo estimado de montaje: una hora.

## Para qué

Hoy cada Ministro de Fe tiene su propio registro y sus propios correlativos, guardados
en el navegador del equipo que usa. Eso significa que dos personas —o la misma persona
en dos computadores— pueden emitir el mismo folio, y que nadie puede ver el registro
completo del Servicio.

El registro central resuelve las dos cosas: el número lo asigna el Servicio, no el
navegador, y todas las emisiones quedan en una lista de Microsoft 365 que sirve de
respaldo y de fuente para auditoría.

La aplicación sigue funcionando sin él. Mientras no se configure, se comporta como
hasta ahora y lo advierte en la pestaña **Registro de certificados**.

## Cómo queda armado

```text
Página en GitHub Pages  ──POST──▶  Flujo de Power Automate  ──▶  Lista de Microsoft 365
   (pública, sin login)             (asigna el correlativo)        (SharePoint del SLEP)
```

La página es pública, pero la dirección del flujo **no** va en el repositorio: cada
Ministro de Fe la pega una vez en su navegador (botón **Configurar**) y queda guardada
ahí. La dirección se entrega por correo interno, no se publica.

Los datos —incluidos nombre, RUT y cargo del Ministro de Fe— quedan en SharePoint del
Servicio. No salen a ningún proveedor externo.

---

## Paso 1. Crear la lista

En el sitio de SharePoint del Subdepartamento de Finanzas, cree una lista llamada
**Certificados Ministro de Fe** con estas columnas:

| Columna | Tipo | Notas |
|---|---|---|
| `Title` | Texto | Se usa para el folio |
| `Folio` | Texto | `CMF-2026-P01-GAB700-001` |
| `Anio` | Número | Sin separador de miles |
| `Numero` | Número | Correlativo dentro del ministro y el año |
| `CodigoMinistro` | Texto | `GAB700` |
| `IdEmision` | Texto | Identificador único de la emisión |
| `Ministro` | Texto | |
| `MinistroRut` | Texto | |
| `MinistroCargo` | Texto | |
| `Programa` | Texto | |
| `Naturaleza` | Texto | |
| `Unidad` | Texto | |
| `Referencia` | Texto | |
| `FechaEmision` | Fecha y hora | |
| `Datos` | Varias líneas de texto, **texto sin formato** | Certificado completo en JSON |

Indexe `CodigoMinistro`, `Anio` e `IdEmision`: el flujo los consulta en cada emisión.

Permisos: lectura y escritura para el flujo; lectura para quien deba auditar. Nadie
necesita permiso de eliminación — un certificado emitido no se borra, se anula.

## Paso 2. Crear el flujo

En Power Automate, flujo **instantáneo** con el desencadenador
**Cuando se recibe una solicitud HTTP**.

1. Método: `POST`. Deje el **esquema JSON vacío**: el cuerpo se interpreta dentro del
   flujo, para aceptar tanto `application/json` como `text/plain`.
2. En **Configuración** del desencadenador, active **Control de simultaneidad** con
   grado de paralelismo **1**. Esto es indispensable: serializa las emisiones y evita
   que dos solicitudes simultáneas obtengan el mismo número.
3. Primera acción, **Redactar**, nombre `Entrada`, valor:

   ```
   @{if(equals(coalesce(triggerBody(), ''), ''), json('{}'), if(equals(string(triggerBody()), string(json(string(triggerBody())))), json(string(triggerBody())), triggerBody()))}
   ```

   Si esa expresión da problemas en su entorno, use simplemente
   `json(string(triggerBody()))`, que funciona cuando el cuerpo llega como texto.

4. **Condición / Switch** sobre `outputs('Entrada')?['accion']`, con tres casos.

### Caso `ping`

Una acción **Respuesta**:

- Código de estado: `200`
- Encabezados:
  - `Content-Type`: `application/json`
  - `Access-Control-Allow-Origin`: `*`
- Cuerpo: `{ "ok": true }`

### Caso `listar`

1. **Obtener elementos** de la lista. Consulta ODATA de filtro: `Anio eq <año actual>`.
   Límite: 5000, con paginación activada.
2. **Seleccionar**, para devolver sólo lo que la página muestra:

   ```json
   {
     "id":           "@{item()?['IdEmision']}",
     "folio":        "@{item()?['Folio']}",
     "ministerName": "@{item()?['Ministro']}",
     "ministerCode": "@{item()?['CodigoMinistro']}",
     "natureLabel":  "@{item()?['Naturaleza']}",
     "unit":         "@{item()?['Unidad']}",
     "reference":    "@{item()?['Referencia']}",
     "status":       "issued",
     "issuedAt":     "@{item()?['FechaEmision']}",
     "updatedAt":    "@{item()?['FechaEmision']}"
   }
   ```

3. **Respuesta** con los mismos encabezados del caso `ping` y cuerpo
   `{ "ok": true, "registros": <salida del Seleccionar> }`.

### Caso `emitir`

1. **Obtener elementos**, filtro `IdEmision eq '@{outputs('Entrada')?['idEmision']}'`,
   límite 1. Es el control de idempotencia: si la página reintenta por un corte de red,
   no se consume un segundo número.
2. **Condición**: ¿la longitud del resultado es mayor que 0?
   - **Sí** → **Respuesta** con el folio ya existente.
   - **No** → continúe.
3. **Obtener elementos**, filtro
   `CodigoMinistro eq '@{outputs('Entrada')?['ministroCodigo']}' and Anio eq @{outputs('Entrada')?['anio']}`,
   orden `Numero desc`, límite 1.
4. **Redactar** `Numero`:
   `@{add(int(coalesce(first(body('Obtener_ultimo')?['value'])?['Numero'], 0)), 1)}`
5. **Redactar** `Folio`:
   ```
   @{concat(outputs('Entrada')?['prefijo'], '-', string(outputs('Entrada')?['anio']), '-', outputs('Entrada')?['programaCodigo'], '-', outputs('Entrada')?['ministroCodigo'], '-', substring(concat('000', string(outputs('Numero'))), sub(length(concat('000', string(outputs('Numero')))), 3), 3))}
   ```
6. **Crear elemento** en la lista, con `Datos` =
   `@{string(outputs('Entrada')?['registro'])}` y el resto de las columnas desde
   `Entrada`. En `FechaEmision` use `utcNow()`: la hora la pone el servidor, no el
   equipo de quien emite.
7. **Respuesta**: `{ "ok": true, "folio": "@{outputs('Folio')}", "numero": @{outputs('Numero')} }`,
   con los encabezados de CORS.

### Manejo de errores

Agregue una acción **Respuesta** final, configurada para ejecutarse **si falla** alguna
de las anteriores, con código `500` y cuerpo
`{ "ok": false, "error": "No fue posible registrar la emisión." }`, más el encabezado
`Access-Control-Allow-Origin: *`. Sin ese encabezado el navegador no puede mostrar el
motivo del error y el Ministro de Fe queda sin saber qué pasó.

## Paso 3. Entregar la dirección

Al guardar el flujo, el desencadenador muestra la **URL HTTP POST**. Esa dirección
lleva una firma (`sig=`) que funciona como llave: quien la tenga puede escribir en la
lista. Trátela como una credencial — envíela por correo interno a cada Ministro de Fe,
no la publique ni la suba al repositorio.

Cada persona abre la aplicación → **Registro de certificados** → **Configurar**, pega la
dirección y presiona **Probar conexión**. Debe aparecer, en verde,
*"Conexión correcta. Los correlativos los asigna el Servicio."*

Si alguna vez hay que revocarla, basta con regenerar el flujo y repartir la nueva
dirección.

## Licenciamiento

El desencadenador **Cuando se recibe una solicitud HTTP** es un conector premium.
Confirme con informática que el Servicio tiene la licencia correspondiente antes de
empezar. Si no la tuviera, la alternativa equivalente es una **Azure Function** con
CORS habilitado escribiendo en la misma lista por Microsoft Graph: cambia el Paso 2,
no el resto.

## Qué hace la aplicación en cada caso

| Situación | Comportamiento |
|---|---|
| Sin dirección configurada | Correlativos locales, como hasta ahora. Lo advierte en pantalla. |
| Configurada y respondiendo | El folio lo asigna el Servicio. El registro muestra también lo emitido en otros equipos, como *solo consulta*. |
| Configurada y sin respuesta | **No emite.** Avisa el motivo y sugiere guardar el borrador y reintentar. El borrador no se pierde. |

La tercera fila es deliberada: un folio repetido en un documento que va a la Contraloría
es peor que esperar unos minutos.

## Acceso

El endpoint queda abierto: quien tenga la dirección puede emitir, sin usuario ni clave.
Fue una decisión tomada a conciencia, para no poner una barrera a los Ministros de Fe.
A cambio, la lista guarda de cada emisión el ministro, la fecha y hora del servidor y el
certificado completo, de modo que todo queda trazado.

Si más adelante se quisiera cerrar, hay dos caminos, de menor a mayor fricción: pedir
una clave compartida del equipo al emitir, o una clave por Ministro de Fe. Ninguno de
los dos exige rehacer lo montado.
