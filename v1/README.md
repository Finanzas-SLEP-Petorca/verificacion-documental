# Certificado de Ministro de Fe — SLEP Petorca

Formulario web de verificación documental del set de pago para rendición de cuentas. Permite a cualquier Ministro o Ministra de Fe completar el checklist correspondiente al tipo de set de pago, declarar la certificación y descargar un PDF listo para firmar en [FirmaGob](https://firmagob.gob.cl).

Es una única página (`index.html`, sin build ni dependencias de servidor) pensada para publicarse en **GitHub Pages**, de modo que quede abierta a todo Ministro de Fe sin necesidad de autenticación.

## Cómo funciona el registro de certificados

El formulario guarda los certificados generados en el `localStorage` del navegador de quien lo usa. Esto significa:

- **No requiere backend ni configuración externa** — funciona apenas se publica el HTML.
- El registro de certificados que se ve en la pestaña "Registro de certificados" es **local a cada computador/navegador**, no compartido entre distintos Ministros de Fe ni con Finanzas.
- La forma de compartir un certificado sigue siendo la prevista en el procedimiento: se descarga el PDF, se sube a FirmaGob para la firma electrónica, y se remite al Subdepartamento de Finanzas.

Si más adelante se quiere un registro realmente centralizado (visible para todos desde cualquier equipo), se necesitaría agregar un backend liviano (por ejemplo, un Google Sheet + Apps Script, o una base de datos como Firebase/Supabase). Avísame si quieres que lo implemente.

## Publicar en GitHub Pages

1. En GitHub, entra al repositorio → **Settings → Pages**.
2. En "Build and deployment", selecciona **Source: Deploy from a branch**.
3. Elige la rama que quieras publicar (por ejemplo `main`) y la carpeta `/ (root)`.
4. Guarda. GitHub entrega una URL pública del tipo `https://<usuario-u-organización>.github.io/<repositorio>/` en unos minutos.
5. Esa URL es la que se comparte con los Ministros y Ministras de Fe — no requiere login para usarla.

## Compartir el repositorio con tu equipo

Para que alguien de tu equipo pueda modificar el código (no solo usar el formulario):

1. Ve a **Settings → Collaborators and teams** en el repositorio.
2. Click en **Add people** (o **Add teams** si están en la misma organización de GitHub) e ingresa su usuario o correo de GitHub.
3. Asigna el rol de acceso (por ejemplo *Write*, para que pueda hacer commits y abrir pull requests).
4. La persona recibirá una invitación por correo/GitHub para aceptar el acceso.

No es necesario compartir credenciales ni tokens: cada persona usa su propia cuenta de GitHub. El formulario en sí (`index.html`) sigue sin pedir login a quienes solo lo usan vía GitHub Pages — el control de acceso de GitHub solo aplica a quienes editan el código fuente.
