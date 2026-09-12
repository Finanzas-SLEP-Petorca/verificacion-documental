# Certificado de Ministro de Fe — SLEP Petorca

Aplicación web estática, autocontenida y lista para publicar en **GitHub Pages**.  
El archivo `index.html` incluye HTML, CSS y JavaScript sin dependencias externas.

## Objetivo

Simplificar y acelerar la verificación documental de sets de pago mediante:

- Formulario único y dinámico.
- Checklist automático según la naturaleza del set.
- Menos escritura manual.
- Numeración personal por Ministro de Fe.
- Historial individual de certificados.
- Borradores.
- Emisión de certificado.
- Vista previa e impresión/guardado como PDF.
- Formato de certificado tipo **oficio (8,5 × 13 pulgadas / 216 × 330 mm)**.
- Espacio reservado para firma.

## Naturalezas incluidas

1. Remuneraciones.
2. Honorarios.
3. Servicios Básicos.
4. Adquisiciones.
5. Viáticos y cometidos funcionarios.

La estructura del formulario permanece fija.  
Al cambiar la naturaleza, se reemplaza automáticamente el checklist y aparecen únicamente los campos pertinentes.

---

## Principios funcionales

### 1. Checklist rápido

Se reemplaza la lógica visible `Sí / No / N/A` por un **ticket de verificación**.

- Documento correcto: marcar ✓.
- Si existe una excepción, abrir `Excepción`.
- Tipos de excepción:
  - Falta.
  - Incompleto.
  - No aplica.
  - Otro.
- La observación se solicita únicamente cuando existe una excepción.

Los documentos obligatorios **no vienen marcados por defecto**.

### 2. Solo se solicitan datos útiles

No se solicitan fechas de los documentos.

Cuando corresponda, el sistema pide solamente:

- N.º de Solicitud / REX.
- N.º de CDP.
- Subvención.
- N.º de Orden de Compra.
- N.º de Compromiso.
- N.º de Factura / Boleta.
- N.º de Resolución.
- Datos mínimos de factoring.

### 3. Correlativo personal por Ministro de Fe

Cada Ministro de Fe posee:

- Nombre.
- Código.
- Cargo / unidad.
- Correlativo propio.

Ejemplo:

```text
FS-2026-001
FS-2026-002
FS-2026-003
```

El folio definitivo se asigna **al emitir**, no al abrir el formulario.

Esto evita saltos por formularios abandonados.

### 4. Historial personal

Al seleccionar un Ministro de Fe se muestra al costado:

- Código.
- Último correlativo emitido.
- Últimos certificados.
- Folio.
- Naturaleza.
- Unidad / establecimiento.
- Estado.
- Acciones:
  - Ver.
  - Duplicar.

Los certificados emitidos no se editan directamente.  
Un error debe resolverse mediante anulación o nueva emisión para mantener trazabilidad.

### 5. Borradores

Los borradores pueden:

- Guardarse.
- Editarse.
- Eliminarse.
- Duplicarse.

El prototipo guarda la información en `localStorage` del navegador.

> Para uso institucional multiusuario se recomienda reemplazar `localStorage` por una base de datos y autenticación.

---


## Lista desplegable de Ministros de Fe — P01 Unidad Central

La aplicación incorpora una lista maestra de **18 funcionarios P01 Unidad Central**.

En el formulario existen dos listas desplegables sincronizadas:

- **Ministro de Fe — Nombre**
- **Ministro de Fe — Código**

El usuario puede seleccionar desde cualquiera de las dos. Al elegir un funcionario por **nombre** o por **código**, el sistema autocompleta inmediatamente:

- Nombre completo.
- Código.
- RUT.
- Unidad.
- Cargo.

El código P01 del funcionario también sirve como identificador del correlativo personal del Ministro de Fe.

Ejemplo:

```text
SAF103-2026-001
SAF103-2026-002
SAF103-2026-003
```

La **Unidad del Ministro de Fe** no reemplaza la **Unidad / Establecimiento del set**: ambas se mantienen separadas porque representan información distinta.

Los datos del Ministro de Fe se muestran además en el PDF, incluyendo:

- Nombre.
- Código.
- RUT.
- Unidad.
- Cargo.
- Correlativo personal.

### Funcionarios incorporados

| Código | Nombre |
|---|---|
| GAB700 | Alejandro Barrientos Rojas |
| GDA801 | Yhana Morales Villacorta |
| GAB701 | Camilo Díaz Irirate |
| PCG305 | Abraham Allel Altamirano |
| PCG303 | Gerard Díaz Jiménez |
| PCG302 | Paula Opazo Tobar |
| GDP203 | Catalina González Fernández |
| GDP202 | Felipe Palacios Zamora |
| GDP201 | Ana Abarca Gannat |
| UATP500 | Estefany Cisternas Oliarte |
| UATP501 | Carolina Villagra Marín |
| UATP502 | Nataly Venegas Peña |
| INF400 | Valentina Rojas Pacholec |
| INF404 | Catalina Bobadilla Rocco |
| INF405 | Joaquín Bustamante Fiabane |
| SAF103 | Daniela González Campos |
| SAF104 | Andre Rubio Apiolaza |
| SAF105 | Camilo Hodges Carrasco |

---

# Checklist por naturaleza

## A. Adquisiciones

| N.º | Documento | Datos adicionales |
|---|---|---|
| 01 | Solicitud de Compra / REX | Tipo + N.º |
| 02 | CDP | N.º + Subvención |
| 03 | Orden de Compra | N.º OC |
| 04 | Compromiso | N.º |
| 05 | Recepción Conforme | — |
| 06 | Recepción Conforme Mercado Público | — |
| 07 | Datos Bancarios | — |
| 08 | Factura | N.º |
| 09 | Cesión Factoring | Cesionario + RUT + referencia |
| 10 | Datos Bancarios Factoring | Verificación |

Los puntos 09 y 10 aparecen únicamente cuando se selecciona:

```text
Factura cedida a factoring = Sí
```

## B. Honorarios

| N.º | Documento | Datos adicionales |
|---|---|---|
| 01 | Resolución que aprueba convenio / prestación | N.º |
| 02 | Informe de actividades o productos entregados | — |
| 03 | Boleta de honorarios | N.º |
| 04 | CDP | N.º + Subvención |
| 05 | Requerimiento Presupuestario | N.º |

## C. Servicios Básicos

| N.º | Documento | Datos adicionales |
|---|---|---|
| 01 | REX que aprueba pago de consumos básicos | N.º |
| 02 | CDP | N.º + Subvención |
| 03 | Requerimiento | N.º |
| 04 | Boletas | Detalle de folios y montos |
| 05 | Cupones de pago, cuando aplique | — |
| 06 | Resolución de intereses, cuando corresponda | N.º |
| 07 | Compromiso Presupuestario | N.º |

## D. Viáticos y cometidos funcionarios

| N.º | Documento | Datos adicionales |
|---|---|---|
| 01 | Resolución que aprueba el cometido | N.º |
| 02 | Programa / itinerario / invitación | — |
| 03 | Informe de cometido o actividades | — |
| 04 | Rendición de gastos de traslado | Detalle |
| 05 | CDP por cometido | N.º + Subvención |
| 06 | Requerimiento Presupuestario | N.º |
| 07 | CDP por reembolso | N.º + Subvención |
| 08 | Compromiso por reembolso | N.º |

Los puntos 07 y 08 aparecen solamente cuando:

```text
Existe reembolso = Sí
```

## E. Remuneraciones

Datos generales:

- Período.
- Monto total, si corresponde.

Checklist:

| N.º | Documento |
|---|---|
| 01 | Maestro de Remuneraciones |
| 02 | Informe de Centralización |
| 03 | Gasto por Fuente de Financiamiento |
| 04 | Asiento Contable |
| 05 | Sentencias Judiciales, cuando corresponda |
| 06 | Excel de Retenciones Judiciales, cuando corresponda |
| 07 | Archivo TXT, cuando aplique |

Los antecedentes especiales pueden mostrarse únicamente cuando corresponden.

---

# PDF / certificado

El certificado mantiene siempre la misma estructura:

1. Encabezado institucional.
2. Identificación del certificado.
3. Identificación del set de pago.
4. Documentación verificada.
5. Declaración.
6. Ministro de Fe.
7. Espacio reservado para firma.

La tabla documental cambia automáticamente según la naturaleza seleccionada.

## Tamaño

```css
@page {
  size: 8.5in 13in;
}
```

El diseño deja una zona inferior libre para firma.

## Datos bancarios

El certificado no imprime números de cuenta ni información bancaria sensible.  
Solo indica:

```text
Datos Bancarios — Verificados
```

---

# Estructura del repositorio

```text
/
├── index.html
└── README.md
```

Opcionalmente se pueden agregar logos reales:

```text
/assets/
├── logo-slep-petorca.png
└── logo-mineduc.png
```

El prototipo funciona sin ellos utilizando encabezados tipográficos.

---

# Publicación en GitHub Pages

1. Crear un repositorio nuevo.
2. Subir:
   - `index.html`
   - `README.md`
3. Abrir:
   `Settings → Pages`
4. En `Build and deployment` elegir:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guardar.
6. GitHub publicará una URL similar a:

```text
https://usuario.github.io/nombre-del-repositorio/
```

---

# Funcionamiento del prototipo

El archivo `index.html` implementa:

- Navegación:
  - Nuevo certificado.
  - Registro de certificados.
- Formulario dinámico.
- Historial por Ministro.
- Correlativo personal.
- Borradores.
- Duplicación.
- Vista previa del certificado.
- Emisión.
- Impresión / Guardar como PDF.
- Persistencia en `localStorage`.

## Datos maestros

Los Ministros de Fe están definidos en la constante:

```javascript
const MINISTERS = [...]
```

Cada registro contiene:

```text
id, code, name, rut, unit, cargo, role
```

La versión actual ya incorpora los 18 funcionarios P01 entregados.


---

# Recomendaciones para una versión institucional

Antes de usar en producción, incorporar:

- Login institucional.
- Roles y permisos.
- Base de datos central.
- Auditoría de creación, emisión y anulación.
- Sincronización multiusuario.
- Respaldo de certificados.
- Firma electrónica.
- Gestión segura de datos personales.
- Registro de anulaciones.
- Bloqueo de certificados emitidos.
- Versionado de plantillas.
- Exportación y búsqueda avanzada.
- API o backend institucional.

## Regla recomendada de integridad

Un certificado solo puede emitirse cuando:

- Existe Ministro de Fe seleccionado.
- Existe naturaleza.
- Existe unidad / establecimiento.
- Todos los documentos obligatorios están:
  - verificados, o
  - cuentan con una excepción registrada.
- Los documentos que requieren número contienen su identificación.
- La declaración está aceptada.

---

# Nota técnica

Este repositorio es un **prototipo funcional frontend**.

`localStorage` es adecuado para demostración o uso individual en un navegador, pero no para un sistema institucional multiusuario. Para producción, la información debe persistirse en un backend seguro.
