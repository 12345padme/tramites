/* ==========================================================================
   Seguimiento de trámites — Lógica de la aplicación
   --------------------------------------------------------------------------
   - Guarda los trámites en localStorage (si el navegador lo permite).
   - Permite agregar, cambiar de estatus, eliminar, filtrar y buscar.
   - Calcula cuántos días faltan para la fecha límite de cada trámite.
   ========================================================================== */

(function () {
  'use strict';

  var CLAVE_ALMACEN = 'tramites.v1';
  var DIAS_ALERTA = 7;
  var MS_POR_DIA = 24 * 60 * 60 * 1000;

  var ESTATUS = {
    pendiente: 'Pendiente',
    proceso: 'En proceso',
    observado: 'Observado',
    concluido: 'Concluido'
  };

  // Estado de la aplicación
  var tramites = [];
  var filtroActivo = 'todos';
  var textoBusqueda = '';
  var ultimoEliminado = null;
  var temporizadorAviso = null;

  // Referencias al documento
  var formulario = document.getElementById('formulario');
  var mensajeError = document.getElementById('mensaje-error');
  var lista = document.getElementById('lista');
  var vacio = document.getElementById('vacio');
  var buscador = document.getElementById('buscador');
  var botonesFiltro = document.querySelectorAll('.filtro');
  var aviso = document.getElementById('aviso');
  var avisoTexto = document.getElementById('aviso-texto');
  var avisoDeshacer = document.getElementById('aviso-deshacer');

  /* ---------- Fechas ---------- */

  function hoy() {
    var ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  }

  // Convierte "2026-10-31" en una fecha local (sin desfase de zona horaria).
  function leerFecha(texto) {
    var partes = texto.split('-');
    return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  }

  function fechaISO(fecha) {
    var mes = String(fecha.getMonth() + 1).padStart(2, '0');
    var dia = String(fecha.getDate()).padStart(2, '0');
    return fecha.getFullYear() + '-' + mes + '-' + dia;
  }

  function fechaLegible(texto) {
    return leerFecha(texto).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function diasRestantes(texto) {
    return Math.round((leerFecha(texto) - hoy()) / MS_POR_DIA);
  }

  function textoPlazo(dias) {
    if (dias < 0) {
      return 'Venció hace ' + Math.abs(dias) + (dias === -1 ? ' día' : ' días');
    }
    if (dias === 0) {
      return 'Vence hoy';
    }
    return 'Faltan ' + dias + (dias === 1 ? ' día' : ' días');
  }

  /* ---------- Almacenamiento ---------- */

  function datosDeEjemplo() {
    function enDias(cantidad) {
      return fechaISO(new Date(hoy().getTime() + cantidad * MS_POR_DIA));
    }
    return [
      { id: 1, nombre: 'Licencia de uso de suelo', dependencia: 'Desarrollo Urbano', proyecto: 'Privada Los Almendros', estatus: 'proceso', fecha: enDias(5) },
      { id: 2, nombre: 'Factibilidad de agua potable', dependencia: 'Organismo operador de agua', proyecto: 'Privada Los Almendros', estatus: 'observado', fecha: enDias(12) },
      { id: 3, nombre: 'Manifestación de impacto ambiental', dependencia: 'Secretaría de Medio Ambiente', proyecto: 'Fraccionamiento El Ramonal', estatus: 'pendiente', fecha: enDias(30) },
      { id: 4, nombre: 'Factibilidad de energía eléctrica', dependencia: 'Comisión de electricidad', proyecto: 'Fraccionamiento El Ramonal', estatus: 'proceso', fecha: enDias(2) },
      { id: 5, nombre: 'Constancia de alineamiento', dependencia: 'Catastro Municipal', proyecto: 'Privada Los Almendros', estatus: 'concluido', fecha: enDias(-10) }
    ];
  }

  function cargar() {
    try {
      var guardado = window.localStorage.getItem(CLAVE_ALMACEN);
      if (guardado) {
        var datos = JSON.parse(guardado);
        if (Array.isArray(datos)) {
          return datos;
        }
      }
    } catch (error) {
      // Sin acceso al almacenamiento: la aplicación funciona solo en memoria.
    }
    return datosDeEjemplo();
  }

  function guardar() {
    try {
      window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(tramites));
    } catch (error) {
      // Se ignora: los cambios se conservan mientras la página esté abierta.
    }
  }

  /* ---------- Dibujo en pantalla ---------- */

  function crear(etiqueta, clase, texto) {
    var elemento = document.createElement(etiqueta);
    if (clase) {
      elemento.className = clase;
    }
    if (texto !== undefined) {
      elemento.textContent = texto;
    }
    return elemento;
  }

  function tramitesVisibles() {
    var busqueda = textoBusqueda.trim().toLowerCase();
    return tramites
      .filter(function (tramite) {
        if (filtroActivo !== 'todos' && tramite.estatus !== filtroActivo) {
          return false;
        }
        if (!busqueda) {
          return true;
        }
        var contenido = (tramite.nombre + ' ' + tramite.dependencia + ' ' + tramite.proyecto).toLowerCase();
        return contenido.indexOf(busqueda) !== -1;
      })
      .sort(function (a, b) {
        // Los concluidos van al final; el resto, por fecha límite más próxima.
        var aListo = a.estatus === 'concluido' ? 1 : 0;
        var bListo = b.estatus === 'concluido' ? 1 : 0;
        if (aListo !== bListo) {
          return aListo - bListo;
        }
        return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0;
      });
  }

  function dibujarTramite(tramite) {
    var fila = crear('li', 'tramite');

    var info = crear('div', 'tramite__info');
    info.appendChild(crear('div', 'tramite__nombre', tramite.nombre));
    info.appendChild(crear('div', 'tramite__detalle', tramite.dependencia + ' · ' + tramite.proyecto));
    fila.appendChild(info);

    var fecha = crear('div', 'tramite__fecha', fechaLegible(tramite.fecha));
    if (tramite.estatus !== 'concluido') {
      var dias = diasRestantes(tramite.fecha);
      var plazo = crear('span', 'tramite__plazo', textoPlazo(dias));
      if (dias <= DIAS_ALERTA) {
        plazo.classList.add('tramite__plazo--urgente');
      }
      fecha.appendChild(plazo);
    }
    fila.appendChild(fecha);

    var selector = crear('select', 'tramite__estatus estatus--' + tramite.estatus);
    selector.setAttribute('aria-label', 'Estatus de ' + tramite.nombre);
    Object.keys(ESTATUS).forEach(function (clave) {
      var opcion = crear('option', '', ESTATUS[clave]);
      opcion.value = clave;
      opcion.selected = clave === tramite.estatus;
      selector.appendChild(opcion);
    });
    selector.addEventListener('change', function () {
      tramite.estatus = selector.value;
      guardar();
      dibujar();
    });
    fila.appendChild(selector);

    var eliminar = crear('button', 'tramite__eliminar', '×');
    eliminar.type = 'button';
    eliminar.setAttribute('aria-label', 'Eliminar ' + tramite.nombre);
    eliminar.addEventListener('click', function () {
      eliminarTramite(tramite.id);
    });
    fila.appendChild(eliminar);

    return fila;
  }

  function dibujarResumen() {
    var enProceso = 0;
    var porVencer = 0;
    var concluidos = 0;

    tramites.forEach(function (tramite) {
      if (tramite.estatus === 'concluido') {
        concluidos += 1;
        return;
      }
      if (tramite.estatus === 'proceso') {
        enProceso += 1;
      }
      if (diasRestantes(tramite.fecha) <= DIAS_ALERTA) {
        porVencer += 1;
      }
    });

    document.getElementById('total-todos').textContent = tramites.length;
    document.getElementById('total-proceso').textContent = enProceso;
    document.getElementById('total-vencer').textContent = porVencer;
    document.getElementById('total-concluidos').textContent = concluidos;
  }

  function dibujar() {
    var visibles = tramitesVisibles();
    lista.textContent = '';
    visibles.forEach(function (tramite) {
      lista.appendChild(dibujarTramite(tramite));
    });
    vacio.hidden = visibles.length > 0;
    dibujarResumen();
  }

  /* ---------- Acciones ---------- */

  function mostrarAviso(texto) {
    avisoTexto.textContent = texto;
    aviso.hidden = false;
    window.clearTimeout(temporizadorAviso);
    temporizadorAviso = window.setTimeout(function () {
      aviso.hidden = true;
      ultimoEliminado = null;
    }, 6000);
  }

  function eliminarTramite(id) {
    var posicion = tramites.findIndex(function (tramite) {
      return tramite.id === id;
    });
    if (posicion === -1) {
      return;
    }
    ultimoEliminado = { tramite: tramites[posicion], posicion: posicion };
    tramites.splice(posicion, 1);
    guardar();
    dibujar();
    mostrarAviso('Trámite eliminado.');
  }

  avisoDeshacer.addEventListener('click', function () {
    if (ultimoEliminado) {
      tramites.splice(ultimoEliminado.posicion, 0, ultimoEliminado.tramite);
      ultimoEliminado = null;
      guardar();
      dibujar();
    }
    aviso.hidden = true;
  });

  formulario.addEventListener('submit', function (evento) {
    evento.preventDefault();

    var nombre = formulario.nombre.value.trim();
    var dependencia = formulario.dependencia.value.trim();
    var proyecto = formulario.proyecto.value.trim();
    var fecha = formulario.fecha.value;

    if (!nombre || !dependencia || !proyecto || !fecha) {
      mensajeError.textContent = 'Completa todos los campos, incluida la fecha límite.';
      mensajeError.hidden = false;
      return;
    }
    mensajeError.hidden = true;

    tramites.push({
      id: Date.now(),
      nombre: nombre,
      dependencia: dependencia,
      proyecto: proyecto,
      estatus: formulario.estatus.value,
      fecha: fecha
    });
    guardar();
    dibujar();
    formulario.reset();
    formulario.nombre.focus();
  });

  botonesFiltro.forEach(function (boton) {
    boton.addEventListener('click', function () {
      filtroActivo = boton.dataset.filtro;
      botonesFiltro.forEach(function (otro) {
        var activo = otro === boton;
        otro.classList.toggle('filtro--activo', activo);
        otro.setAttribute('aria-pressed', activo ? 'true' : 'false');
      });
      dibujar();
    });
  });

  buscador.addEventListener('input', function () {
    textoBusqueda = buscador.value;
    dibujar();
  });

  /* ---------- Inicio ---------- */

  tramites = cargar();
  dibujar();
})();
