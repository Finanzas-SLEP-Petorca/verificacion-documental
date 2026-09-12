# Prompt para la sesión de Cowork con acceso a Microsoft 365

Copie todo lo que sigue a la línea divisoria y péguelo en una sesión de Claude que
tenga conectado el Microsoft 365 del Servicio. Al terminar, traiga de vuelta el bloque
"Datos para integrar" que esa sesión debe entregarle.

---

Necesito que montes un registro central en Microsoft 365 para la aplicación
**Certificado de Ministro de Fe** del Servicio Local de Educación Pública Petorca
(Chile). La aplicación ya está hecha y funcionando: es un sitio estático en GitHub
Pages, sin autenticación, en
https://finanzas-slep-petorca.github.io/verificacion-documental/

La aplicación emite certificados de verificación documental de sets de pago para
rendición de cuentas ante la Contraloría General de la República. Hoy cada navegador
lleva su propio correlativo, así que dos equipos pueden emitir el mismo folio. Lo que
falta es la pieza del lado de Microsoft.

## Lo que tienes que crear

**1. Una lista de Microsoft (SharePoint)** llamada `Certificados Ministro de Fe`, en el
sitio del Subdepartamento de Finanzas, con estas columnas:

| Columna | Tipo |
|---|---|
| `Title` | Texto (una línea) |
| `Folio` | Texto |
| `Anio` | Número, 0 decimales, sin separador de miles |
| `Numero` | Número, 0 decimales |
| `CodigoMinistro` | Texto |
| `IdEmision` | Texto |
| `Ministro` | Texto |
| `MinistroRut` | Texto |
| `MinistroCargo` | Texto |
| `Programa` | Texto |
| `Naturaleza` | Texto |
| `Unidad` | Texto |
| `Referencia` | Texto |
| `FechaEmision` | Fecha y hora |
| `Estado` | Texto (`Emitido` / `Anulado`) |
| `MotivoAnulacion` | Varias líneas, texto sin formato |
| `FechaAnulacion` | Fecha y hora |
| `Datos` | Varias líneas, texto sin formato |

Indexa `CodigoMinistro`, `Anio` e `IdEmision`. Activa el historial de versiones.

**2. Un flujo de Power Automate** instantáneo, con desencadenador **Cuando se recibe
una solicitud HTTP** (método POST, esquema JSON vacío), que implemente el contrato de
más abajo.

Dos cosas que no son opcionales:

- En la configuración del desencadenador, activa **Control de simultaneidad** con grado
  de paralelismo **1**. Sin eso, dos emisiones simultáneas pueden obtener el mismo
  número, que es precisamente el problema que vinimos a resolver.
- **Toda** acción de Respuesta debe llevar los encabezados
  `Content-Type: application/json` y `Access-Control-Allow-Origin: *`, incluida la
  respuesta de error. Sin el segundo, el navegador no puede leer la respuesta y el
  Ministro de Fe queda sin saber qué pasó.

## Contrato que debe cumplir el flujo

La página envía siempre un POST con un cuerpo JSON que trae un campo `accion`. Puede
llegar con `Content-Type: application/json` o `text/plain` (la página reintenta como
texto plano si el preflight CORS falla), así que interpreta el cuerpo de forma que
funcione en ambos casos — por ejemplo con una acción Redactar cuyo valor sea
`json(string(triggerBody()))`.

### `ping`

Entrada: `{"accion":"ping"}` → Respuesta `200` con `{"ok":true}`.

### `emitir`

Entrada:

```json
{
  "accion": "emitir",
  "idEmision": "uuid del certificado",
  "anio": 2026,
  "prefijo": "CMF",
  "programaCodigo": "P01",
  "ministroCodigo": "GAB700",
  "ministroNombre": "...", "ministroRut": "...", "ministroCargo": "...",
  "programa": "Programa 01",
  "naturaleza": "Honorarios",
  "unidad": "...", "referencia": "...",
  "registro": { ...el certificado completo... }
}
```

Pasos:

1. Busca en la lista un elemento con ese `IdEmision`. **Si existe, devuelve su folio y
   termina.** Es el control de idempotencia: si la página reintenta por un corte de red,
   no puede consumirse un segundo número.
2. Si no existe, busca el mayor `Numero` para ese `CodigoMinistro` y ese `Anio`
   (filtro `CodigoMinistro eq '...' and Anio eq ...`, orden `Numero desc`, límite 1) y
   súmale 1. Si no hay ninguno, parte en 1.
3. Arma el folio: `prefijo-anio-programaCodigo-ministroCodigo-NNN`, con `NNN` de tres
   dígitos y ceros a la izquierda. Ejemplo: `CMF-2026-P01-GAB700-001`.
4. Crea el elemento con todas las columnas, `Estado` = `Emitido`, `FechaEmision` =
   `utcNow()` (la hora la pone el servidor, no el equipo de quien emite) y `Datos` =
   el objeto `registro` serializado como texto.
5. Responde `{"ok":true,"folio":"CMF-2026-P01-GAB700-001","numero":1}`.

**Importante sobre la numeración:** la serie corre por Ministro de Fe y año, **no** por
programa. El código de programa va dentro del folio para poder identificarlo después,
pero no abre una numeración propia. Un mismo ministro debe tener 001, 002, 003… en el
año, sin importar de qué programa sea cada certificado.

### `anular`

Entrada: `{"accion":"anular","idEmision":"...","folio":"...","motivo":"...","fechaAnulacion":"..."}`

Busca el elemento por `IdEmision`. Si no existe, responde `404` con
`{"ok":false,"error":"El folio no está en el registro del Servicio."}`. Si existe,
actualízalo con `Estado` = `Anulado`, `MotivoAnulacion` = el motivo recibido y
`FechaAnulacion` = `utcNow()`.

**No toques `Folio`, `Numero` ni `Anio`.** El número queda consumido a propósito: en un
correlativo de fe pública, un folio que vuelve a la fila significa que dos documentos
distintos pueden llevar el mismo número. Para rehacer el trabajo la aplicación duplica
el certificado y emite el folio siguiente.

Responde `{"ok":true,"folio":"..."}`.

### `listar`

Entrada: `{"accion":"listar"}`. Devuelve los certificados del año en curso, con
paginación activada, en este formato exacto:

```json
{
  "ok": true,
  "registros": [
    {
      "id": "<IdEmision>",
      "folio": "<Folio>",
      "ministerName": "<Ministro>",
      "ministerCode": "<CodigoMinistro>",
      "natureLabel": "<Naturaleza>",
      "unit": "<Unidad>",
      "reference": "<Referencia>",
      "status": "issued o cancelled, según Estado",
      "cancelReason": "<MotivoAnulacion>",
      "cancelledAt": "<FechaAnulacion>",
      "issuedAt": "<FechaEmision>",
      "updatedAt": "<FechaEmision>"
    }
  ]
}
```

Los nombres de los campos importan: la página los lee tal cual.

### Errores

Una Respuesta final configurada para ejecutarse **si falla** cualquier acción anterior,
con código `500`, cuerpo `{"ok":false,"error":"No fue posible registrar la emisión."}`
y el encabezado `Access-Control-Allow-Origin: *`.

## Antes de empezar, confírmame dos cosas

1. **Licencia.** El desencadenador "Cuando se recibe una solicitud HTTP" es un conector
   premium. Revisa si el Servicio tiene la licencia. Si no la tiene, dímelo y propón la
   alternativa equivalente (una Azure Function con CORS habilitado escribiendo en la
   misma lista por Microsoft Graph) antes de montar nada.
2. **Dónde.** En qué sitio de SharePoint conviene crear la lista, y quién queda como
   propietario.

## Cuando termines

Prueba el flujo desde su propio historial de ejecuciones con los cuatro casos: `ping`,
dos `emitir` seguidos del mismo ministro (deben dar 001 y 002), un `emitir` repetido con
el mismo `idEmision` (debe devolver el mismo folio, sin crear un segundo elemento), un
`anular` y un `listar`.

Después entrégame este bloque:

```text
DATOS PARA INTEGRAR
URL del flujo : <la URL HTTP POST del desencadenador>
Sitio y lista : <dónde quedó>
Licencia      : <premium confirmada, o la alternativa que montaste>
Pruebas       : <resultado de los cuatro casos>
Pendientes    : <lo que no pudiste hacer y por qué>
```

Trata la URL del flujo como una credencial: lleva una firma que permite escribir en la
lista. No la publiques ni la subas a ningún repositorio.
