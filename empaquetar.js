/* ==========================================================================
   empaquetar.js — Prepara la aplicación para subirla al servidor
   --------------------------------------------------------------------------
   Uso:  npm run empaquetar

   Toma el código legible de /src y genera:
     1. /dist     → versión optimizada (CSS, JS y HTML minificados; imágenes
                    redimensionadas y convertidas a WebP).
     2. /paquete  → archivo .zip con la estructura final lista para el servidor.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const { minify: minificarJS } = require('terser');
const { minify: minificarHTML } = require('html-minifier-terser');
const sharp = require('sharp');
const archiver = require('archiver');

const { name: NOMBRE, version: VERSION } = require('./package.json');

const ORIGEN = path.join(__dirname, 'src');
const DESTINO = path.join(__dirname, 'dist');
const PAQUETE = path.join(__dirname, 'paquete');

// Ancho final de cada imagen (en pixeles). Se elige según el tamaño con el
// que realmente se muestra en la página, considerando pantallas de alta densidad.
const IMAGENES = [
  { archivo: 'banner.png', ancho: 1200, calidad: 72 },
  { archivo: 'logo.png', ancho: 112, calidad: 90 },
  { archivo: 'vacio.png', ancho: 320, calidad: 85 }
];

const reporte = [];

function peso(ruta) {
  return fs.statSync(ruta).size;
}

function registrar(nombre, antes, despues) {
  reporte.push({
    Archivo: nombre,
    'Antes (KB)': (antes / 1024).toFixed(1),
    'Después (KB)': (despues / 1024).toFixed(1),
    'Reducción': Math.round((1 - despues / antes) * 100) + ' %'
  });
}

async function procesarCSS() {
  const entrada = path.join(ORIGEN, 'css', 'estilos.css');
  const salida = path.join(DESTINO, 'css', 'estilos.min.css');
  const resultado = new CleanCSS({ level: 2 }).minify(fs.readFileSync(entrada, 'utf8'));
  if (resultado.errors.length) {
    throw new Error('Error al minificar CSS: ' + resultado.errors.join(', '));
  }
  fs.writeFileSync(salida, resultado.styles);
  registrar('css/estilos.css → estilos.min.css', peso(entrada), peso(salida));
}

async function procesarJS() {
  const entrada = path.join(ORIGEN, 'js', 'app.js');
  const salida = path.join(DESTINO, 'js', 'app.min.js');
  const resultado = await minificarJS(fs.readFileSync(entrada, 'utf8'), {
    compress: true,
    mangle: true
  });
  fs.writeFileSync(salida, resultado.code);
  registrar('js/app.js → app.min.js', peso(entrada), peso(salida));
}

async function procesarImagenes() {
  for (const imagen of IMAGENES) {
    const entrada = path.join(ORIGEN, 'img', imagen.archivo);
    const nombreFinal = imagen.archivo.replace('.png', '.webp');
    const salida = path.join(DESTINO, 'img', nombreFinal);
    await sharp(entrada)
      .resize({ width: imagen.ancho })
      .webp({ quality: imagen.calidad })
      .toFile(salida);
    registrar('img/' + imagen.archivo + ' → ' + nombreFinal, peso(entrada), peso(salida));
  }
}

async function procesarHTML() {
  const entrada = path.join(ORIGEN, 'index.html');
  const salida = path.join(DESTINO, 'index.html');

  // El HTML final debe apuntar a los archivos optimizados.
  let html = fs.readFileSync(entrada, 'utf8')
    .replace('css/estilos.css', 'css/estilos.min.css')
    .replace('js/app.js', 'js/app.min.js')
    .replace(/img\/(banner|logo|vacio)\.png/g, 'img/$1.webp')
    .replace('type="image/png"', 'type="image/webp"');

  html = await minificarHTML(html, {
    collapseWhitespace: true,
    removeComments: true
  });
  fs.writeFileSync(salida, html);
  registrar('index.html', peso(entrada), peso(salida));
}

function comprimir() {
  return new Promise((resolver, rechazar) => {
    const rutaZip = path.join(PAQUETE, NOMBRE + '-v' + VERSION + '.zip');
    const salida = fs.createWriteStream(rutaZip);
    const zip = archiver('zip', { zlib: { level: 9 } });

    salida.on('close', () => resolver(rutaZip));
    zip.on('error', rechazar);

    zip.pipe(salida);
    // Dentro del .zip todo queda en una carpeta con el nombre de la aplicación.
    zip.directory(DESTINO, NOMBRE);
    zip.finalize();
  });
}

async function principal() {
  // Se parte siempre de carpetas limpias para no arrastrar archivos viejos.
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.rmSync(PAQUETE, { recursive: true, force: true });
  for (const carpeta of ['css', 'js', 'img']) {
    fs.mkdirSync(path.join(DESTINO, carpeta), { recursive: true });
  }
  fs.mkdirSync(PAQUETE, { recursive: true });

  await procesarCSS();
  await procesarJS();
  await procesarImagenes();
  await procesarHTML();

  const totalAntes = reporte.reduce((suma, fila) => suma + Number(fila['Antes (KB)']), 0);
  const totalDespues = reporte.reduce((suma, fila) => suma + Number(fila['Después (KB)']), 0);
  reporte.push({
    Archivo: 'TOTAL',
    'Antes (KB)': totalAntes.toFixed(1),
    'Después (KB)': totalDespues.toFixed(1),
    'Reducción': Math.round((1 - totalDespues / totalAntes) * 100) + ' %'
  });

  console.log('\nOptimización terminada:');
  console.table(reporte);

  const rutaZip = await comprimir();
  console.log('Paquete generado: ' + path.relative(__dirname, rutaZip) +
    ' (' + (peso(rutaZip) / 1024).toFixed(1) + ' KB)\n');
}

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
