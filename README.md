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
3. **Unidad o establecimiento.** Las 6 subdirecciones de la Unidad Central y los 68
   establecimientos del Servicio, agrupados por comuna y con su RBD.
4. **Documentación.** Se marca cada documento presente y se ingresa solo la numeración
   necesaria. Si algo falta o está incompleto se registra una excepción con su
   observación, en vez de dejarlo en blanco.
5. **Declaración y emisión.** Al emitir se asigna el folio y se abre la vista previa,
   desde donde se imprime o se guarda como PDF.

### Folio correlativo por Ministro de Fe

Cada Ministro de Fe tiene su propia numeración, con el formato `CÓDIGO-AÑO-NNN`:

```text
SAF103-2026-001
SAF103-2026-002
```

El folio se asigna **al emitir**, no al abrir el formulario, para que un formulario
abandonado no consuma un número.

### Borradores y registro

Un certificado se puede guardar como borrador, editarlo y retomarlo después. Los
emitidos no se editan: para corregir uno se duplica y se emite de nuevo, de modo que
quede la trazabilidad. La pestaña **Registro de certificados** permite buscar por folio,
unidad o referencia, y filtrar por ministro y por estado.

---

## Naturalezas y checklists

| | Naturaleza | Documentos |
|---|---|---|
| A | Remuneraciones | 7 |
| B | Honorarios | 5 |
| C | Servicios Básicos | 7 |
| D | Adquisiciones | 13, más los condicionales |
| E | Viáticos y cometidos funcionarios | 8 |

Algunos antecedentes aparecen solo cuando corresponden:

- **Factoring** (Adquisiciones): cesión y datos bancarios del cesionario.
- **Complementario D.1** (Adquisiciones): lista de asistencia, nómina de alumnas y
  alumnos preferentes o prioritarios, informe técnico y respaldo fotográfico, para
  prestaciones con participación de estudiantes o intervenciones de infraestructura.
- **Reembolso** (Viáticos): CDP y compromiso presupuestario por ese concepto.

Adquisiciones, Honorarios y Servicios Básicos incluyen además una tabla de **detalle de
documentos, folios y montos**, con total automático. El ítem **Otros** de Adquisiciones
abre una lista libre para individualizar qué lo compone.

---

## El certificado

1. Encabezado institucional con los logos del Servicio y del Ministerio.
2. Folio, fecha de emisión, naturaleza, unidad y referencia.
3. `I.` Identificación del set de pago.
4. `II.` Documentación verificada.
5. `II.a` Detalle del ítem "Otros", cuando corresponde.
6. `II.b` Detalle de documentos, folios y montos, cuando corresponde.
7. `III.` Declaración con su fundamento normativo.
8. Pie de firma del Ministro o Ministra de Fe.

Tamaño oficio (216 × 330 mm), con espacio reservado para la firma. La declaración cita
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

Los certificados se guardan en el `localStorage` del navegador. Esto sirve para uso
individual, pero **no** constituye un sistema institucional: cada navegador mantiene su
propio registro y sus propios correlativos, y los datos no se comparten entre equipos ni
entre personas.

Para un uso institucional se requiere backend con base de datos central, autenticación,
control compartido de correlativos y auditoría de emisión y anulación.

---

## Publicación

GitHub Pages sirve la rama configurada desde la raíz. Cada push actualiza el sitio
automáticamente en un par de minutos.
