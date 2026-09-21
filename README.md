# Certificado de Ministro de Fe — SLEP Petorca

Aplicación web para la verificación documental de sets de pago destinados a rendición de
cuentas ante la Contraloría General de la República.

**En línea:** https://finanzas-slep-petorca.github.io/verificacion-documental/

Es un sitio estático: `index.html` con todo el HTML, CSS y JavaScript, más el logo
institucional en `assets/`. No requiere servidor, instalación ni autenticación: cualquier
Ministro o Ministra de Fe abre el enlace y lo usa.

---

## Cómo funciona

### Emitir un certificado

1. **Ministro de Fe.** Se elige por nombre o por código, indistintamente: las dos listas
   están sincronizadas y al seleccionar en cualquiera se completan solos el RUT, la
   unidad y el cargo.
2. **Naturaleza del set.** Al elegirla se carga el checklist correspondiente y aparecen
   únicamente los campos pertinentes.
3. **Programa presupuestario y financiamiento.** De dónde sale el gasto se declara al
   principio, junto al programa, y no documento por documento. La lista y el rótulo
   cambian con el programa, porque sólo el 02 se financia por subvenciones:

   | Programa | Rótulo | Opciones |
   |---|---|---|
   | 01 y Extrapresupuestario | Financiamiento | RESTO · Remuneración P01 · Fondos No Ley · Otros Ingresos P01 |
   | 02 | Subvención | SUBV. GENERAL · PIE · SEP · FAEP · JUNJI · MANTENIMIENTO · PRORETENCIÓN · RESTO · OTRO |

   Es obligatorio en los tres. La opción abierta de cada lista —*Otros Ingresos P01* y
   *OTRO*— exige además describir por escrito de qué se trata. Con el extrapresupuestario
   se pide también el nombre del programa.
4. **Unidad o establecimiento.** Las 6 subdirecciones de la Unidad Central y los 68
   establecimientos del Servicio, agrupados por comuna y con su RBD.
5. **Documentación.** Se marca cada documento presente y se ingresa solo la numeración
   necesaria. Si algo falta o está incompleto se registra una excepción con su
   observación, en vez de dejarlo en blanco.
6. **Declaración y emisión.** Al emitir se asigna el folio y se abre la vista previa,
   desde donde se imprime o se guarda como PDF.

### Borrador y definitivo

Solo **Emitir certificado** produce el documento válido: pasa la validación completa y
recibe su folio correlativo.

**Vista previa PDF** no valida nada, así que todo lo que se imprima desde ahí sale con
la marca de agua **BORRADOR** en diagonal sobre cada hoja, con "BORRADOR / SIN FOLIO" en
lugar del folio. Además, la vista previa muestra arriba la lista de antecedentes que
faltan para poder emitir. Así un borrador impreso no puede confundirse con el
certificado definitivo ni adjuntarse al set de pago como tal.

Un certificado ya emitido, visto luego desde el registro, se imprime limpio: es el
definitivo.

### Folio correlativo por Ministro de Fe

Cada Ministro de Fe tiene su propia numeración, con el formato
`CMF-AÑO-PROGRAMA-CÓDIGO-NNN`:

```text
CMF-2026-P01-GAB700-001
CMF-2026-P02-GAB700-002
CMF-2026-P01-SAF103-001
```

- `P01`, `P02` y `EXT` corresponden al Programa 01, al Programa 02 y al
  extrapresupuestario.
- La serie corre **por Ministro de Fe y año**, no por programa: el programa describe el
  certificado, no abre una numeración propia. Si cada programa tuviera su serie, un mismo
  ministro tendría dos certificados "001" en el mismo año.

El folio se asigna **al emitir**, no al abrir el formulario, para que un formulario
abandonado no consuma un número.

### Anulación

Un certificado emitido no se edita ni se elimina: se **anula**. La anulación pide un
motivo, que queda impreso en el certificado y guardado en el registro.

El folio **sigue consumido**: no se reasigna a otro certificado. Es lo que corresponde
en un correlativo de fe pública — si el número volviera a la fila, dos documentos
distintos podrían llevar el mismo folio y se perdería la trazabilidad de lo emitido.

Un certificado anulado se imprime con la marca de agua **ANULADO** y con la constancia
de su anulación en el encabezado, de modo que no pueda adjuntarse al set de pago por
error.

Para rehacer el trabajo se usa **Duplicar**: los antecedentes ya cargados se conservan
en un borrador nuevo, que al emitirse toma el folio siguiente. El ciclo completo es
*emitir → anular → duplicar → emitir*, y no se pierde nada de lo hecho.

### Borradores y registro

Un certificado se puede guardar como borrador, editarlo y retomarlo después. La pestaña
**Registro de certificados** permite buscar por folio, unidad o referencia, y filtrar
por ministro y por estado.

---

## Naturalezas y checklists

| | Naturaleza | Documentos |
|---|---|---|
| A | Remuneraciones | 7 |
| B | Honorarios | 5 |
| C | Servicios Básicos | 6 |
| D | Adquisiciones | 12, más los condicionales |
| E | Viáticos y cometidos funcionarios | 8 |

Algunos antecedentes aparecen solo cuando corresponden:

- **Factoring** (Adquisiciones): cesión y datos bancarios del cesionario.
- **Complementario D.1** (Adquisiciones): lista de asistencia, nómina de alumnas y
  alumnos preferentes o prioritarios, informe técnico y respaldo fotográfico. Se exige
  solo con Programa 02 y subvención SEP, PRORETENCIÓN o PIE — las de uso finalizado—,
  y se deduce del financiamiento ya declarado en vez de preguntarse.
- **Acción y dimensión del PME** (Solicitud de Compra / REX, en Adquisiciones): se piden
  solo con subvención SEP, y entonces son obligatorias.
- **Reembolso** (Viáticos): CDP y compromiso presupuestario por ese concepto.

Adquisiciones, Honorarios y Servicios Básicos incluyen además una tabla de **detalle de
documentos, folios y montos**, con total automático.

El tipo de documento ofrece los cinco más usados —factura electrónica, factura exenta
electrónica, boleta, boleta de honorarios y nota de crédito— y acepta cualquier otro
texto. Cuando los
documentos son muchos, el botón **Descargar plantilla** entrega un archivo para llenar
en Excel e **Importar planilla** lo incorpora a la tabla. Se leen `.xlsx` y `.csv`, con
las fechas en cualquiera de los formatos de uso corriente y los montos como se escriben
en Chile. Antes de agregar nada se muestra cuántos documentos se leyeron, por qué monto
y qué filas quedaron fuera; las que ya están en la tabla no se repiten, de modo que
importar dos veces el mismo archivo no duplica montos. El folio de cada documento va ahí: pedirlo además como
antecedente propio era repetirlo, así que se retiraron las **boletas** de Servicios
Básicos y los **documentos tributarios** de Adquisiciones. Los certificados emitidos cuando sí se pedía se siguen reimprimiendo tal
como se emitieron, con sus boletas en el lugar que ocupaban. El ítem **Otros** de Adquisiciones
abre una lista libre para individualizar qué lo compone.

---

## El certificado

1. Encabezado institucional con los logos del Servicio y del Ministerio.
2. Folio, fecha de emisión, naturaleza, programa, financiamiento, unidad y referencia.
3. `I.` Identificación del set de pago.
4. `II.` Documentación verificada.
5. `II.a` Detalle del ítem "Otros", cuando corresponde.
6. `II.b` Detalle de documentos, folios y montos, cuando corresponde.
7. `III.` Declaración con su fundamento normativo.
8. Identificación de quien certifica, en una línea: nombre, RUT, cargo y calidad.

Tamaño oficio (216 × 330 mm), con los 50 mm inferiores de cada hoja libres: ahí
DocDigital estampa su banda de pie al exportar el documento firmado —QR, referencia a
la ley N° 19.799 y enlace al validador—, medida en y 308,6 → 325,4 mm sobre un
documento del Servicio ya firmado.

El documento se firma en DocDigital y quien firma ubica el timbre donde quiera. Bajo la
identificación quedan siempre al menos 45 mm libres, que es más de lo que ocupa el
estampado —unos 87 × 37 mm, medidos sobre un documento del Servicio ya firmado—. La
fecha, la identificación y ese espacio forman un solo bloque: si no caben, pasan juntos
a la hoja siguiente, en vez de dejar al que firma sin dónde estampar.

La declaración cita
la Resolución Exenta N° 450, de 2026, del Servicio Local (artículos 5° y 6°), el artículo
2 N°15 y el artículo 27 de la Resolución N° 2, de 2026, de la Contraloría General de la
República, y el principio de segregación de funciones del artículo 2° letra h).

El certificado no imprime números de cuenta ni información bancaria sensible: solo deja
constancia de que los datos bancarios fueron verificados.

---

## Estructura del repositorio

```text
/
├── index.html          Aplicación (versión vigente)
├── assets/
│   └── logo-mineduc.png
├── v1/                 Versión anterior, conservada (ver más abajo)
├── v2/                 Prototipo intermedio
└── v3/                 Redirige a la raíz
```

### Sobre `/v1/`

La versión anterior se conserva por una razón concreta: guardaba los certificados en
`localStorage` bajo una clave distinta a la actual. Esos registros siguen en el navegador
de quien los creó, pero solo esa página sabe leerlos. Si alguien necesita recuperar un
certificado emitido con la versión anterior, debe abrir `/v1/`.

---

## Persistencia

Los borradores se guardan siempre en el `localStorage` del navegador. Los certificados
emitidos, en cambio, dependen de si hay registro central configurado.

### Sin registro central

Cada navegador mantiene su propio registro y sus propios correlativos. Sirve para uso
individual, pero **no** es un sistema institucional: dos equipos pueden emitir el mismo
folio y nadie ve el registro completo. La aplicación lo advierte en pantalla.

### Con registro central

El correlativo lo asigna el Servicio, no el navegador, y cada emisión queda en una lista
de Microsoft 365 en el SharePoint del SLEP. El registro muestra entonces también los
certificados emitidos en otros equipos: se pueden abrir e imprimir igual que los
propios —el certificado completo se pide al Servicio al abrirlo— pero no editarlos,
duplicarlos ni anularlos desde ahí. Eso le corresponde a quien los emitió.

Si el registro central está configurado y no responde, la aplicación **no emite**:
avisa el motivo y sugiere guardar el borrador y reintentar. Un folio repetido en un
documento que va a la Contraloría es peor que esperar.

La dirección del servicio no viaja en este repositorio, que es público: cada Ministro de
Fe la pega una vez en **Registro de certificados → Configurar** y queda guardada en su
navegador.

El montaje está en [`docs/registro-central.md`](docs/registro-central.md).

---

## Publicación

GitHub Pages sirve la rama configurada desde la raíz. Cada push actualiza el sitio
automáticamente en un par de minutos.
