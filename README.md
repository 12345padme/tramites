# Seguimiento de trámites

Aplicación web para registrar trámites y permisos, consultar su estatus y detectar a tiempo los que están por vencer. Está hecha con HTML, CSS y JavaScript, sin frameworks, y guarda la información en el navegador.

Este repositorio documenta el proceso de **empaquetado, versionamiento y despliegue** de la aplicación en un servidor Apache local.

**Versión actual:** 1.0.0

## Funciones de la aplicación

- Alta de trámites con dependencia, proyecto, estatus y fecha límite.
- Cambio de estatus: Pendiente, En proceso, Observado y Concluido.
- Indicadores de resumen y alerta de los trámites que vencen en 7 días o menos.
- Filtro por estatus y búsqueda por texto.
- Diseño adaptable a celular y escritorio.

## Estructura del proyecto

```
tramites/
├── src/                      Código fuente legible (aquí se trabaja)
│   ├── index.html
│   ├── css/estilos.css
│   ├── js/app.js
│   └── img/                  banner.png, logo.png, vacio.png
├── dist/                     Versión optimizada (la que se publica)
│   ├── index.html
│   ├── css/estilos.min.css
│   ├── js/app.min.js
│   └── img/                  banner.webp, logo.webp, vacio.webp
├── paquete/
│   └── tramites-v1.0.0.zip   Paquete listo para subir al servidor
├── servidor/
│   └── tramites.conf         Virtual Host de Apache
├── empaquetar.js             Script que genera dist/ y el .zip
├── package.json
└── README.md
```

## Proceso realizado

### 1. Organización de archivos

Los archivos se separaron por tipo en las carpetas `css`, `js` e `img`, y el `index.html` quedó en la raíz. Todas las rutas dentro del HTML son relativas (`css/estilos.css`, no `/css/estilos.css`) para que la aplicación funcione igual en la raíz de un dominio que dentro de una ruta como `/tramites`.

### 2. Optimización

El script `empaquetar.js` lee la carpeta `src` y genera la carpeta `dist` con estos cambios:

| Tipo | Herramienta | Qué hace |
|---|---|---|
| CSS | clean-css | Quita espacios, saltos de línea y comentarios, y combina reglas repetidas. |
| JavaScript | terser | Quita espacios y comentarios, y acorta los nombres de las variables internas. |
| HTML | html-minifier-terser | Quita espacios y comentarios, y cambia las referencias a los archivos `.min` y `.webp`. |
| Imágenes | sharp | Reduce cada imagen al tamaño con el que se muestra y la convierte de PNG a WebP. |

Resultado de la optimización:

| Archivo | Antes | Después | Reducción |
|---|---:|---:|---:|
| `css/estilos.css` → `estilos.min.css` | 8.5 KB | 5.9 KB | 31 % |
| `js/app.js` → `app.min.js` | 10.1 KB | 4.8 KB | 52 % |
| `img/banner.png` → `banner.webp` | 1,654.7 KB | 9.1 KB | 99 % |
| `img/logo.png` → `logo.webp` | 11.4 KB | 2.2 KB | 80 % |
| `img/vacio.png` → `vacio.webp` | 8.4 KB | 4.5 KB | 47 % |
| `index.html` | 5.5 KB | 4.4 KB | 20 % |
| **Total** | **1,698.6 KB** | **30.9 KB** | **98 %** |

La mayor parte del ahorro viene del banner: el original medía 2400 × 960 pixeles y en la página se muestra a un máximo de 1200 pixeles de ancho.

### 3. Empaquetado

Al terminar la optimización, el mismo script comprime la carpeta `dist` en `paquete/tramites-v1.0.0.zip` (22 KB). Dentro del `.zip` todo queda en una carpeta llamada `tramites`, de modo que al descomprimirlo en el servidor ya se tiene la estructura final:

```
tramites/
├── index.html
├── css/estilos.min.css
├── js/app.min.js
└── img/  (banner.webp, logo.webp, vacio.webp)
```

Para repetir el proceso:

```
npm install
npm run empaquetar
```

### 4. Versionamiento

El proyecto se versiona con Git y se publica en GitHub. Cada cambio se registró en un commit separado, con un mensaje que describe qué se hizo:

1. Agrega estructura inicial de la aplicación (HTML, CSS, JS e imágenes)
2. Agrega script de empaquetado: minificación y optimización de imágenes
3. Genera versión optimizada y paquete tramites-v1.0.0.zip
4. Agrega configuración del Virtual Host de Apache
5. Documenta el proceso de empaquetado, versionamiento y despliegue

La versión publicada se marcó con la etiqueta `v1.0.0`, siguiendo el esquema de versionado semántico (mayor.menor.parche). La carpeta `node_modules` no se sube al repositorio; está excluida en `.gitignore`.

### 5. Despliegue en Apache

Se usó Apache 2.4 (XAMPP para Windows). La configuración completa y comentada está en [`servidor/tramites.conf`](servidor/tramites.conf).

| Elemento | Valor |
|---|---|
| Puerto | 80 (`Listen 80` en `httpd.conf` y `<VirtualHost *:80>`) |
| Ruta web | `http://localhost/tramites` |
| Carpeta en disco | `C:\sitios\tramites` |
| Mapeo | `Alias /tramites "C:/sitios/tramites"` |
| Permisos | `Require all granted` en el bloque `<Directory>` |

Pasos:

1. Descomprimir `paquete/tramites-v1.0.0.zip` en `C:\sitios\`, para que quede `C:\sitios\tramites\index.html`.
2. Copiar el contenido de `servidor/tramites.conf` al final de `C:\xampp\apache\conf\extra\httpd-vhosts.conf`.
3. Comprobar que en `C:\xampp\apache\conf\httpd.conf` la línea `Include conf/extra/httpd-vhosts.conf` no esté comentada.
4. Validar la sintaxis con `C:\xampp\apache\bin\httpd.exe -t` (debe responder `Syntax OK`).
5. Iniciar o reiniciar Apache desde el panel de control de XAMPP.
6. Abrir `http://localhost/tramites` en el navegador.

## Herramientas

- HTML5, CSS3 y JavaScript
- Node.js con clean-css, terser, html-minifier-terser, sharp y archiver
- Git y GitHub
- Apache HTTP Server 2.4 (XAMPP)

## Autora

Jazmín Canto — Universidad Virtual del Estado de Guanajuato (UVEG)
