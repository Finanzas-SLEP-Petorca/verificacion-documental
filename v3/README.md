# Certificado de Ministro de Fe — V3 (combinada)

Versión que toma la arquitectura de la **V2** (formulario de una sola pantalla, lista
maestra de Ministros de Fe, correlativo personal, borradores y registro) y le devuelve
los elementos institucionales y normativos que la V2 no traía.

Aplicación estática autocontenida: un solo `index.html`, sin dependencias externas.

---

## Qué cambia respecto de la V2

### 1. Logo institucional real
La V2 usaba un encabezado tipográfico ("PETORCA" en texto). La V3 incorpora el logo
oficial del SLEP Petorca (PNG en base64, 1000×325 px) tanto en el encabezado de la
aplicación como en el certificado impreso, respetando su proporción real.

### 2. Directorio real de unidades y establecimientos
Las opciones de ejemplo ("Escuela X", "Liceo X") se reemplazan por el directorio
completo, agrupado con `<optgroup>`:

| Grupo | Opciones |
|---|---|
| Unidad Central | 6 subdirecciones |
| Cabildo | 18 establecimientos |
| La Ligua | 30 establecimientos |
| Papudo | 5 establecimientos |
| Petorca | 15 establecimientos |

Cada establecimiento se muestra como `NOMBRE — RBD 1180-0`. Los jardines infantiles y
salas cuna sin RBD asignado aparecen solo con su nombre.

> Fuente: directorio de establecimientos del SLEP Petorca
> (`monitoreo-petorca/visores-slep-petorca`, visor de directorio).

### 3. Declaración con respaldo normativo
La declaración genérica de la V2 se reemplaza por el texto con las referencias legales,
ubicado al final del certificado, inmediatamente antes del pie de firma:

- Resolución Exenta N° 450, de 2026, del Servicio Local (procedimiento de
  autentificación documental y respaldo de rendición de cuentas), artículos 5° y 6°.
- Artículo 2 N°15 y artículo 27 de la Resolución N° 2, de 2026, de la Contraloría
  General de la República.
- Principio de segregación de funciones del artículo 2° letra h) de la misma
  Resolución Exenta N° 450.

### 4. Checklist de Adquisiciones según la especificación vigente
Se recuperan los documentos que la V2 había omitido y se conservan los que aportaba:

| N.º | Documento | Datos que pide |
|---|---|---|
| 01 | Resolución o decreto que aprueba la contratación | Modalidad (Convenio Marco / Licitación Pública / Trato Directo) + N.º |
| 02 | Solicitud de Compra / REX | Tipo + N.º + Acción y Dimensión PME (opcionales, para gasto SEP) |
| 03 | CDP | N.º + Subvención |
| 04 | Compromiso Presupuestario | N.º |
| 05 | Orden de Compra | N.º OC |
| 06 | F30, cuando corresponda | N.º (opcional) |
| 07 | F30-1, cuando corresponda | N.º (opcional) |
| 08 | Recepción Conforme (Servicio) | — |
| 09 | Recepción Conforme (Establecimiento / Director o Directora) | — |
| 10 | Recepción Conforme Mercado Público | — |
| 11 | Datos Bancarios | — |
| 12 | Documento/s Tributario/s (Factura) | N.º |
| 13 | Otros | Lista libre de antecedentes |
| 14–15 | Cesión Factoring · Datos Bancarios Factoring | Solo si hay factoring |
| 16–19 | Complementario D.1 | Solo si aplica |

Honorarios, Servicios Básicos, Viáticos y Remuneraciones se mantienen como en la V2:
ya coincidían con la especificación.

### 5. Complementos recuperados

**Complementario D.1** — nuevo interruptor "¿Aplica complementario D.1?" para
adquisiciones con participación de estudiantes y/o infraestructura. Al activarlo se
suman cuatro documentos: lista de asistencia, nómina de alumnos y alumnas
preferentes/prioritarios, informe técnico y respaldo fotográfico.

**Detalle de documentos, folios y montos** — tabla repetible (tipo, folio, fecha de
emisión, monto) con total calculado automáticamente, disponible en Adquisiciones,
Honorarios y Servicios Básicos. Se imprime como sección II.b del certificado.

**Detalle del ítem "Otros"** — al marcar el documento "Otros" aparece una lista libre
para individualizar los antecedentes que lo componen. Se imprime como sección II.a.
Si se marca "Otros" sin detallar nada, la emisión se bloquea.

### 6. Corrección de la impresión (bug de la V2)
El CSS de impresión de la V2 dejaba el modal en `position:fixed` y el certificado en
`position:absolute`. Al imprimir, el contenido se recortaba a una página y esa misma
página se repetía: un certificado con complementario D.1 salía en 4 páginas idénticas y
**nunca llegaba a imprimir la declaración ni la firma**.

La V3 devuelve el modal y el certificado al flujo normal del documento, oculta el resto
de la aplicación con `display:none` en vez de `visibility:hidden` (que dejaba páginas en
blanco) y evita cortes dentro de las tablas y del bloque de firma.

---

## Estructura del certificado

1. Encabezado institucional con logo oficial.
2. Folio, fecha de emisión, naturaleza, unidad y referencia.
3. `I.` Identificación del set de pago.
4. `II.` Documentación verificada.
5. `II.a` Detalle del ítem "Otros", cuando corresponde.
6. `II.b` Detalle de documentos, folios y montos, cuando corresponde.
7. `III.` Declaración con las referencias normativas.
8. Pie de firma del Ministro de Fe.

Tamaño oficio (216 × 330 mm), con zona inferior reservada para la firma.

---

## Persistencia

Igual que la V2: `localStorage` del navegador. Sirve para uso individual y para
evaluar el flujo, pero **no** para un sistema institucional multiusuario. Cada
navegador mantiene su propio registro y sus propios correlativos.

Para producción se requiere backend con base de datos central, autenticación,
control de correlativos compartido y auditoría de emisión y anulación.
