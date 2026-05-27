// =============================
// MAPA INICIAL
// =============================
var map = L.map('map', { zoomControl: true }).setView([6.6059244912397475, -75.4262229265968], 13);

// =============================
// MAPAS BASE
// =============================
var baseLayers = {
    dark: L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 }
    ),
    light: L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 }
    ),
    imagery: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri' }
    ),
    imagery2: L.tileLayer(
        'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        { attribution: 'Google Satellite', maxZoom: 20 }
    ),
    osm: L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap' }
    )
};

var mapaBaseActivo = 'dark';
baseLayers.dark.addTo(map);

var mapasBaseConfig = [
    { key: 'dark',     nombre: 'Mapa Oscuro',      icono: '🌑' },
    { key: 'light',    nombre: 'Mapa Claro',        icono: '🌕' },
    { key: 'imagery',  nombre: 'Satélite (Esri)',   icono: '🛰️' },
    { key: 'imagery2', nombre: 'Satélite (Google)', icono: '🌍' },
    { key: 'osm',      nombre: 'OpenStreetMap',     icono: '🗺️' }
];

// =============================
// CONFIGURACIÓN DE CAPAS
// =============================
var capasConfig = [
    { key: 'r_lc_construccion',       nombre: 'r_lc_construccion',       url: 'DATA/r_lc_construccion.json',       grupo: 'Rural',      tipo: 'poly',  color: '#ff6363' },
    { key: 'r_lc_terreno',            nombre: 'r_lc_terreno',            url: 'DATA/r_lc_terreno.json',            grupo: 'Rural',      tipo: 'line',  color: '#f5a623' },
    { key: 'u_lc_construccion',       nombre: 'u_lc_construccion',       url: 'DATA/u_lc_construccion.geojson',    grupo: 'Urbano',     tipo: 'poly',  color: '#4f7cff' },
    { key: 'Manzanas',                nombre: 'Manzanas',                url: 'DATA/Manzanas.json',                grupo: 'Urbano',     tipo: 'poly',  color: '#3dd68c' },
    { key: 'u_lc_terreno',            nombre: 'u_lc_terreno',            url: 'DATA/u_lc_Terreno.json',            grupo: 'Urbano',     tipo: 'line',  color: '#c084fc' },
    { key: 'Hoyorrico',               nombre: 'Hoyorrico',               url: 'DATA/hoyorrico.json',               grupo: 'Referencia', tipo: 'point', color: '#fba66a' },
    { key: 'Vias',                    nombre: 'Vias',                    url: 'DATA/Vias.json',                    grupo: 'Referencia', tipo: 'line',  color: '#88817b' },
    { key: 'Curvas_Nivel',            nombre: 'Curvas_Nivel',            url: 'DATA/Curvas_Nivel.json',            grupo: 'Referencia', tipo: 'line',  color: '#ffba7d' },
    { key: 'Drenaje_Sencillo',        nombre: 'Drenaje_Sencillo',        url: 'DATA/Drenaje_Sencillo.json',        grupo: 'Referencia', tipo: 'line',  color: '#5bc8f5' },
    { key: 'Buffer_Drenaje_Sencillo', nombre: 'Buffer_Drenaje_Sencillo', url: 'DATA/Buffer_Drenaje_Sencillo.json', grupo: 'Referencia', tipo: 'poly',  color: '#fd1313' }
];

var capasGeoJSON = {};
var capasLeaflet = {};
var capasEstado  = {};
var capasFeatureIndex = {};
var featureLayerIndex = {};
var seleccionMapa = null;
var grupoCapasGeograficas = L.layerGroup().addTo(map);

// =============================
// MODO DÍA / NOCHE
// =============================
var temaActual = 'dark';

function toggleTheme() {
    temaActual = temaActual === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', temaActual);

    var btnTheme = document.getElementById('btnTheme');
    var iconDark = document.getElementById('themeIconDark');
    var iconLight = document.getElementById('themeIconLight');
    var label = document.getElementById('themeLabel');

    if (temaActual === 'light') {
        iconDark.style.display  = 'none';
        iconLight.style.display = '';
        label.textContent = 'Modo noche';
        btnTheme.classList.add('active');
        if (mapaBaseActivo === 'dark') activarMapaBase('light');
    } else {
        iconDark.style.display  = '';
        iconLight.style.display = 'none';
        label.textContent = 'Modo día';
        btnTheme.classList.remove('active');
        if (mapaBaseActivo === 'light') activarMapaBase('dark');
    }
    pcToast('Tema cambiado: ' + (temaActual === 'dark' ? 'Noche 🌑' : 'Día ☀️'));
}

// =============================
// SIDEBAR — TOGGLE SECCIONES
// =============================
function sbToggle(sectionId) {
    var sec = document.getElementById(sectionId);
    if (!sec) return;
    sec.classList.toggle('open');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    setTimeout(function() { map.invalidateSize(); }, 270);
}

document.addEventListener('DOMContentLoaded', function() {
    ['sbSecBase', 'sbSecCapas', 'sbSecConsulta'].forEach(function(id) {
        var s = document.getElementById(id);
        if (s) s.classList.add('open');
    });
});

// =============================
// GEOCODER — Nominatim
// =============================
var geocoderTimeout;
var geocoderMarker = null;
var geocoderFocusedIndex = -1;
var geocoderData = [];

function geocoderOnInput(val) {
    clearTimeout(geocoderTimeout);
    var box = document.getElementById('geocoderResults');
    if (val.length < 3) { box.classList.remove('open'); return; }
    geocoderTimeout = setTimeout(function() { geocoderSearch(val); }, 350);
}

function geocoderSearch(q) {
    var box = document.getElementById('geocoderResults');
    box.innerHTML = '<div class="geocoder-loading">Buscando...</div>';
    box.classList.add('open');
    var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=6&accept-language=es';
    fetch(url, { headers: { 'Accept-Language': 'es' } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            geocoderData = data;
            geocoderFocusedIndex = -1;
            if (!data || data.length === 0) {
                box.innerHTML = '<div class="geocoder-loading">Sin resultados para "' + q + '"</div>';
                return;
            }
            box.innerHTML = '';
            data.forEach(function(item, i) {
                var parts = item.display_name.split(',');
                var name = parts.slice(0,2).join(',').trim();
                var sub  = parts.slice(2,5).join(',').trim();
                var el = document.createElement('div');
                el.className = 'geocoder-item';
                el.dataset.index = i;
                el.innerHTML =
                    '<div class="geocoder-item-icon">' +
                    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                    '</div>' +
                    '<div class="geocoder-item-text">' +
                    '<span class="geocoder-item-name">' + name + '</span>' +
                    '<span class="geocoder-item-sub">' + sub + '</span>' +
                    '</div>';
                el.addEventListener('click', function() { geocoderGoTo(i); });
                box.appendChild(el);
            });
        })
        .catch(function() {
            box.innerHTML = '<div class="geocoder-loading">Error al buscar</div>';
        });
}

function geocoderGoTo(index) {
    var item = geocoderData[index];
    if (!item) return;
    var lat = parseFloat(item.lat);
    var lon = parseFloat(item.lon);
    if (geocoderMarker) map.removeLayer(geocoderMarker);
    var icon = L.divIcon({
        html: '<div style="background:var(--accent,#4f7cff);width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(79,124,255,.7);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: ''
    });
    geocoderMarker = L.marker([lat, lon], { icon: icon })
        .addTo(map)
        .bindPopup(
            '<b style="font-family:var(--font-main,sans-serif);font-size:12px;">' + item.display_name.split(',').slice(0,2).join(',') + '</b>' +
            '<br><span style="color:var(--text-dim,#888);font-size:10px;">' + item.display_name.split(',').slice(2,5).join(',') + '</span>' +
            '<br><span style="color:var(--accent,#4f7cff);font-size:10px;">📍 ' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '</span>'
        )
        .openPopup();
    map.flyTo([lat, lon], 15, { animate: true, duration: 1.2 });
    document.getElementById('geocoderResults').classList.remove('open');
    document.getElementById('geocoderInput').value = item.display_name.split(',').slice(0,2).join(',');
    pcToast('📍 ' + item.display_name.split(',')[0]);
}

function geocoderKeydown(e) {
    var box = document.getElementById('geocoderResults');
    var items = box.querySelectorAll('.geocoder-item');
    if (!box.classList.contains('open') || items.length === 0) {
        if (e.key === 'Enter') {
            var val = document.getElementById('geocoderInput').value;
            if (val.length >= 3) geocoderSearch(val);
        }
        return;
    }
    if (e.key === 'ArrowDown') {
        geocoderFocusedIndex = Math.min(geocoderFocusedIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
        geocoderFocusedIndex = Math.max(geocoderFocusedIndex - 1, 0);
    } else if (e.key === 'Enter') {
        if (geocoderFocusedIndex >= 0) geocoderGoTo(geocoderFocusedIndex);
        else if (geocoderData.length > 0) geocoderGoTo(0);
        return;
    } else if (e.key === 'Escape') {
        box.classList.remove('open'); return;
    }
    items.forEach(function(el, i) {
        el.classList.toggle('focused', i === geocoderFocusedIndex);
    });
    if (geocoderFocusedIndex >= 0) items[geocoderFocusedIndex].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('click', function(e) {
    if (!document.getElementById('geocoderWrap').contains(e.target)) {
        document.getElementById('geocoderResults').classList.remove('open');
    }
});

// ═══════════════════════════════════════════════════════
// LÍNEA DE TIEMPO
// ═══════════════════════════════════════════════════════
var tlPlaying = false;
var tlPlayInterval = null;

// Eventos catastrales reales para Hoyorrico / Santa Rosa de Osos
var tlEventosCatastro = [
    { año: 2010, tipo: 'catastro',      label: 'Catastro base IGAC 2010',              color: 'green' },
    { año: 2012, tipo: 'cambio', label: 'Cambio predial sector norte', color: 'red'   },
    { año: 2016, tipo: 'normativo',     label: 'POT Municipio Santa Rosa de Osos',      color: 'amber' },
    { año: 2018, tipo: 'cambio', label: 'Actualización predial vía principal',            color: 'red'   },
    { año: 2019, tipo: 'cambio', label: 'Actualización sector norte',               color: 'red'   },
    { año: 2021, tipo: 'catastro',      label: 'Actualización catastral multipropósito', color: 'green' },
    { año: 2023, tipo: 'normativo',     label: 'Resolución UPRA minifundio',             color: 'amber' },
    { año: 2024, tipo: 'cambio', label: 'Alerta catastral activa',            color: 'red'   }
];

function toggleTimeline(forceState) {
    var panel = document.getElementById('panelTimeline');
    var btn   = document.getElementById('btnTimeline');
    if (!panel || !btn) return;

    var isVisible = window.getComputedStyle(panel).display !== 'none';
    var shouldShow = (typeof forceState === 'boolean') ? forceState : !isVisible;

    if (shouldShow) {
        panel.style.display = 'block';
        panel.classList.add('is-open');
        btn.classList.add('active');
        tlUpdate();
    } else {
        panel.style.display = 'none';
        panel.classList.remove('is-open');
        btn.classList.remove('active');
        tlPausePlay();
    }

    document.documentElement.style.setProperty('--timeline-h', shouldShow ? panel.offsetHeight + 'px' : '0px');
    setTimeout(function() { map.invalidateSize(); }, 80);
}

function cerrarTimelineConEscape(e) {
    if (e.key === 'Escape') toggleTimeline(false);
}
document.addEventListener('keydown', cerrarTimelineConEscape);

function tlUpdate() {
    var s = parseInt(document.getElementById('tlSliderStart').value);
    var e = parseInt(document.getElementById('tlSliderEnd').value);
    if (s > e) { var t=s; s=e; e=t; }
    document.getElementById('tlYearLabel').textContent = s + ' → ' + e;

    var min = 2010, max = 2024, span = max - min;
    var leftPct  = ((s - min) / span) * 100;
    var widthPct = ((e - s)   / span) * 100;
    var range = document.getElementById('tlRange');
    if (range) {
        range.style.left  = leftPct + '%';
        range.style.width = widthPct + '%';
    }
    tlActualizarImagenesVisibles(s, e);

    pcToast('Periodo: ' + s + ' – ' + e);
}

function tlTogglePlay() {
    if (tlPlaying) { tlPausePlay(); } else { tlStartPlay(); }
}

function tlStartPlay() {
    tlPlaying = true;
    document.getElementById('tlPlayIco').style.display   = 'none';
    document.getElementById('tlPauseIco').style.display  = '';
    document.getElementById('tlPlayLabel').textContent   = 'Pausar';
    var endSlider = document.getElementById('tlSliderEnd');
    var minVal = 2010, maxVal = 2024;
    endSlider.value = minVal;
    tlUpdate();
    tlPlayInterval = setInterval(function() {
        var cur = parseInt(endSlider.value);
        if (cur >= maxVal) { tlPausePlay(); return; }
        endSlider.value = cur + 1;
        tlUpdate();
    }, 900);
}

function tlPausePlay() {
    tlPlaying = false;
    clearInterval(tlPlayInterval);
    document.getElementById('tlPlayIco').style.display  = '';
    document.getElementById('tlPauseIco').style.display = 'none';
    document.getElementById('tlPlayLabel').textContent  = 'Reproducir';
}


// Imágenes históricas vinculadas a la línea de tiempo
var tlImagenesHistoricas = [];
var tlImagenSeq = 1;

function tlAgregarImagen() {
    var yearInput = document.getElementById('tlImageYear');
    var nameInput = document.getElementById('tlImageName');
    var urlInput  = document.getElementById('tlImageUrl');
    var fileInput = document.getElementById('tlImageFile');
    var year = parseInt(yearInput.value, 10);
    if (isNaN(year)) { pcToast('Defina el año de la imagen'); return; }

    var file = fileInput && fileInput.files && fileInput.files[0];
    var url = urlInput ? urlInput.value.trim() : '';
    if (!file && !url) { pcToast('Seleccione un archivo o pegue una URL de imagen'); return; }

    var nombre = (nameInput && nameInput.value.trim()) || (file ? file.name : 'Imagen ' + year);
    if (file) {
        tlRegistrarImagen(year, nombre, URL.createObjectURL(file), true);
        fileInput.value = '';
    } else {
        tlRegistrarImagen(year, nombre, url, false);
        urlInput.value = '';
    }
    if (nameInput) nameInput.value = '';
}

function tlRegistrarImagen(year, nombre, url, esLocal) {
    var item = {
        id: 'tl-img-' + (tlImagenSeq++),
        year: year,
        nombre: nombre,
        url: url,
        esLocal: esLocal,
        bounds: map.getBounds(),
        opacity: 0.65,
        layer: null
    };
    tlImagenesHistoricas.push(item);
    tlRenderImagenes();
    tlUpdate();
    pcToast('Imagen agregada al año ' + year);
}

function tlCrearOverlayImagen(item) {
    if (item.layer) return item.layer;
    item.layer = L.imageOverlay(item.url, item.bounds, {
        opacity: item.opacity,
        interactive: true,
        zIndex: 25
    });
    item.layer.bindPopup('<b>' + escaparHtml(item.nombre) + '</b><br>Año: ' + item.year);
    return item.layer;
}

function tlActualizarImagenesVisibles(añoBase, añoComp) {
    tlImagenesHistoricas.forEach(function(item) {
        var visible = item.year >= añoBase && item.year <= añoComp;
        var layer = tlCrearOverlayImagen(item);
        if (visible) {
            if (!map.hasLayer(layer)) layer.addTo(map);
            layer.setOpacity(item.opacity);
        } else if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    tlRenderImagenes();
}

function tlRenderImagenes() {
    var list = document.getElementById('tlImageList');
    var count = document.getElementById('tlImageCount');
    var activeLabel = document.getElementById('tlActiveImageLabel');
    if (!list) return;
    if (count) count.textContent = tlImagenesHistoricas.length;
    if (tlImagenesHistoricas.length === 0) {
        list.innerHTML = '<div class="tl-media-empty">Sin imágenes cargadas. Ajusta el mapa, define el año y agrega una imagen para verla como capa histórica.</div>';
        if (activeLabel) activeLabel.textContent = 'Sin imagen activa';
        return;
    }
    var s = parseInt(document.getElementById('tlSliderStart').value, 10);
    var e = parseInt(document.getElementById('tlSliderEnd').value, 10);
    if (s > e) { var t = s; s = e; e = t; }
    var activas = tlImagenesHistoricas.filter(function(item) { return item.year >= s && item.year <= e; });
    if (activeLabel) {
        activeLabel.textContent = activas.length ? activas.length + ' imagen(es) en el rango' : 'Sin imagen en este rango';
    }
    list.innerHTML = tlImagenesHistoricas.map(function(item) {
        var active = item.year >= s && item.year <= e;
        return '<div class="tl-media-card ' + (active ? 'active' : '') + '" id="tlrow-' + item.id + '">' +
            '<div class="tl-media-card-top">' +
            '<span class="tl-media-year">' + item.year + '</span>' +
            '<span class="tl-media-name" title="' + escaparHtml(item.nombre) + '">' + escaparHtml(item.nombre) + '</span>' +
            '</div>' +
            '<input type="range" min="0" max="100" value="' + Math.round(item.opacity * 100) + '" oninput="tlSetImagenOpacidad(\'' + item.id + '\', this.value)">' +
            '<div class="tl-media-actions">' +
            '<button class="tl-image-action" onclick="tlCentrarImagen(\'' + item.id + '\')">Ver</button>' +
            '<button class="tl-image-action" onclick="tlQuitarImagen(\'' + item.id + '\')">Quitar</button>' +
            '</div>' +
            '</div>';
    }).join('');
}
function tlSetImagenOpacidad(id, val) {
    var item = tlImagenesHistoricas.find(function(i) { return i.id === id; });
    if (!item) return;
    item.opacity = Math.max(0, Math.min(100, parseInt(val, 10) || 0)) / 100;
    if (item.layer && map.hasLayer(item.layer)) item.layer.setOpacity(item.opacity);
}

function tlCentrarImagen(id) {
    var item = tlImagenesHistoricas.find(function(i) { return i.id === id; });
    if (!item) return;
    document.getElementById('tlSliderStart').value = item.year;
    document.getElementById('tlSliderEnd').value = item.year;
    tlUpdate();
    map.fitBounds(item.bounds);
    if (item.layer) item.layer.openPopup();
}

function tlQuitarImagen(id) {
    var idx = tlImagenesHistoricas.findIndex(function(i) { return i.id === id; });
    if (idx < 0) return;
    var item = tlImagenesHistoricas[idx];
    if (item.layer && map.hasLayer(item.layer)) map.removeLayer(item.layer);
    if (item.esLocal) URL.revokeObjectURL(item.url);
    tlImagenesHistoricas.splice(idx, 1);
    tlRenderImagenes();
    pcToast('Imagen retirada de la línea de tiempo');
}
// POPUP DESDE ATRIBUTOS
// ═══════════════════════════════════════════════════
function popupDesdeAtributos(feature) {
    if (!feature.properties) return 'Sin atributos';
    var campos = Object.keys(feature.properties || {});
    if (typeof tablaEstado !== 'undefined' && tablaEstado.camposVisibles && tablaEstado.camposVisibles.length) {
        var visibles = tablaEstado.camposVisibles.filter(function(c) { return campos.indexOf(c) !== -1; });
        if (visibles.length) campos = visibles;
    } else if (typeof obtenerCamposClave === 'function') {
        campos = obtenerCamposClave(campos);
    }
    var html = '<div class="popup-ficha"><div class="popup-ficha-title">Ficha del registro</div>';
    campos.forEach(function(campo) {
        var valor = feature.properties[campo];
        html += '<div class="popup-ficha-row"><span>' + escaparHtml(campo) + '</span><strong>' + escaparHtml(valor == null ? 'Sin dato' : valor) + '</strong></div>';
    });
    html += '</div>';
    return html;
}

// ═══════════════════════════════════════════════════
// ESTILO INICIAL POR TIPO
// ═══════════════════════════════════════════════════
function escaparHtml(valor) {
    return String(valor == null ? '' : valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function registrarFeatureCapa(config, feature, layer) {
    if (!capasFeatureIndex[config.key]) capasFeatureIndex[config.key] = [];
    var id = config.key + '-' + capasFeatureIndex[config.key].length;
    feature._gcId = id;
    layer._gcKey = config.key;
    layer._gcId = id;
    capasFeatureIndex[config.key].push({ id: id, feature: feature, layer: layer });
    featureLayerIndex[id] = { key: config.key, feature: feature, layer: layer };
    layer.bindPopup(popupDesdeAtributos(feature));
    layer.on('click', function() { seleccionarFeatureMapa(config.key, id, true); });
}

function setCapaVisibleDesdeCodigo(key, visible) {
    if (!capasEstado[key] || !capasLeaflet[key]) return;
    capasEstado[key].visible = visible;
    var row = document.getElementById('pcrow-' + key);
    var btn = document.getElementById('pcvis-' + key);
    if (row) row.classList.toggle('pc-hidden', !visible);
    if (btn) { btn.classList.toggle('visible', visible); btn.innerHTML = svgOjo(visible); }
    if (visible) {
        grupoCapasGeograficas.addLayer(capasLeaflet[key]);
        if (tablaEstado && tablaEstado.key === key) aplicarEstiloTablaAlMapa();
    } else {
        grupoCapasGeograficas.removeLayer(capasLeaflet[key]);
    }
    actualizarToggleGrupoPorCapa(key);
    actualizarContadorCapas();
}

function actualizarToggleGrupoPorCapa(key) {
    var row = document.getElementById('pcrow-' + key);
    if (!row) return;
    var grupoId = row.dataset.grupo;
    var filas = document.querySelectorAll('[data-grupo="' + grupoId + '"]');
    var algunaVisible = Array.prototype.some.call(filas, function(f) {
        return capasEstado[f.dataset.nombre] && capasEstado[f.dataset.nombre].visible;
    });
    var toggle = document.getElementById('pcgt-' + grupoId);
    if (toggle) {
        toggle.classList.toggle('active', algunaVisible);
        toggle.innerHTML = algunaVisible ? svgCheck() : '';
    }
}

function resetSeleccionMapa() {
    if (!seleccionMapa) return;
    var anterior = seleccionMapa;
    if (capasLeaflet[anterior.key] && anterior.layer) {
        try { capasLeaflet[anterior.key].resetStyle(anterior.layer); } catch(e) {}
    }
    seleccionMapa = null;
}

function seleccionarFeatureDesdeTabla(key, id) {
    seleccionarFeatureMapa(key, id, false);
    if (tablaEstado && tablaEstado.key === key && tablaEstado.aislarSeleccion) aplicarEstiloTablaAlMapa();
}

function seleccionarFeatureMapa(key, id, desdeMapa) {
    var item = featureLayerIndex[id];
    if (!item) return;
    if (!capasEstado[key] || !capasEstado[key].visible) setCapaVisibleDesdeCodigo(key, true);

    resetSeleccionMapa();
    seleccionMapa = { key: key, id: id, layer: item.layer };
    if (item.layer.setStyle) {
        item.layer.setStyle({ color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.65, opacity: 1, weight: 4, radius: 8 });
        if (item.layer.bringToFront) item.layer.bringToFront();
    }
    if (item.layer.openPopup) item.layer.openPopup();

    var selector = document.getElementById('selectorCapa');
    if (selector && selector.value !== key) selector.value = key;

    var tabla = document.getElementById('tablaAtributos');
    if (tabla && tabla.style.display !== 'none') {
        var capa = obtenerCapaSeleccionada();
        if (capa && capa.key === key && (!tablaEstado || tablaEstado.key !== key)) mostrarTablaAtributos(capa.data, capa.titulo, capa.key);
        if (tablaEstado && tablaEstado.key === key) seleccionarRegistroTabla(key, id, true);
        else resaltarFilaTabla(id);
    }
}

function resaltarFilaTabla(id) {
    document.querySelectorAll('#tablaContenido tr.row-selected').forEach(function(row) {
        row.classList.remove('row-selected');
    });
    var row = document.querySelector('#tablaContenido tr[data-feature-id="' + id + '"]');
    if (row) {
        row.classList.add('row-selected');
        row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
}
function estiloInicial(config) {
    if (config.tipo === 'line')  return { color: config.color, weight: 2.5, opacity: 1 };
    if (config.tipo === 'point') return { color: config.color, fillColor: config.color, fillOpacity: 0.5, weight: 1.5, radius: 6 };
    return { color: config.color, fillColor: config.color, fillOpacity: 0.35, weight: 1.5, opacity: 1 };
}

// ═══════════════════════════════════════════════════
// CARGAR CAPA GEOJSON
// ═══════════════════════════════════════════════════
function cargarCapa(config) {
    capasEstado[config.key] = {
        visible:   false,
        color:     config.color,
        fillColor: config.color,
        opacity:   config.tipo === 'poly' ? 35 : 100,
        weight:    config.tipo === 'line' ? 2.5 : 1.5
    };
    fetch(config.url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            capasGeoJSON[config.key] = data;
            capasFeatureIndex[config.key] = [];
            var estilo = estiloInicial(config);
            var layer;
            if (config.tipo === 'point') {
                layer = L.geoJSON(data, {
                    pointToLayer: function(feature, latlng) { return L.circleMarker(latlng, estilo); },
                    onEachFeature: function(feature, layer) { registrarFeatureCapa(config, feature, layer); }
                });
            } else {
                layer = L.geoJSON(data, {
                    style: estilo,
                    onEachFeature: function(feature, layer) { registrarFeatureCapa(config, feature, layer); }
                });
            }
            capasLeaflet[config.key] = layer;
            if (capasEstado[config.key] && capasEstado[config.key].visible) {
                grupoCapasGeograficas.addLayer(layer);
            }
            renderizarFilaCapa(config);
            actualizarContadorCapas();
        })
        .catch(function(err) { console.error('Error al cargar ' + config.url + ':', err); });
}

// ═══════════════════════════════════════════════════
// PANEL DE CAPAS — RENDER
// ═══════════════════════════════════════════════════
function renderizarFilaCapa(config) {
    var scroll  = document.getElementById('pcLayersScroll');
    var grupoId = 'pcg-' + config.grupo.toLowerCase().replace(/\s/g, '-');
    var grupoEl = document.getElementById(grupoId);
    if (!grupoEl) {
        grupoEl = crearGrupoPanel(config.grupo, grupoId);
        scroll.appendChild(grupoEl);
    }
    var lista      = grupoEl.querySelector('.pc-layer-list');
    var badgeClass = config.tipo === 'poly' ? 'pc-badge-poly' : config.tipo === 'line' ? 'pc-badge-line' : 'pc-badge-point';
    var badgeLabel = config.tipo === 'poly' ? 'Pol.' : config.tipo === 'line' ? 'Lín.' : 'Pto';
    var estado     = capasEstado[config.key];

    var controlesExtra = '';
    if (config.tipo === 'poly') {
        controlesExtra = `
        <div class="pc-ctrl-row">
            <span class="pc-ctrl-label">Relleno</span>
            <div class="pc-fill-wrap">
                <span class="pc-fill-label">Color:</span>
                <div class="pc-swatch" id="pcsf-${config.key}" style="background:${estado.fillColor}">
                    <input type="color" value="${estado.fillColor}" oninput="pcCambiarRelleno(this,'${config.key}')">
                </div>
            </div>
        </div>`;
    }

    var row = document.createElement('div');
    row.className      = 'pc-layer-row' + (estado.visible ? '' : ' pc-hidden');
    row.id             = 'pcrow-' + config.key;
    row.dataset.nombre = config.key;
    row.dataset.grupo  = grupoId;

    row.innerHTML = `
        <div class="pc-layer-top">
            <button class="pc-vis-btn ${estado.visible ? 'visible' : ''}" id="pcvis-${config.key}" onclick="pcToggleVis(this,'${config.key}')">
                ${svgOjo(estado.visible)}
            </button>
            <div class="pc-swatch" id="pcsc-${config.key}" style="background:${estado.color}">
                <input type="color" value="${estado.color}" oninput="pcCambiarColor(this,'${config.key}')">
            </div>
            <span class="pc-layer-name">${config.nombre}</span>
            <span class="pc-badge ${badgeClass}">${badgeLabel}</span>
            <button class="pc-expand-btn" onclick="pcToggleExpand('${config.key}')">
                <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
            </button>
        </div>
        <div class="pc-layer-controls">
            <div class="pc-ctrl-row">
                <span class="pc-ctrl-label">Opacidad</span>
                <input type="range" class="pc-range" min="0" max="100" value="${estado.opacity}"
                    oninput="pcCambiarOpacidad(this,'${config.key}')">
                <span class="pc-ctrl-val" id="pcop-${config.key}">${estado.opacity}%</span>
            </div>
            <div class="pc-ctrl-row">
                <span class="pc-ctrl-label">${config.tipo === 'point' ? 'Radio' : 'Trazo'}</span>
                <input type="number" class="pc-num" min="0" max="20" step="0.5" value="${estado.weight}"
                    oninput="pcCambiarTrazo(this,'${config.key}')">
                <span class="pc-ctrl-label" style="width:auto;color:var(--text-dim)">px</span>
            </div>
            ${controlesExtra}
        </div>
    `;
    lista.appendChild(row);
}

function crearGrupoPanel(nombre, grupoId) {
    var div = document.createElement('div');
    div.className = 'pc-group';
    div.id        = grupoId;
    div.innerHTML = `
        <div class="pc-group-header" onclick="pcToggleGrupo('${grupoId}')">
            <div class="pc-group-toggle" id="pcgt-${grupoId}"
                onclick="event.stopPropagation(); pcToggleGrupoVis('${grupoId}')">
                
            </div>
            <span class="pc-group-name">${nombre}</span>
            <svg class="pc-group-chev open" id="pcgchev-${grupoId}" width="10" height="10"
                fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6"/>
            </svg>
        </div>
        <div class="pc-layer-list" id="pcgl-${grupoId}"></div>
    `;
    return div;
}

// ═══════════════════════════════════════════════════
// GRUPO MAPAS BASE EN SIDEBAR
// ═══════════════════════════════════════════════════
function renderizarGrupoMapasBase() {
    var lista = document.getElementById('sbBaseList');
    if (!lista) return;
    mapasBaseConfig.forEach(function(cfg) {
        var row = document.createElement('div');
        row.className = 'sb-base-row' + (cfg.key === mapaBaseActivo ? ' active' : '');
        row.id = 'sbbaserow-' + cfg.key;
        row.onclick = function() { activarMapaBase(cfg.key); };
        row.innerHTML = `
            <div class="sb-radio ${cfg.key === mapaBaseActivo ? 'active' : ''}" id="sbradio-${cfg.key}"></div>
            <span class="sb-base-name">${cfg.icono} ${cfg.nombre}</span>
        `;
        lista.appendChild(row);
    });
}

function activarMapaBase(key) {
    Object.keys(baseLayers).forEach(function(k) {
        map.removeLayer(baseLayers[k]);
        var radio = document.getElementById('sbradio-' + k);
        var row   = document.getElementById('sbbaserow-' + k);
        if (radio) radio.classList.remove('active');
        if (row)   row.classList.remove('active');
    });
    baseLayers[key].addTo(map);
    mapaBaseActivo = key;
    var radioActivo = document.getElementById('sbradio-' + key);
    var rowActivo   = document.getElementById('sbbaserow-' + key);
    if (radioActivo) radioActivo.classList.add('active');
    if (rowActivo)   rowActivo.classList.add('active');
    pcToast('Mapa: ' + (mapasBaseConfig.find(function(c){ return c.key === key; }) || {}).nombre);
}

// ═══════════════════════════════════════════════════
// SVG HELPERS
// ═══════════════════════════════════════════════════
function svgOjo(v) {
    if (v) return '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    return '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}
function svgCheck() {
    return '<svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
}

// ═══════════════════════════════════════════════════
// ACCIONES DE CAPA
// ═══════════════════════════════════════════════════
function pcToggleVis(btn, key) {
    var estado = capasEstado[key];
    var row    = document.getElementById('pcrow-' + key);
    estado.visible = !estado.visible;
    btn.classList.toggle('visible', estado.visible);
    btn.innerHTML = svgOjo(estado.visible);
    row.classList.toggle('pc-hidden', !estado.visible);
    if (capasLeaflet[key]) {
        if (estado.visible) grupoCapasGeograficas.addLayer(capasLeaflet[key]);
        else                grupoCapasGeograficas.removeLayer(capasLeaflet[key]);
    }
    actualizarContadorCapas();
}
function pcCambiarColor(input, key) {
    var s = document.getElementById('pcsc-' + key);
    if (s) s.style.background = input.value;
    capasEstado[key].color = input.value;
    if (capasLeaflet[key]) { capasLeaflet[key].setStyle({ color: input.value }); if (tablaEstado && tablaEstado.key === key) aplicarEstiloTablaAlMapa(); }
}
function pcCambiarRelleno(input, key) {
    var s = document.getElementById('pcsf-' + key);
    if (s) s.style.background = input.value;
    capasEstado[key].fillColor = input.value;
    if (capasLeaflet[key]) { capasLeaflet[key].setStyle({ fillColor: input.value }); if (tablaEstado && tablaEstado.key === key) aplicarEstiloTablaAlMapa(); }
}
function pcCambiarOpacidad(input, key) {
    var val = parseInt(input.value);
    document.getElementById('pcop-' + key).textContent = val + '%';
    capasEstado[key].opacity = val;
    var op = val / 100;
    if (capasLeaflet[key]) { capasLeaflet[key].setStyle({ fillOpacity: op, opacity: op }); if (tablaEstado && tablaEstado.key === key) aplicarEstiloTablaAlMapa(); }
}
function pcCambiarTrazo(input, key) {
    capasEstado[key].weight = parseFloat(input.value);
    if (capasLeaflet[key]) { capasLeaflet[key].setStyle({ weight: parseFloat(input.value) }); if (tablaEstado && tablaEstado.key === key) aplicarEstiloTablaAlMapa(); }
}
function pcToggleExpand(key) {
    document.getElementById('pcrow-' + key).classList.toggle('expanded');
}

// ═══════════════════════════════════════════════════
// ACCIONES DE GRUPO
// ═══════════════════════════════════════════════════
function pcToggleGrupo(idSlug) {
    var lista = document.getElementById('pcgl-' + idSlug);
    var chev  = document.getElementById('pcgchev-' + idSlug);
    var open  = chev.classList.contains('open');
    if (open) {
        lista.style.maxHeight = lista.scrollHeight + 'px';
        requestAnimationFrame(function() { lista.style.maxHeight = '0'; });
    } else {
        lista.style.maxHeight = lista.scrollHeight + 'px';
        setTimeout(function() { lista.style.maxHeight = 'none'; }, 260);
    }
    chev.classList.toggle('open', !open);
}

function pcToggleGrupoVis(idSlug) {
    var toggle = document.getElementById('pcgt-' + idSlug);
    var activo = toggle.classList.contains('active');
    toggle.classList.toggle('active', !activo);
    toggle.innerHTML = activo ? '' : svgCheck();
    var filas = document.querySelectorAll('[data-grupo="' + idSlug + '"]');
    filas.forEach(function(row) {
        var key = row.dataset.nombre;
        var btn = document.getElementById('pcvis-' + key);
        capasEstado[key].visible = !activo;
        if (btn) { btn.classList.toggle('visible', !activo); btn.innerHTML = svgOjo(!activo); }
        row.classList.toggle('pc-hidden', activo);
        if (capasLeaflet[key]) {
            if (!activo) grupoCapasGeograficas.addLayer(capasLeaflet[key]);
            else         grupoCapasGeograficas.removeLayer(capasLeaflet[key]);
        }
    });
    actualizarContadorCapas();
}

function mostrarTodasCapas() {
    capasConfig.forEach(function(c) {
        if (!capasLeaflet[c.key]) return;
        capasEstado[c.key].visible = true;
        var row = document.getElementById('pcrow-' + c.key);
        var btn = document.getElementById('pcvis-' + c.key);
        if (row) row.classList.remove('pc-hidden');
        if (btn) { btn.classList.add('visible'); btn.innerHTML = svgOjo(true); }
        grupoCapasGeograficas.addLayer(capasLeaflet[c.key]);
    });
    document.querySelectorAll('.pc-group-toggle').forEach(function(t) {
        t.classList.add('active'); t.innerHTML = svgCheck();
    });
    actualizarContadorCapas();
    pcToast('Todas las capas visibles');
}

function ocultarTodasCapas() {
    capasConfig.forEach(function(c) {
        if (!capasLeaflet[c.key]) return;
        capasEstado[c.key].visible = false;
        var row = document.getElementById('pcrow-' + c.key);
        var btn = document.getElementById('pcvis-' + c.key);
        if (row) row.classList.add('pc-hidden');
        if (btn) { btn.classList.remove('visible'); btn.innerHTML = svgOjo(false); }
        grupoCapasGeograficas.removeLayer(capasLeaflet[c.key]);
    });
    document.querySelectorAll('.pc-group-toggle').forEach(function(t) {
        t.classList.remove('active'); t.innerHTML = '';
    });
    actualizarContadorCapas();
    pcToast('Todas las capas ocultas');
}

// ═══════════════════════════════════════════════════
// BUSCAR / CONTADOR / EXPORTAR
// ═══════════════════════════════════════════════════
function filtrarCapasPanel(q) {
    q = q.toLowerCase();
    document.querySelectorAll('.pc-layer-row').forEach(function(row) {
        row.style.display = row.dataset.nombre.toLowerCase().includes(q) ? '' : 'none';
    });
}
function actualizarContadorCapas() {
    var activas = Object.values(capasEstado).filter(function(e) { return e.visible; }).length;
    var el = document.getElementById('capasCount');
    if (el) el.textContent = activas;
}
function exportarEstilosCapas() {
    var blob = new Blob([JSON.stringify(capasEstado, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'estilos_capas.json';
    a.click();
    pcToast('Estilos exportados');
}

// ═══════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════
var _toastTimer;
function pcToast(msg) {
    clearTimeout(_toastTimer);
    var toast = document.getElementById('pcToast');
    document.getElementById('pcToastMsg').textContent = msg;
    toast.classList.add('show');
    _toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2400);
}

// ═══════════════════════════════════════════════════
// SELECTOR CAPAS
// ═══════════════════════════════════════════════════
function poblarSelectorCapas() {
    var selector = document.getElementById('selectorCapa');
    selector.innerHTML = '';
    capasConfig.forEach(function(capa) {
        var opt = document.createElement('option');
        opt.value = capa.key; opt.textContent = capa.nombre;
        selector.appendChild(opt);
    });
}
function obtenerCapaSeleccionada() {
    var key    = document.getElementById('selectorCapa').value;
    var config = capasConfig.find(function(c) { return c.key === key; });
    if (!config || !capasGeoJSON[key]) return null;
    return { key: key, data: capasGeoJSON[key], titulo: config.nombre };
}

// ═══════════════════════════════════════════════════
// TABLA DE ATRIBUTOS
// ═══════════════════════════════════════════════════
var tablaEstado = {
    key: null,
    titulo: '',
    geojson: null,
    campos: [],
    camposVisibles: [],
    filtro: '',
    pagina: 1,
    pageSize: 25,
    seleccionId: null
};

var camposPrioritariosTabla = [
    'OBJECTID', 'CODIGO', 'CODIGO_SECTOR', 'NOMBRE', 'NOMBRE_GEO', 'ETIQUETA',
    'TERRENO_CODIGO', 'LOCAL_ID', 'IDENTIFICADOR', 'CODIGO_CONSTRUCCION',
    'TIPO_CONSTRUCCION', 'TIPO_DOMINIO', 'TIPO_VIA', 'ESTADO_SUP', 'ACCESIBILI',
    'ALTURA_SOB', 'TIPO_CURVA', 'Shape_Area', 'SHAPE_Area', 'Shape_Length', 'SHAPE_Length'
];

function obtenerCamposClave(campos) {
    var claves = camposPrioritariosTabla.filter(function(c) { return campos.indexOf(c) !== -1; });
    if (claves.length === 0) claves = campos.slice(0, Math.min(8, campos.length));
    return claves.slice(0, 10);
}

function normalizarValorTabla(valor) {
    return String(valor == null ? '' : valor).toLowerCase().trim();
}

function featureCumpleBusquedaTabla(feature) {
    var q = normalizarValorTabla(tablaEstado.filtro);
    if (!q) return true;
    var props = feature.properties || {};
    return tablaEstado.campos.some(function(campo) {
        return normalizarValorTabla(props[campo]).indexOf(q) !== -1;
    });
}

function getFeaturesFiltradasTabla() {
    if (!tablaEstado.geojson) return [];
    return (tablaEstado.geojson.features || []).filter(featureCumpleBusquedaTabla);
}

function obtenerConfigCapa(key) {
    return capasConfig.find(function(c) { return c.key === key; }) || null;
}

function estiloActualCapa(key) {
    var config = obtenerConfigCapa(key) || {};
    var estado = capasEstado[key] || {};
    var op = Math.max(0, Math.min(1, (estado.opacity == null ? 100 : estado.opacity) / 100));
    var color = estado.color || config.color || '#4f7cff';
    var fillColor = estado.fillColor || color;
    var weight = estado.weight || (config.tipo === 'line' ? 2.5 : 1.5);
    if (config.tipo === 'point') return { color: color, fillColor: fillColor, fillOpacity: Math.min(op, 0.75), opacity: op, weight: weight, radius: 6 };
    if (config.tipo === 'line') return { color: color, opacity: op, weight: weight };
    return { color: color, fillColor: fillColor, fillOpacity: Math.min(op, 0.42), opacity: op, weight: weight };
}

function estiloTablaFoco(key, coincide, seleccionado) {
    var base = estiloActualCapa(key);
    var config = obtenerConfigCapa(key) || {};
    if (seleccionado) {
        base.color = '#00e5ff';
        base.fillColor = '#00e5ff';
        base.opacity = 1;
        base.weight = Math.max(base.weight || 1.5, config.tipo === 'line' ? 4 : 3.2);
        if (base.fillOpacity != null) base.fillOpacity = 0.68;
        if (base.radius != null) base.radius = 8;
        return base;
    }
    if (coincide) {
        base.opacity = 1;
        base.weight = Math.max(base.weight || 1.5, config.tipo === 'line' ? 3.2 : 2.2);
        if (base.fillOpacity != null) base.fillOpacity = Math.max(base.fillOpacity, 0.38);
        if (base.radius != null) base.radius = 7;
        return base;
    }
    base.opacity = 0;
    if (base.fillOpacity != null) base.fillOpacity = 0;
    if (base.radius != null) base.radius = 0;
    return base;
}

function aplicarEstiloBaseCapa(key) {
    var layerGroup = capasLeaflet[key];
    if (!layerGroup || !layerGroup.eachLayer) return;
    var base = estiloActualCapa(key);
    layerGroup.eachLayer(function(layer) {
        if (layer.setStyle) layer.setStyle(base);
    });
}

function aplicarEstiloTablaAlMapa() {
    if (!tablaEstado.key || !capasLeaflet[tablaEstado.key]) return;
    var key = tablaEstado.key;
    if (!capasEstado[key] || !capasEstado[key].visible) setCapaVisibleDesdeCodigo(key, true);

    var filtradas = getFeaturesFiltradasTabla();
    var idsFiltrados = new Set(filtradas.map(function(f) { return f._gcId; }));
    var hayFiltro = normalizarValorTabla(tablaEstado.filtro) !== '';
    var idSeleccionado = tablaEstado.seleccionId || (seleccionMapa && seleccionMapa.key === key ? seleccionMapa.id : null);

    capasLeaflet[key].eachLayer(function(layer) {
        if (!layer.setStyle) return;
        var coincide = hayFiltro ? idsFiltrados.has(layer._gcId) : true;
        var seleccionado = idSeleccionado && layer._gcId === idSeleccionado;
        if (idSeleccionado) coincide = seleccionado;
        layer.setStyle(estiloTablaFoco(key, coincide, seleccionado));
        if (seleccionado && layer.bringToFront) layer.bringToFront();
    });
}

function obtenerFeaturePorIdTabla(id) {
    var item = featureLayerIndex[id];
    return item ? item.feature : null;
}

function htmlFichaAtributo(feature) {
    if (!feature || !feature.properties) return '<div class="tabla-empty inline">Sin registro seleccionado.</div>';
    var campos = tablaEstado.camposVisibles.length ? tablaEstado.camposVisibles : Object.keys(feature.properties);
    var filas = campos.map(function(campo) {
        var valor = feature.properties[campo];
        return '<div class="tabla-info-row"><span>' + escaparHtml(campo) + '</span><strong>' + escaparHtml(valor == null ? 'Sin dato' : valor) + '</strong></div>';
    }).join('');
    return '<div class="tabla-info-card">' + filas + '</div>';
}

function actualizarFichaTabla() {
    var box = document.getElementById('tablaSeleccionResumen');
    if (!box) return;
    var feature = obtenerFeaturePorIdTabla(tablaEstado.seleccionId);
    if (!feature) {
        box.innerHTML = '<span class="tabla-help-text">Selecciona un registro de la tabla o una geometria en el mapa para ver su ficha.</span>';
        return;
    }
    box.innerHTML = '<div class="tabla-info-title">Registro seleccionado</div>' + htmlFichaAtributo(feature);
}

function mostrarTablaAtributos(geojson, titulo, key) {
    var contenedor = document.getElementById('tablaContenido');
    if (!geojson || !geojson.features || geojson.features.length === 0) {
        contenedor.innerHTML = '<p>No hay datos.</p>'; return;
    }

    var campos = Object.keys(geojson.features[0].properties || {});
    var cambioCapa = tablaEstado.key !== key;
    if (cambioCapa && tablaEstado.key) aplicarEstiloBaseCapa(tablaEstado.key);
    tablaEstado.key = key;
    tablaEstado.titulo = titulo;
    tablaEstado.geojson = geojson;
    tablaEstado.campos = campos;
    tablaEstado.filtro = cambioCapa ? '' : tablaEstado.filtro;
    tablaEstado.pagina = cambioCapa ? 1 : tablaEstado.pagina;
    tablaEstado.seleccionId = cambioCapa ? null : tablaEstado.seleccionId;
    if (cambioCapa || !tablaEstado.camposVisibles.length) {
        tablaEstado.camposVisibles = obtenerCamposClave(campos);
    } else {
        tablaEstado.camposVisibles = tablaEstado.camposVisibles.filter(function(c) { return campos.indexOf(c) !== -1; });
        if (!tablaEstado.camposVisibles.length) tablaEstado.camposVisibles = obtenerCamposClave(campos);
    }
    renderTablaAtributos();
}

function renderTablaAtributos() {
    var contenedor = document.getElementById('tablaContenido');
    if (!contenedor || !tablaEstado.geojson) return;

    var filtradas = getFeaturesFiltradasTabla();
    var total = filtradas.length;
    var totalPaginas = Math.max(1, Math.ceil(total / tablaEstado.pageSize));
    tablaEstado.pagina = Math.max(1, Math.min(tablaEstado.pagina, totalPaginas));
    var inicio = (tablaEstado.pagina - 1) * tablaEstado.pageSize;
    var fin = Math.min(inicio + tablaEstado.pageSize, total);
    var paginaFeatures = filtradas.slice(inicio, fin);
    var camposHtml = tablaEstado.campos.map(function(campo) {
        var checked = tablaEstado.camposVisibles.indexOf(campo) !== -1 ? 'checked' : '';
        return '<label class="tabla-field-option"><input type="checkbox" value="' + escaparHtml(campo) + '" ' + checked + '><span>' + escaparHtml(campo) + '</span></label>';
    }).join('');

    var html =
        '<div class="tabla-headline">' +
            '<div><h3>Tabla de atributos</h3><p>' + escaparHtml(tablaEstado.titulo) + '</p></div>' +
            '<div class="tabla-count">' + total + ' / ' + (tablaEstado.geojson.features || []).length + ' registros</div>' +
        '</div>' +
        '<div class="tabla-toolbar tabla-simple-toolbar">' +
            '<input id="tablaFiltro" type="search" value="' + escaparHtml(tablaEstado.filtro) + '" placeholder="Buscar en todos los atributos...">' +
            '<select id="tablaPageSize" title="Registros por pagina">' +
                '<option value="25" ' + (tablaEstado.pageSize === 25 ? 'selected' : '') + '>25</option>' +
                '<option value="50" ' + (tablaEstado.pageSize === 50 ? 'selected' : '') + '>50</option>' +
                '<option value="100" ' + (tablaEstado.pageSize === 100 ? 'selected' : '') + '>100</option>' +
            '</select>' +
            '<button id="tablaLimpiarBusqueda" type="button">Limpiar</button>' +
            '<button id="tablaExportarCSV" type="button">CSV</button>' +
            '<label class="tabla-import-btn">Importar CSV<input id="tablaImportCSV" type="file" accept=".csv,.txt"></label>' +
        '</div>' +
        '<details class="tabla-field-panel">' +
            '<summary>Campos visibles (' + tablaEstado.camposVisibles.length + ' de ' + tablaEstado.campos.length + ')</summary>' +
            '<div class="tabla-presets">' +
                '<button type="button" data-preset="clave">Clave</button>' +
                '<button type="button" data-preset="todos">Todos</button>' +
                '<button type="button" data-preset="limpiar">Limpiar</button>' +
            '</div>' +
            '<div class="tabla-field-grid">' + camposHtml + '</div>' +
        '</details>' +
        '<div id="tablaSeleccionResumen" class="tabla-selection"></div>';

    if (!tablaEstado.camposVisibles.length) {
        html += '<div class="tabla-empty">Selecciona uno o varios campos para visualizar la tabla.</div>';
    } else if (!paginaFeatures.length) {
        html += '<div class="tabla-empty">No hay registros para la busqueda actual.</div>';
    } else {
        html += '<div class="tabla-scroll"><table><thead><tr><th>Seleccion</th>';
        tablaEstado.camposVisibles.forEach(function(c) { html += '<th>' + escaparHtml(c) + '</th>'; });
        html += '</tr></thead><tbody>';
        paginaFeatures.forEach(function(f) {
            var fid = f._gcId || '';
            var selectedClass = tablaEstado.seleccionId === fid ? ' class="row-selected"' : '';
            html += '<tr data-feature-id="' + escaparHtml(fid) + '" onclick="window.__seleccionarTablaAtributo(\'' + escaparHtml(fid) + '\')"' + selectedClass + '>';
            html += '<td><button class="tabla-select-btn" type="button" onclick="event.stopPropagation(); window.__seleccionarTablaAtributo(\'' + escaparHtml(fid) + '\')">Seleccionar</button></td>';
            tablaEstado.camposVisibles.forEach(function(c) {
                var v = (f.properties && f.properties[c] != null) ? f.properties[c] : '';
                html += '<td title="' + escaparHtml(v) + '">' + escaparHtml(v) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
    }

    html +=
        '<div class="tabla-pagination">' +
            '<button id="tablaPrev" type="button" ' + (tablaEstado.pagina <= 1 ? 'disabled' : '') + '>Anterior</button>' +
            '<span>Pagina ' + tablaEstado.pagina + ' de ' + totalPaginas + ' · mostrando ' + (total ? (inicio + 1) : 0) + '-' + fin + '</span>' +
            '<button id="tablaNext" type="button" ' + (tablaEstado.pagina >= totalPaginas ? 'disabled' : '') + '>Siguiente</button>' +
        '</div>';

    contenedor.innerHTML = html;
    enlazarEventosTabla(contenedor);
    aplicarEstiloTablaAlMapa();
    actualizarFichaTabla();
}

function enlazarEventosTabla(contenedor) {
    var filtro = contenedor.querySelector('#tablaFiltro');
    if (filtro) filtro.addEventListener('input', function() { filtrarTablaAtributos(filtro.value); });
    var pageSize = contenedor.querySelector('#tablaPageSize');
    if (pageSize) pageSize.addEventListener('change', function() { cambiarTamanoPaginaTabla(pageSize.value); });
    var limpiar = contenedor.querySelector('#tablaLimpiarBusqueda');
    if (limpiar) limpiar.addEventListener('click', limpiarBusquedaTabla);
    var csv = contenedor.querySelector('#tablaExportarCSV');
    if (csv) csv.addEventListener('click', exportarCSVTabla);
    var importCsv = contenedor.querySelector('#tablaImportCSV');
    if (importCsv) importCsv.addEventListener('change', function() { importarCSVTabla(importCsv.files && importCsv.files[0]); });
    var prev = contenedor.querySelector('#tablaPrev');
    if (prev) prev.addEventListener('click', function() { cambiarPaginaTabla(-1); });
    var next = contenedor.querySelector('#tablaNext');
    if (next) next.addEventListener('click', function() { cambiarPaginaTabla(1); });
    contenedor.querySelectorAll('.tabla-presets button[data-preset]').forEach(function(btn) {
        btn.addEventListener('click', function() { aplicarPresetCamposTabla(btn.dataset.preset); });
    });
    contenedor.querySelectorAll('.tabla-field-option input').forEach(function(input) {
        input.addEventListener('change', function() { toggleCampoTabla(input.value, input.checked); });
    });
    contenedor.querySelectorAll('tbody tr[data-feature-id]').forEach(function(row) {
        var activar = function() { seleccionarFeatureDesdeTabla(tablaEstado.key, row.dataset.featureId); };
        row.addEventListener('click', activar);
        row.addEventListener('pointerup', function(ev) {
            if (ev.pointerType === 'touch' || ev.pointerType === 'pen') activar();
        });
    });
    contenedor.querySelectorAll('.tabla-select-btn').forEach(function(btn) {
        btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var row = btn.closest('tr[data-feature-id]');
            if (row) seleccionarFeatureDesdeTabla(tablaEstado.key, row.dataset.featureId);
        });
    });
}

function filtrarTablaAtributos(valor) {
    tablaEstado.filtro = valor;
    tablaEstado.pagina = 1;
    tablaEstado.seleccionId = null;
    if (seleccionMapa && seleccionMapa.key === tablaEstado.key) resetSeleccionMapa();
    renderTablaAtributos();
}

function limpiarBusquedaTabla() {
    tablaEstado.filtro = '';
    tablaEstado.pagina = 1;
    tablaEstado.seleccionId = null;
    if (seleccionMapa && seleccionMapa.key === tablaEstado.key) resetSeleccionMapa();
    renderTablaAtributos();
}

function cambiarTamanoPaginaTabla(valor) {
    tablaEstado.pageSize = parseInt(valor, 10) || 25;
    tablaEstado.pagina = 1;
    renderTablaAtributos();
}

function cambiarPaginaTabla(delta) {
    tablaEstado.pagina += delta;
    renderTablaAtributos();
}

function toggleCampoTabla(campo, activo) {
    if (activo && tablaEstado.camposVisibles.indexOf(campo) === -1) tablaEstado.camposVisibles.push(campo);
    if (!activo) tablaEstado.camposVisibles = tablaEstado.camposVisibles.filter(function(c) { return c !== campo; });
    renderTablaAtributos();
}

function aplicarPresetCamposTabla(tipo) {
    if (tipo === 'todos') tablaEstado.camposVisibles = tablaEstado.campos.slice();
    else if (tipo === 'limpiar') tablaEstado.camposVisibles = [];
    else tablaEstado.camposVisibles = obtenerCamposClave(tablaEstado.campos);
    renderTablaAtributos();
}

function seleccionarRegistroTabla(key, id, desdeMapa) {
    tablaEstado.seleccionId = id;
    var item = featureLayerIndex[id];
    if (!item) return;
    aplicarEstiloTablaAlMapa();
    resaltarFilaTabla(id);
    actualizarFichaTabla();
    if (item.layer && item.layer.openPopup) item.layer.openPopup();
    if (!desdeMapa) pcToast('Registro seleccionado en mapa y tabla');
}


function detectarSeparadorCSV(linea) {
    var candidatos = [';', ',', '\t'];
    return candidatos.sort(function(a, b) { return linea.split(b).length - linea.split(a).length; })[0];
}
function parsearCSVSimple(texto) {
    var lineas = texto.split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (lineas.length < 2) return [];
    var sep = detectarSeparadorCSV(lineas[0]);
    var headers = lineas[0].split(sep).map(function(h) { return h.trim().replace(/^"|"$/g, ''); });
    return lineas.slice(1).map(function(linea) {
        var valores = linea.split(sep).map(function(v) { return v.trim().replace(/^"|"$/g, ''); });
        var row = {};
        headers.forEach(function(h, i) { row[h] = valores[i] || ''; });
        return row;
    });
}
function normalizarIdVinculo(valor) {
    return String(valor == null ? '' : valor).replace(/\s+/g, '').toLowerCase();
}
function importarCSVTabla(file) {
    if (!file || !tablaEstado.geojson) return;
    var reader = new FileReader();
    reader.onload = function() {
        var rows = parsearCSVSimple(reader.result || '');
        if (!rows.length) { pcToast('CSV sin registros validos'); return; }
        var camposGeo = tablaEstado.campos;
        var camposCsv = Object.keys(rows[0]);
        var candidatos = ['LOCAL_ID','IDENTIFICADOR','CODIGO_CONSTRUCCION','TERRENO_CODIGO','OBJECTID','ETIQUETA','CODIGO'];
        var campoGeo = candidatos.find(function(c) { return camposGeo.indexOf(c) !== -1; });
        var campoCsv = candidatos.find(function(c) { return camposCsv.indexOf(c) !== -1; }) || camposCsv[0];
        if (!campoGeo || !campoCsv) { pcToast('No se encontro campo de vinculacion'); return; }
        var index = {};
        rows.forEach(function(r) { index[normalizarIdVinculo(r[campoCsv])] = r; });
        var actualizados = 0;
        tablaEstado.geojson.features.forEach(function(f) {
            var props = f.properties || {};
            var row = index[normalizarIdVinculo(props[campoGeo])];
            if (!row) return;
            Object.keys(row).forEach(function(c) {
                if (c === campoCsv) return;
                props['CSV_' + c] = row[c];
            });
            actualizados++;
        });
        tablaEstado.campos = Object.keys(tablaEstado.geojson.features[0].properties || {});
        tablaEstado.camposVisibles = obtenerCamposClave(tablaEstado.campos);
        renderTablaAtributos();
        if (capasGeoJSON[tablaEstado.key]) mostrarDashboard(capasGeoJSON[tablaEstado.key], tablaEstado.titulo);
        pcToast('CSV vinculado: ' + actualizados + ' registros actualizados');
    };
    reader.readAsText(file, 'utf-8');
}
function exportarCSVTabla() {
    if (!tablaEstado.geojson || !tablaEstado.camposVisibles.length) {
        pcToast('No hay campos visibles para exportar');
        return;
    }
    var filas = getFeaturesFiltradasTabla();
    var campos = tablaEstado.camposVisibles;
    var csv = [campos.join(';')].concat(filas.map(function(f) {
        var props = f.properties || {};
        return campos.map(function(c) {
            return '"' + String(props[c] == null ? '' : props[c]).replace(/"/g, '""') + '"';
        }).join(';');
    })).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tabla_' + tablaEstado.key + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}


function inicializarEventosTablaDelegados() {
    if (window.__tablaDelegadaActiva) return;
    window.__tablaDelegadaActiva = true;

    function capturarSeleccionTabla(ev) {
        var panel = ev.target && ev.target.closest ? ev.target.closest('#tablaContenido') : null;
        if (!panel) return;
        if (ev.target.closest('input, select, summary, .tabla-presets, #tablaPrev, #tablaNext, #tablaLimpiarBusqueda, #tablaExportarCSV')) return;
        var row = ev.target.closest('tr[data-feature-id]');
        if (!row) return;
        ev.preventDefault();
        seleccionarFeatureDesdeTabla(tablaEstado.key, row.dataset.featureId);
    }

    document.addEventListener('mousedown', capturarSeleccionTabla, true);
    document.addEventListener('click', capturarSeleccionTabla, true);
    document.addEventListener('pointerdown', function(ev) {
        if (ev.pointerType === 'touch' || ev.pointerType === 'pen') capturarSeleccionTabla(ev);
    }, true);
}
Object.assign(window, {
    tablaEstado: tablaEstado,
    seleccionarFeatureDesdeTabla: seleccionarFeatureDesdeTabla,
    filtrarTablaAtributos: filtrarTablaAtributos,
    cambiarTamanoPaginaTabla: cambiarTamanoPaginaTabla,
    cambiarPaginaTabla: cambiarPaginaTabla,
    toggleCampoTabla: toggleCampoTabla,
    aplicarPresetCamposTabla: aplicarPresetCamposTabla,
    exportarCSVTabla: exportarCSVTabla
});
// DASHBOARD
// ═══════════════════════════════════════════════════
function kpiCard(label, value, color, sub) {
    return '<div style="background:var(--bg-card);border:1px solid var(--border);border-left:3px solid ' + color + ';border-radius:6px;padding:8px;">' +
        '<div style="font-size:9px;color:var(--text-dim);letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px;">' + label + '</div>' +
        '<div style="font-size:22px;font-weight:700;color:' + color + ';line-height:1;">' + value + '</div>' +
        '<div style="font-size:9px;color:var(--text-muted);margin-top:2px;">' + sub + '</div>' +
        '</div>';
}
function mostrarDashboard(geojson, titulo) {
    var contenedor = document.getElementById('dashboardContenido');
    if (!geojson || !geojson.features || geojson.features.length === 0) {
        contenedor.innerHTML = '<p>No hay datos.</p>'; return;
    }
    var campos       = geojson.features[0].properties ? Object.keys(geojson.features[0].properties).length : 0;
    var totalFeatures = geojson.features.length;
    var tipoGeom      = geojson.features[0].geometry ? geojson.features[0].geometry.type : 'Desconocido';

    // Calcular área total real con Turf
    var areaTotal = 0;
    if (typeof turf !== 'undefined') {
        geojson.features.forEach(function(f) {
            try {
                if (f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) {
                    areaTotal += turf.area(f) / 10000;
                }
            } catch(e) {}
        });
    }

    contenedor.innerHTML =
        '<h3 style="margin:0 0 10px;font-size:13px;">' + titulo + '</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">' +
        kpiCard('Registros', totalFeatures, '#4f7cff', tipoGeom) +
        kpiCard('Campos', campos, '#3dd68c', 'atributos') +
        (areaTotal > 0 ? kpiCard('Área total', areaTotal.toFixed(1) + ' ha', '#f5a623', 'superficie') : '') +
        '</div>';
}

// ═══════════════════════════════════════════════════
// POSICIONAR PANELES
// ═══════════════════════════════════════════════════
function expandirPanel(idPanel) {
    var panel      = document.getElementById(idPanel);
    var contenedor = document.getElementById('panelInferior');
    panel.style.left   = '12px';
    panel.style.top    = '12px';
    panel.style.width  = Math.min(380, contenedor.clientWidth / 2 - 20) + 'px';
    panel.style.height = Math.max(140, contenedor.clientHeight - 24) + 'px';
}

function toggleDashboard() {
    var panel = document.getElementById('dashboard');
    var capa  = obtenerCapaSeleccionada();
    if (panel.style.display === 'none' || !panel.style.display) {
        expandirPanel('dashboard');
        if (capa) mostrarDashboard(capa.data, capa.titulo);
        else document.getElementById('dashboardContenido').innerHTML = '<p>Sin datos disponibles. Seleccione una capa.</p>';
        panel.style.display = 'flex';
    } else { panel.style.display = 'none'; }
}
function toggleTabla() {
    var panel = document.getElementById('tablaAtributos');
    var capa  = obtenerCapaSeleccionada();
    if (panel.style.display === 'none' || !panel.style.display) {
        expandirPanel('tablaAtributos');
        if (capa) mostrarTablaAtributos(capa.data, capa.titulo, capa.key);
        else document.getElementById('tablaContenido').innerHTML = '<p>Sin datos disponibles. Seleccione una capa.</p>';
        panel.style.display = 'flex';
        var dash = document.getElementById('dashboard');
        if (dash.style.display !== 'none') {
            panel.style.left = (parseInt(dash.style.left||0) + parseInt(dash.style.width||380) + 12) + 'px';
        }
    } else { panel.style.display = 'none'; }
}

document.getElementById('selectorCapa').addEventListener('change', function() {
    var capa = obtenerCapaSeleccionada();
    var pd = document.getElementById('dashboard');
    if (pd.style.display !== 'none' && capa) mostrarDashboard(capa.data, capa.titulo);
    var pt = document.getElementById('tablaAtributos');
    if (pt.style.display !== 'none' && capa) mostrarTablaAtributos(capa.data, capa.titulo, capa.key);
});

// ═══════════════════════════════════════════════════
// REDIMENSIONAR MAPA / PANEL
// ═══════════════════════════════════════════════════
var resizeBar = document.getElementById('resizeBar');
var redMapa   = false;
resizeBar.addEventListener('mousedown', function(e) { redMapa=true; e.preventDefault(); });
document.addEventListener('mousemove', function(e) {
    if (!redMapa) return;
    var mapWrap  = document.getElementById('mapWrap');
    var wrapRect = mapWrap.getBoundingClientRect();
    var newMapH  = Math.max(150, Math.min(e.clientY - wrapRect.top, mapWrap.clientHeight - 120));
    document.getElementById('map').style.flex   = 'none';
    document.getElementById('map').style.height = newMapH + 'px';
    document.getElementById('panelInferior').style.height = (mapWrap.clientHeight - newMapH - 6) + 'px';
    setTimeout(function() { map.invalidateSize(); }, 10);
});
document.addEventListener('mouseup', function() { redMapa=false; });

// ═══════════════════════════════════════════════════
// PANELES MOVIBLES
// ═══════════════════════════════════════════════════
function hacerMovible(idPanel, selectorHeader, idContenedor) {
    var panel      = document.getElementById(idPanel);
    var header     = panel.querySelector(selectorHeader);
    var contenedor = document.getElementById(idContenedor);
    if (!header) return;
    var ox=0, oy=0, mov=false;
    header.addEventListener('mousedown', function(e) {
        mov=true; ox=e.clientX-panel.offsetLeft; oy=e.clientY-panel.offsetTop; e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!mov) return;
        var rect=contenedor.getBoundingClientRect();
        panel.style.left = Math.max(0,Math.min(e.clientX-rect.left-ox, contenedor.clientWidth-panel.offsetWidth))+'px';
        panel.style.top  = Math.max(0,Math.min(e.clientY-rect.top-oy,  contenedor.clientHeight-panel.offsetHeight))+'px';
    });
    document.addEventListener('mouseup', function() { mov=false; });
}

// ═══════════════════════════════════════════════════
// REDIMENSIONAR VENTANAS
// ═══════════════════════════════════════════════════
function hacerRedimensionable(id) {
    var ventana    = document.getElementById(id);
    var handle     = ventana.querySelector('.resize-handle');
    var contenedor = document.getElementById('panelInferior');
    var red=false, sy=0, sh=0;
    handle.addEventListener('mousedown', function(e) {
        red=true; sy=e.clientY; sh=parseInt(window.getComputedStyle(ventana).height,10); e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!red) return;
        ventana.style.height = Math.max(120,Math.min(sh+(e.clientY-sy), contenedor.clientHeight-ventana.offsetTop))+'px';
    });
    document.addEventListener('mouseup', function() { red=false; });
}

// ═══════════════════════════════════════════════════
// DIBUJO Y MEDICIÓN
// ═══════════════════════════════════════════════════
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

function formatearNumero(v) { return Number(v).toLocaleString('es-CO',{maximumFractionDigits:2}); }
function calcularLongitud(lls) { var t=0; for(var i=0;i<lls.length-1;i++) t+=lls[i].distanceTo(lls[i+1]); return t; }
function calcularPerimetro(lls) { var t=0; for(var i=0;i<lls.length;i++) t+=lls[i].distanceTo(lls[(i+1)%lls.length]); return t; }
function calcularArea(lls) {
    var a=0, p=lls.map(function(l){ return map.latLngToLayerPoint(l); });
    for(var i=0;i<p.length;i++){var j=(i+1)%p.length; a+=p[i].x*p[j].y-p[j].x*p[i].y;}
    return Math.abs(a/2);
}
function aplicarEstilo(layer,tipo) {
    if(tipo==='polygon')   layer.setStyle({color:'#3dd68c', fillColor:'#3dd68c', fillOpacity:0.4});
    if(tipo==='rectangle') layer.setStyle({color:'#f5a623', fillColor:'#f5a623', fillOpacity:0.4});
    if(tipo==='polyline')  layer.setStyle({color:'#4f7cff'});
    if(tipo==='circle')    layer.setStyle({color:'#c084fc',fillColor:'#c084fc',fillOpacity:0.3});
}
function agregarPopup(layer,tipo) {
    var c='';
    if(tipo==='marker')  { var co=layer.getLatLng(); c='<b>Punto</b><br>Lat: '+formatearNumero(co.lat)+'<br>Lng: '+formatearNumero(co.lng); }
    if(tipo==='polyline'){ c='<b>Línea</b><br>Longitud: '+formatearNumero(calcularLongitud(layer.getLatLngs()))+' m'; }
    if(tipo==='polygon'||tipo==='rectangle'){ var l=layer.getLatLngs()[0]; c='<b>'+(tipo==='polygon'?'Polígono':'Rectángulo')+'</b><br>Área: '+formatearNumero(calcularArea(l))+' px²<br>Perímetro: '+formatearNumero(calcularPerimetro(l))+' m'; }
    if(tipo==='circle')  { var r=layer.getRadius(); c='<b>Círculo</b><br>Radio: '+formatearNumero(r)+' m<br>Área: '+formatearNumero(Math.PI*r*r)+' m²'; }
    layer.bindPopup(c);
}


function etiquetarHerramientasDibujo() {
    var etiquetas = {
        'leaflet-draw-draw-polyline': 'Dibujar línea',
        'leaflet-draw-draw-polygon': 'Dibujar polígono',
        'leaflet-draw-draw-rectangle': 'Dibujar rectángulo',
        'leaflet-draw-draw-circle': 'Dibujar círculo',
        'leaflet-draw-draw-marker': 'Agregar punto',
        'leaflet-draw-edit-edit': 'Editar dibujo',
        'leaflet-draw-edit-remove': 'Eliminar dibujo'
    };
    Object.keys(etiquetas).forEach(function(cls) {
        var btn = document.querySelector('.' + cls);
        if (btn) {
            btn.title = etiquetas[cls];
            btn.setAttribute('aria-label', etiquetas[cls]);
        }
    });
}
var drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: {
        polygon:     { shapeOptions:{color:'#3dd68c', fillColor:'#3dd68c', fillOpacity:0.4} },
        polyline:    { shapeOptions:{color:'#4f7cff'} },
        rectangle:   { shapeOptions:{color:'#f5a623', fillColor:'#f5a623', fillOpacity:0.4} },
        circle:      { shapeOptions:{color:'#c084fc',fillColor:'#c084fc',fillOpacity:0.3} },
        marker: true, circlemarker: false
    }
});
map.addControl(drawControl);
etiquetarHerramientasDibujo();
map.on(L.Draw.Event.CREATED, function(e) { aplicarEstilo(e.layer,e.layerType); agregarPopup(e.layer,e.layerType); drawnItems.addLayer(e.layer); });
map.on('draw:edited', function(e) {
    e.layers.eachLayer(function(l) {
        var t = l instanceof L.Marker?'marker': l instanceof L.Circle?'circle': l instanceof L.Rectangle?'rectangle': l instanceof L.Polygon?'polygon':'polyline';
        agregarPopup(l,t);
    });
});

var measureControl = new L.Control.Measure({
    position:'topleft', primaryLengthUnit:'meters', secondaryLengthUnit:'kilometers',
    primaryAreaUnit:'sqmeters', secondaryAreaUnit:'hectares',
    activeColor:'#4f7cff', completedColor:'#3dd68c'
});
measureControl.addTo(map);


// ═══════════════════════════════════════════════════
// BUFFER — Turf.js
// ═══════════════════════════════════════════════════
var capaBuffer = null;

function generarBuffer() {
    if (typeof turf === 'undefined') { pcToast('⚠ Turf.js no cargado'); return; }
    var key      = document.getElementById('bufferCapaSelect').value;
    var distancia = parseFloat(document.getElementById('bufferDistancia').value);
    var unidad   = document.getElementById('bufferUnidad').value;
    var color    = document.getElementById('bufferColor').value;
    var opac     = parseFloat(document.getElementById('bufferOpacidad').value) / 100;

    if (!key || !capasGeoJSON[key]) { pcToast('⚠ Capa no disponible todavía'); return; }
    if (isNaN(distancia) || distancia <= 0) { pcToast('⚠ Distancia no válida'); return; }

    if (capaBuffer) { map.removeLayer(capaBuffer); capaBuffer = null; }

    try {
        var buffered = turf.buffer(capasGeoJSON[key], distancia, { units: unidad });
        capaBuffer = L.geoJSON(buffered, {
            style: { color: color, fillColor: color, fillOpacity: opac, weight: 2 }
        }).addTo(map);
        document.getElementById('btnLimpiarBuffer').style.display = '';
        pcToast('Buffer generado: ' + distancia + ' ' + unidad);
    } catch (err) {
        console.error(err);
        pcToast('⚠ Error al generar buffer');
    }
}

function limpiarBuffer() {
    if (capaBuffer) {
        map.removeLayer(capaBuffer);
        capaBuffer = null;
        document.getElementById('btnLimpiarBuffer').style.display = 'none';
        pcToast('Buffer eliminado');
    }
}

function poblarSelectorBuffer() {
    var sel = document.getElementById('bufferCapaSelect');
    if (!sel) return;
    capasConfig.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.key; opt.textContent = c.nombre;
        sel.appendChild(opt);
    });
}



// ═══════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════
poblarSelectorCapas();
poblarSelectorBuffer();
renderizarGrupoMapasBase();
capasConfig.forEach(cargarCapa);


var _obs = new MutationObserver(function() {
    document.querySelectorAll('.pc-layer-list').forEach(function(l) {
        if (!l.style.maxHeight) l.style.maxHeight = 'none';
    });
});
_obs.observe(document.getElementById('pcLayersScroll'), { childList: true, subtree: true });

hacerMovible('dashboard',      '.panel-header', 'panelInferior');
hacerMovible('tablaAtributos', '.panel-header', 'panelInferior');
hacerRedimensionable('dashboard');
hacerRedimensionable('tablaAtributos');

// Responsividad: drawer lateral, paneles y reajuste de mapa para tablet/movil.
(function initResponsiveGeovisor() {
    var mobileQuery = window.matchMedia('(max-width: 768px)');

    function applyResponsiveState() {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        document.body.classList.toggle('is-mobile-layout', mobileQuery.matches);
        if (mobileQuery.matches && !sidebar.dataset.userToggled) {
            sidebar.classList.add('collapsed');
        }
        setTimeout(function() {
            if (window.map && map.invalidateSize) map.invalidateSize();
        }, 180);
    }

    var originalToggleSidebar = window.toggleSidebar;
    window.toggleSidebar = function() {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.dataset.userToggled = 'true';
        if (typeof originalToggleSidebar === 'function') originalToggleSidebar();
        setTimeout(function() {
            if (window.map && map.invalidateSize) map.invalidateSize();
        }, 280);
    };

    var originalExpandirPanel = window.expandirPanel;
    window.expandirPanel = function(idPanel) {
        if (!mobileQuery.matches && typeof originalExpandirPanel === 'function') {
            originalExpandirPanel(idPanel);
            return;
        }
        var panel = document.getElementById(idPanel);
        if (!panel) return;
        panel.style.left = '8px';
        panel.style.top = '8px';
        panel.style.width = 'calc(100% - 16px)';
        panel.style.height = 'calc(100% - 16px)';
    };

    window.addEventListener('resize', applyResponsiveState);
    window.addEventListener('orientationchange', function() {
        setTimeout(applyResponsiveState, 260);
    });
    document.addEventListener('DOMContentLoaded', applyResponsiveState);
    window.addEventListener('load', applyResponsiveState);
    applyResponsiveState();
})();

// =====================================================
// MODULOS FINALES GEOVISOR TERRITORIAL - HOYO RICO
// =====================================================
var overlayHistoricos = [];
var overlayHistoricoSeq = 1;

var swipeActivo = false;
var swipeRange = null;
var swipeLayer = null;

function initBaseMapsProfesionales() {
    var adicionales = {
        topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: 'OpenTopoMap', maxZoom: 17 }),
        relief: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri Terrain', maxZoom: 13 }),
        hybrid: L.layerGroup([
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri Imagery' }),
            L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri Reference' })
        ])
    };
    Object.keys(adicionales).forEach(function(key) {
        if (!baseLayers[key]) baseLayers[key] = adicionales[key];
    });
    var nuevos = [
        { key: 'topo', nombre: 'Topografico', icono: 'Topo' },
        { key: 'relief', nombre: 'Relieve', icono: 'DEM' },
        { key: 'hybrid', nombre: 'Hibrido', icono: 'Hyb' }
    ];
    nuevos.forEach(function(cfg) {
        if (!mapasBaseConfig.some(function(x) { return x.key === cfg.key; })) mapasBaseConfig.push(cfg);
    });
    var lista = document.getElementById('sbBaseList');
    if (lista) {
        lista.innerHTML = '';
        renderizarGrupoMapasBase();
    }
}

function initControlesSIGProfesionales() {
    if (document.getElementById('gcMapHud')) return;
    var hud = document.createElement('div');
    hud.id = 'gcMapHud';
    hud.className = 'gc-map-hud';
    hud.innerHTML = '<button type="button" id="gcHomeBtn" title="Vista inicial">Home</button><button type="button" id="gcFullBtn" title="Pantalla completa">Full</button><span id="gcCoords">Lat: -- | Lng: --</span><span class="gc-north">N</span>';
    document.getElementById('mapWrap').appendChild(hud);
    document.getElementById('gcHomeBtn').addEventListener('click', function() { map.setView([6.6059244912397475, -75.4262229265968], 13); });
    document.getElementById('gcFullBtn').addEventListener('click', function() {
        var el = document.getElementById('mapWrap');
        if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
        setTimeout(function() { map.invalidateSize(); }, 250);
    });
    map.on('mousemove', function(e) {
        var c = document.getElementById('gcCoords');
        if (c) c.textContent = 'Lat: ' + e.latlng.lat.toFixed(6) + ' | Lng: ' + e.latlng.lng.toFixed(6);
    });
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    initMiniMapa();
}

function initMiniMapa() {
    if (document.getElementById('gcMiniMap')) return;
    var mini = document.createElement('div');
    mini.id = 'gcMiniMap';
    mini.className = 'gc-minimap';
    document.getElementById('mapWrap').appendChild(mini);
    var miniMap = L.map('gcMiniMap', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false }).setView(map.getCenter(), Math.max(8, map.getZoom() - 4));
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd' }).addTo(miniMap);
    var rect = L.rectangle(map.getBounds(), { color: '#4f7cff', weight: 1, fillOpacity: 0.05 }).addTo(miniMap);
    function sync() {
        miniMap.setView(map.getCenter(), Math.max(8, map.getZoom() - 4));
        rect.setBounds(map.getBounds());
    }
    map.on('moveend zoomend', sync);
}

function toggleCargaOrtofotos() {
    var panel = document.getElementById('panelOrtofotos');
    if (!panel) return;
    if (panel.style.display === 'none' || !panel.style.display) {
        expandirPanel('panelOrtofotos');
        panel.style.width = Math.min(520, document.getElementById('panelInferior').clientWidth - 24) + 'px';
        renderPanelOrtofotos();
        panel.style.display = 'flex';
    } else panel.style.display = 'none';
}

function renderPanelOrtofotos() {
    var cont = document.getElementById('ortofotosContenido');
    if (!cont) return;
    var b = map.getBounds();
    cont.innerHTML =
        '<div class="pro-panel-note">' +
            '<b>Georreferenciacion robusta:</b> Carga PNG/JPG + su World File (.pgw/.jgw) para precision exacta, ' +
            'o un KML con GroundOverlay para auto-detectar coordenadas. ' +
            'Sin World File puedes definir los limites manualmente. ' +
            'La imagen se ancla como SVG georreferenciado y no se distorsiona al hacer zoom.' +
        '</div>' +
        '<label class="sb-label">Imagen (PNG / JPG)</label>' +
        '<input id="orthoFile" type="file" class="geo-file" accept=".png,.jpg,.jpeg">' +
        '<label class="sb-label">World File opcional (.pgw / .jgw / .wld) — lee coordenadas exactas</label>' +
        '<input id="orthoWorldFile" type="file" class="geo-file" accept=".pgw,.jgw,.wld,.tfw,.tifw">' +
        '<label class="sb-label">— o KML con GroundOverlay —</label>' +
        '<input id="orthoKmlFile" type="file" class="geo-file" accept=".kml">' +
        '<label class="sb-label">— o URL publica de imagen —</label>' +
        '<input id="orthoUrl" class="sb-select" placeholder="https://…/imagen.png">' +
        '<label class="sb-label">Nombre / año</label>' +
        '<div class="geo-grid-2">' +
            '<input id="orthoName" class="sb-select" placeholder="Ortofoto 2019">' +
            '<input id="orthoYear" class="sb-select" type="number" value="2024">' +
        '</div>' +
        '<label class="sb-label">Extensión geográfica (se llena automático desde World File o KML)</label>' +
        '<div class="ortho-bounds-grid">' +
            '<div class="ortho-bound-row">' +
                '<span class="ortho-bound-label">Norte</span>' +
                '<input id="orthoNorth" class="sb-select" type="number" step="0.000001" value="' + b.getNorth().toFixed(6) + '">' +
            '</div>' +
            '<div class="ortho-bound-row">' +
                '<span class="ortho-bound-label">Sur</span>' +
                '<input id="orthoSouth" class="sb-select" type="number" step="0.000001" value="' + b.getSouth().toFixed(6) + '">' +
            '</div>' +
            '<div class="ortho-bound-row">' +
                '<span class="ortho-bound-label">Oeste</span>' +
                '<input id="orthoWest" class="sb-select" type="number" step="0.000001" value="' + b.getWest().toFixed(6) + '">' +
            '</div>' +
            '<div class="ortho-bound-row">' +
                '<span class="ortho-bound-label">Este</span>' +
                '<input id="orthoEast" class="sb-select" type="number" step="0.000001" value="' + b.getEast().toFixed(6) + '">' +
            '</div>' +
        '</div>' +
        '<div id="orthoWorldFileStatus" class="ortho-wf-status"></div>' +
        '<div class="geo-grid-2">' +
            '<button class="sb-btn sb-btn-accent" onclick="agregarOverlayHistorico()">Agregar overlay</button>' +
            '<button class="sb-btn" onclick="capturarBoundsOverlay()">Usar vista actual</button>' +
        '</div>' +
        '<div id="orthoList" class="overlay-list"></div>';

    // Wire up world-file auto-reader
    var wfInput = document.getElementById('orthoWorldFile');
    if (wfInput) wfInput.addEventListener('change', function() { leerWorldFile(wfInput.files[0]); });

    // Wire up KML auto-reader
    var kmlInput = document.getElementById('orthoKmlFile');
    if (kmlInput) kmlInput.addEventListener('change', function() {
        var f = kmlInput.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function() { aplicarBoundsDesdeKmlGroundOverlay(r.result); };
        r.readAsText(f);
    });

    renderListaOverlays();
}

// ── WORLD FILE READER ─────────────────────────────────────────────────────────
// World file format (6 lines):
//   A  — pixel size X (degrees/pixel E-W)
//   D  — rotation Y  (0 for north-up)
//   B  — rotation X  (0 for north-up)
//   E  — pixel size Y (negative, degrees/pixel N-S)
//   C  — X (Longitude) of center of top-left pixel
//   F  — Y (Latitude)  of center of top-left pixel
function leerWorldFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() {
        var lineas = reader.result.trim().split(/\r?\n/).map(function(l) { return parseFloat(l.trim()); });
        if (lineas.length < 6 || lineas.some(isNaN)) {
            setOrthoStatus('World file no reconocido (necesita 6 valores numéricos)', 'error');
            return;
        }
        var A = lineas[0]; // pixel size X
        var D = lineas[1]; // rot Y
        var B = lineas[2]; // rot X
        var E = lineas[3]; // pixel size Y (negative)
        var C = lineas[4]; // center X top-left pixel
        var F = lineas[5]; // center Y top-left pixel

        // We need image dimensions to compute corners; read from <img>
        var imgFile = document.getElementById('orthoFile') && document.getElementById('orthoFile').files[0];
        if (!imgFile) {
            // If no image yet, store params and set tentative bounds needing width/height
            window._pendingWorldFile = { A:A, D:D, B:B, E:E, C:C, F:F };
            setOrthoStatus('World file leído. Carga la imagen para calcular extensión exacta.', 'ok');
            return;
        }
        var blobUrl = URL.createObjectURL(imgFile);
        var img = new Image();
        img.onload = function() {
            aplicarWorldFileBounds({ A:A, D:D, B:B, E:E, C:C, F:F }, img.width, img.height);
            URL.revokeObjectURL(blobUrl);
        };
        img.src = blobUrl;
    };
    reader.readAsText(file);
}

function aplicarWorldFileBounds(wf, w, h) {
    // Top-left pixel center is (C, F). Pixel centers to corner: shift by -0.5 pixel
    var xUL = wf.C - 0.5 * wf.A;
    var yUL = wf.F - 0.5 * wf.E;
    var xUR = xUL + w * wf.A;
    var yUR = yUL + w * wf.D;
    var xLL = xUL + h * wf.B;
    var yLL = yUL + h * wf.E;
    var xLR = xLL + w * wf.A;
    var yLR = yLL + w * wf.D;

    var north = Math.max(yUL, yUR, yLL, yLR);
    var south = Math.min(yUL, yUR, yLL, yLR);
    var east  = Math.max(xUL, xUR, xLL, xLR);
    var west  = Math.min(xUL, xUR, xLL, xLR);

    setInputOrtho('orthoNorth', north.toFixed(8));
    setInputOrtho('orthoSouth', south.toFixed(8));
    setInputOrtho('orthoWest',  west.toFixed(8));
    setInputOrtho('orthoEast',  east.toFixed(8));

    var esRotada = (Math.abs(wf.D) > 1e-9 || Math.abs(wf.B) > 1e-9);
    var msg = 'World file aplicado. ' + w + '×' + h + 'px';
    if (esRotada) msg += ' · imagen rotada (se usará bounding box)';
    setOrthoStatus(msg, 'ok');
    window._pendingWorldFile = null;
}

function aplicarBoundsDesdeKmlGroundOverlay(text) {
    var parser = new DOMParser();
    var xml = parser.parseFromString(text, 'text/xml');
    var go = xml.getElementsByTagName('GroundOverlay')[0];
    if (!go) {
        // Try parsing as regular KML placemarks (already handled in agregarKmlBasico)
        var nombre = document.getElementById('orthoName').value.trim() || 'KML';
        var year = parseInt(document.getElementById('orthoYear').value, 10) || new Date().getFullYear();
        agregarKmlBasico(text, nombre, year);
        return;
    }
    var latLonBox = go.getElementsByTagName('LatLonBox')[0];
    if (!latLonBox) { setOrthoStatus('GroundOverlay sin LatLonBox', 'error'); return; }
    var north = parseFloat((latLonBox.getElementsByTagName('north')[0]||{}).textContent||'');
    var south = parseFloat((latLonBox.getElementsByTagName('south')[0]||{}).textContent||'');
    var east  = parseFloat((latLonBox.getElementsByTagName('east')[0] ||{}).textContent||'');
    var west  = parseFloat((latLonBox.getElementsByTagName('west')[0] ||{}).textContent||'');
    var rot   = parseFloat((latLonBox.getElementsByTagName('rotation')[0]||{}).textContent||'0');
    if ([north,south,east,west].some(isNaN)) { setOrthoStatus('LatLonBox sin coordenadas válidas', 'error'); return; }

    setInputOrtho('orthoNorth', north.toFixed(8));
    setInputOrtho('orthoSouth', south.toFixed(8));
    setInputOrtho('orthoWest',  west.toFixed(8));
    setInputOrtho('orthoEast',  east.toFixed(8));

    // Try to get inline image from KML (icon href)
    var iconHref = '';
    var iconEl = go.getElementsByTagName('href')[0];
    if (iconEl) iconHref = iconEl.textContent.trim();
    if (iconHref && !document.getElementById('orthoFile').files[0]) {
        document.getElementById('orthoUrl').value = iconHref;
    }

    var msg = 'KML GroundOverlay leído. N:' + north.toFixed(5) + ' S:' + south.toFixed(5);
    if (rot !== 0) msg += ' · rotación ' + rot + '° (no soportada, se aplica bounding box)';
    setOrthoStatus(msg, 'ok');
}

function setInputOrtho(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value;
}
function setOrthoStatus(msg, tipo) {
    var el = document.getElementById('orthoWorldFileStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'ortho-wf-status ' + (tipo === 'error' ? 'ortho-wf-error' : 'ortho-wf-ok');
}

function capturarBoundsOverlay() {
    var b = map.getBounds();
    setInputOrtho('orthoNorth', b.getNorth().toFixed(8));
    setInputOrtho('orthoSouth', b.getSouth().toFixed(8));
    setInputOrtho('orthoWest',  b.getWest().toFixed(8));
    setInputOrtho('orthoEast',  b.getEast().toFixed(8));
    setOrthoStatus('Extensión tomada de la vista actual del mapa.', 'ok');
    pcToast('Extensión capturada de la vista');
}

function agregarOverlayHistorico() {
    var file = document.getElementById('orthoFile').files[0];
    var url  = document.getElementById('orthoUrl') ? document.getElementById('orthoUrl').value.trim() : '';
    var name = document.getElementById('orthoName').value.trim() || (file ? file.name : 'Overlay historico');
    var year = parseInt(document.getElementById('orthoYear').value, 10) || new Date().getFullYear();

    // KML via dedicated input
    var kmlFile = document.getElementById('orthoKmlFile') && document.getElementById('orthoKmlFile').files[0];
    if (kmlFile) {
        var kr = new FileReader();
        kr.onload = function() { agregarKmlBasico(kr.result, name, year); };
        kr.readAsText(kmlFile);
        return;
    }

    if (!file && !url) { pcToast('Seleccione una imagen o URL'); return; }

    var north = parseFloat(document.getElementById('orthoNorth').value);
    var south = parseFloat(document.getElementById('orthoSouth').value);
    var west  = parseFloat(document.getElementById('orthoWest').value);
    var east  = parseFloat(document.getElementById('orthoEast').value);

    if ([north,south,west,east].some(isNaN)) { pcToast('Defina los cuatro límites geográficos'); return; }
    if (north <= south) { pcToast('Norte debe ser mayor que Sur'); return; }
    if (east  <= west)  { pcToast('Este debe ser mayor que Oeste'); return; }

    var bounds = L.latLngBounds([[south, west],[north, east]]);
    var src = file ? URL.createObjectURL(file) : url;

    // Si hay world file pendiente y ya tenemos la imagen, recalcular
    if (file && window._pendingWorldFile) {
        var blobUrl = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function() {
            aplicarWorldFileBounds(window._pendingWorldFile, img.width, img.height);
            URL.revokeObjectURL(blobUrl);
            // Reread bounds after applying world file
            var n2 = parseFloat(document.getElementById('orthoNorth').value);
            var s2 = parseFloat(document.getElementById('orthoSouth').value);
            var w2 = parseFloat(document.getElementById('orthoWest').value);
            var e2 = parseFloat(document.getElementById('orthoEast').value);
            _crearSVGOverlay(src, file, name, year, L.latLngBounds([[s2,w2],[n2,e2]]), img.width, img.height);
        };
        img.src = blobUrl;
        return;
    }

    if (file) {
        var blobUrl2 = URL.createObjectURL(file);
        var img2 = new Image();
        img2.onload = function() {
            _crearSVGOverlay(src, file, name, year, bounds, img2.width, img2.height);
            URL.revokeObjectURL(blobUrl2);
        };
        img2.src = blobUrl2;
    } else {
        // URL: create without known dimensions
        _crearSVGOverlay(src, false, name, year, bounds, null, null);
    }
}

// ── SVG OVERLAY — georreferenciado, sin distorsión en zoom ────────────────────
// Leaflet SVGOverlay re-proyecta el SVG en cada nivel de zoom usando las
// coordenadas geográficas exactas del bounds, eliminando la deriva que
// sufre imageOverlay (que usa CSS pixel-transform).
function _crearSVGOverlay(src, esArchivo, name, year, bounds, imgW, imgH) {
    // Build inline SVG that contains the <image> element.
    // preserveAspectRatio="none" es intencional: la imagen debe llenar exactamente
    // el bounding box geográfico sin dejar franjas blancas.
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    // Use actual aspect ratio as viewBox so the image is not squeezed
    var vbW = imgW || 1000;
    var vbH = imgH || 1000;
    svg.setAttribute('viewBox', '0 0 ' + vbW + ' ' + vbH);
    svg.setAttribute('preserveAspectRatio', 'none');

    var imgEl = document.createElementNS(svgNS, 'image');
    imgEl.setAttribute('href', src);
    imgEl.setAttribute('x', '0');
    imgEl.setAttribute('y', '0');
    imgEl.setAttribute('width', '' + vbW);
    imgEl.setAttribute('height', '' + vbH);
    imgEl.setAttribute('preserveAspectRatio', 'none');
    svg.appendChild(imgEl);

    var layer = L.svgOverlay(svg, bounds, {
        opacity: 0.85,
        interactive: true,
        zIndex: 35
    });

    layer.addTo(map);
    layer.bindPopup(
        '<b>' + escaparHtml(name) + '</b>' +
        '<br>Año: ' + year +
        '<br><small>N:' + bounds.getNorth().toFixed(6) + ' S:' + bounds.getSouth().toFixed(6) +
        '<br>O:' + bounds.getWest().toFixed(6) + ' E:' + bounds.getEast().toFixed(6) + '</small>'
    );

    map.fitBounds(bounds, { padding: [20, 20] });

    overlayHistoricos.push({
        id: 'ov-' + overlayHistoricoSeq++,
        name: name,
        year: year,
        layer: layer,
        url: src,
        file: !!esArchivo,
        opacity: 85,
        type: 'image-svg',
        bounds: bounds
    });
    renderListaOverlays();
    setOrthoStatus('Overlay agregado como SVG georreferenciado.', 'ok');
    pcToast('Ortofoto agregada y georreferenciada');
}

function agregarKmlBasico(text, name, year) {
    var parser = new DOMParser();
    var xml = parser.parseFromString(text, 'text/xml');
    var features = [];
    Array.prototype.forEach.call(xml.getElementsByTagName('Placemark'), function(pm, idx) {
        var nombre = (pm.getElementsByTagName('name')[0] || {}).textContent || name + ' ' + (idx + 1);
        var line = pm.getElementsByTagName('LineString')[0];
        var poly = pm.getElementsByTagName('Polygon')[0];
        var point = pm.getElementsByTagName('Point')[0];
        var coordNode = pm.getElementsByTagName('coordinates')[0];
        if (!coordNode) return;
        var coords = coordNode.textContent.trim().split(/\s+/).map(function(c) { var p = c.split(',').map(Number); return [p[0], p[1]]; });
        if (point) features.push({ type:'Feature', properties:{ nombre:nombre }, geometry:{ type:'Point', coordinates: coords[0] } });
        else if (line) features.push({ type:'Feature', properties:{ nombre:nombre }, geometry:{ type:'LineString', coordinates: coords } });
        else if (poly) features.push({ type:'Feature', properties:{ nombre:nombre }, geometry:{ type:'Polygon', coordinates: [coords] } });
    });
    if (!features.length) { pcToast('KML sin geometria compatible'); return; }
    var layer = L.geoJSON({ type:'FeatureCollection', features: features }, { style: { color:'#3dd68c', weight:2, fillOpacity:.18 }, pointToLayer: function(f, latlng) { return L.circleMarker(latlng, { radius:5, color:'#3dd68c', fillOpacity:.75 }); } }).addTo(map);
    var kmlBounds = null;
    try { kmlBounds = layer.getBounds(); } catch(e) {}
    overlayHistoricos.push({ id: 'ov-' + overlayHistoricoSeq++, name: name, year: year, layer: layer, opacity: 100, type: 'kml', bounds: kmlBounds });
    renderListaOverlays();
    try { map.fitBounds(layer.getBounds(), { padding:[20,20] }); } catch(e) {}
    pcToast('KML agregado');
}

function renderListaOverlays() {
    var list = document.getElementById('orthoList');
    if (!list) return;
    if (!overlayHistoricos.length) {
        list.innerHTML = '<div class="pro-panel-note">Sin overlays cargados.</div>';
        return;
    }
    list.innerHTML = overlayHistoricos.map(function(o) {
        var georef = o.bounds
            ? '<span class="ortho-georef-badge">✓ Georreferenciado</span>'
            : '';
        var boundsInfo = '';
        if (o.bounds) {
            boundsInfo = '<span class="ortho-bounds-info">N:' + o.bounds.getNorth().toFixed(5) +
                ' S:' + o.bounds.getSouth().toFixed(5) +
                ' O:' + o.bounds.getWest().toFixed(5) +
                ' E:' + o.bounds.getEast().toFixed(5) + '</span>';
        }
        return '<div class="overlay-row-v2" data-id="' + o.id + '">' +
            '<div class="overlay-row-header">' +
                '<strong>' + escaparHtml(o.name) + '</strong>' +
                '<span class="ortho-type-badge">' + o.year + ' · ' + o.type + '</span>' +
                georef +
            '</div>' +
            boundsInfo +
            '<div class="overlay-row-controls">' +
                '<span class="pc-ctrl-label">Opacidad</span>' +
                '<input type="range" min="0" max="100" value="' + o.opacity + '" oninput="setOverlayOpacity(\'' + o.id + '\', this.value)">' +
                '<button onclick="centrarOverlay(\'' + o.id + '\')">Ver</button>' +
                '<button onclick="quitarOverlay(\'' + o.id + '\')">Quitar</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function setOverlayOpacity(id, value) {
    var o = overlayHistoricos.find(function(x) { return x.id === id; });
    if (!o) return;
    o.opacity = parseInt(value, 10) || 0;
    var op = o.opacity / 100;
    if (o.layer.setOpacity) {
        // works for both L.imageOverlay and L.svgOverlay
        o.layer.setOpacity(op);
    } else if (o.layer.getElement && o.layer.getElement()) {
        o.layer.getElement().style.opacity = op;
    } else if (o.layer.setStyle) {
        o.layer.setStyle({ opacity: op, fillOpacity: Math.min(0.45, op) });
    }
}
function centrarOverlay(id) {
    var o = overlayHistoricos.find(function(x) { return x.id === id; });
    if (!o) return;
    if (o.bounds) {
        map.fitBounds(o.bounds, { padding: [20, 20] });
    } else if (o.layer.getBounds) {
        try { map.fitBounds(o.layer.getBounds(), { padding: [20, 20] }); } catch(e) {}
    }
    if (o.layer.openPopup) o.layer.openPopup();
}
function quitarOverlay(id) {
    var i = overlayHistoricos.findIndex(function(x) { return x.id === id; });
    if (i < 0) return;
    var o = overlayHistoricos[i];
    map.removeLayer(o.layer);
    if (o.file && o.url && o.url.startsWith('blob:')) {
        try { URL.revokeObjectURL(o.url); } catch(e) {}
    }
    overlayHistoricos.splice(i, 1);
    renderListaOverlays();
    pcToast('Overlay eliminado');
}

function toggleSwipeComparacion() {
    if (swipeActivo) { desactivarSwipeComparacion(); return; }
    if (!overlayHistoricos.length) { pcToast('Carga primero una ortofoto u overlay'); return; }
    swipeLayer = overlayHistoricos[overlayHistoricos.length - 1].layer;
    swipeActivo = true;
    swipeRange = document.createElement('input');
    swipeRange.type = 'range'; swipeRange.min = 0; swipeRange.max = 100; swipeRange.value = 50;
    swipeRange.className = 'swipe-range';
    swipeRange.oninput = aplicarSwipeComparacion;
    document.getElementById('mapWrap').appendChild(swipeRange);
    map.on('move zoom', aplicarSwipeComparacion);
    aplicarSwipeComparacion();
    pcToast('Swipe activo sobre ultimo overlay');
}
function aplicarSwipeComparacion() {
    if (!swipeLayer || !swipeRange || !swipeLayer.getElement) return;
    var el = swipeLayer.getElement();
    if (!el) return;
    var pct = parseInt(swipeRange.value, 10);
    el.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
}
function desactivarSwipeComparacion() {
    swipeActivo = false;
    if (swipeLayer && swipeLayer.getElement && swipeLayer.getElement()) swipeLayer.getElement().style.clipPath = '';
    if (swipeRange && swipeRange.parentNode) swipeRange.parentNode.removeChild(swipeRange);
    map.off('move zoom', aplicarSwipeComparacion);
    swipeLayer = null; swipeRange = null;
    pcToast('Swipe desactivado');
}





function mostrarDashboardAvanzado(geojson, titulo) {
    var contenedor = document.getElementById('dashboardContenido');
    if (!geojson || !geojson.features || geojson.features.length === 0) { contenedor.innerHTML = '<p>No hay datos.</p>'; return; }
    var total = geojson.features.length;
    var campos = geojson.features[0].properties ? Object.keys(geojson.features[0].properties).length : 0;
    var tipoGeom = geojson.features[0].geometry ? geojson.features[0].geometry.type : 'Desconocido';
    var areaTotal = 0;
    geojson.features.forEach(function(f) {
        try { if (typeof turf !== 'undefined' && f.geometry && /Polygon/.test(f.geometry.type)) areaTotal += turf.area(f) / 10000; } catch(e) {}
    });
    contenedor.innerHTML = '<h3 style="margin:0 0 10px;font-size:13px;">' + escaparHtml(titulo) + '</h3><div class="kpi-grid dash-kpis">' +
        kpiCard('Registros', total, '#4f7cff', tipoGeom) +
        kpiCard('Campos', campos, '#3dd68c', 'atributos') +
        (areaTotal > 0 ? kpiCard('Area total', areaTotal.toFixed(1) + ' ha', '#f5a623', 'superficie') : '') +
        '</div>';
}

var _mostrarDashboardBase = mostrarDashboard;
mostrarDashboard = mostrarDashboardAvanzado;



function initGeovisorFinal() {
    initBaseMapsProfesionales();
    initControlesSIGProfesionales();
    ['panelOrtofotos'].forEach(function(id) {
        if (document.getElementById(id)) {
            try { hacerMovible(id, '.panel-header', 'panelInferior'); hacerRedimensionable(id); } catch(e) {}
        }
    });
}
initGeovisorFinal();
Object.assign(window, {
    toggleCargaOrtofotos: toggleCargaOrtofotos,
    toggleSwipeComparacion: toggleSwipeComparacion,
    agregarOverlayHistorico: agregarOverlayHistorico,
    capturarBoundsOverlay: capturarBoundsOverlay,
    setOverlayOpacity: setOverlayOpacity,
    centrarOverlay: centrarOverlay,
    quitarOverlay: quitarOverlay
});
// =====================================================
// =====================================================
// MODULO CONSOLIDADO: TABLA COMPACTA + ORTOFOTOS + SWIPE + GEOREFERENCIA
// =====================================================
(function initModuloConsolidadoGeoControl() {
    var uiState = window.__geoControlState || {
        search: '',
        page: 1,
        pageSize: 10,
        labelOn: false,
        labelField: '',
        swipeId: 'ortho-gep-2019'
    };
    window.__geoControlState = uiState;

    var DEFAULT_ORTHO_BOUNDS = {
        south: 6.596894684134096,
        west: -75.4416710625244,
        north: 6.628777937597302,
        east: -75.41076548844087
    };

    var ORTOFOTOS_DATA = [
        { id: 'ortho-gep-2019', title: 'Ortofoto GEP 2019', year: 2019, url: 'DATA/Ortofoto GEP 2019.jpg', opacity: 75, layer: null },
        { id: 'ortho-gep-2023', title: 'Ortofoto GEP 2023', year: 2023, url: 'DATA/Ortofoto GEP 2023.jpg', opacity: 75, layer: null },
        { id: 'ortho-gep-2026', title: 'Ortofoto GEP 2026', year: 2026, url: 'DATA/Ortofoto GEP 2026.jpg', opacity: 75, layer: null }
    ];
    window.ORTOFOTOS_FIJAS_HOYORRICO = ORTOFOTOS_DATA;

    function ordenar(lista) {
        return (lista || []).slice().sort(function(a, b) {
            return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
        });
    }
    function camposClave(campos) {
        var ordenados = ordenar(campos);
        var preferidos = ['ETIQUETA','IDENTIFICADOR','LOCAL_ID','CODIGO','CODIGO_PREDIAL','MATRICULA','NOMBRE','DESTINACION','AREA','Shape_Area'];
        var salida = preferidos.filter(function(c) { return ordenados.indexOf(c) !== -1; });
        ordenados.forEach(function(c) { if (salida.length < 5 && salida.indexOf(c) === -1) salida.push(c); });
        return salida.length ? salida : ordenados.slice(0, 5);
    }
    function normal(valor) {
        return normalizarValorTabla(valor == null ? '' : valor);
    }
    function tituloFeature(feature) {
        var p = feature && feature.properties ? feature.properties : {};
        return p.ETIQUETA || p.IDENTIFICADOR || p.LOCAL_ID || p.CODIGO_PREDIAL || p.CODIGO || feature._gcId || 'Registro';
    }
    function storageKeyOrto(id) {
        return 'gc_ortho_bounds_' + id;
    }
    function obtenerBoundsObjeto(img) {
        try {
            var saved = JSON.parse(localStorage.getItem(storageKeyOrto(img.id)) || 'null');
            if (saved && isFinite(saved.south) && isFinite(saved.west) && isFinite(saved.north) && isFinite(saved.east)) return saved;
        } catch(e) {}
        return Object.assign({}, DEFAULT_ORTHO_BOUNDS);
    }
    function boundsDesdeObjeto(bounds) {
        return L.latLngBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]]);
    }
    function leerBoundsInputs(img) {
        var base = obtenerBoundsObjeto(img);
        var bounds = {};
        ['north','south','west','east'].forEach(function(k) {
            var input = document.getElementById('orthoBound_' + img.id + '_' + k);
            bounds[k] = input ? parseFloat(input.value) : base[k];
        });
        if (!(bounds.south < bounds.north && bounds.west < bounds.east)) throw new Error('bounds invalidos');
        return bounds;
    }
    function recrearLayerOrto(img) {
        var visible = img.layer && map.hasLayer(img.layer);
        if (img.layer) map.removeLayer(img.layer);
        img.layer = null;
        if (visible) crearLayerOrto(img).addTo(map);
    }
    function crearLayerOrto(img) {
        if (img.layer) return img.layer;
        img.layer = L.imageOverlay(img.url, boundsDesdeObjeto(obtenerBoundsObjeto(img)), {
            opacity: img.opacity / 100,
            interactive: true,
            zIndex: 34
        });
        img.layer.bindPopup(
            '<div class="popup-ficha">' +
                '<div class="popup-ficha-title">' + escaparHtml(img.title) + '</div>' +
                '<div class="popup-ficha-row"><span>Ano</span><strong>' + img.year + '</strong></div>' +
                '<div class="popup-ficha-row"><span>Origen</span><strong>DATA</strong></div>' +
            '</div>'
        );
        return img.layer;
    }
    function registrarOverlaySwipe(img) {
        if (!window.overlayHistoricos) return;
        var existente = overlayHistoricos.find(function(o) { return o.id === img.id; });
        if (!existente) {
            overlayHistoricos.push({ id: img.id, name: img.title, year: img.year, layer: img.layer, opacity: img.opacity, url: img.url, file: false, type: 'data-georef', bounds: boundsDesdeObjeto(obtenerBoundsObjeto(img)) });
        } else {
            existente.layer = img.layer;
            existente.opacity = img.opacity;
            existente.bounds = boundsDesdeObjeto(obtenerBoundsObjeto(img));
        }
    }

    window.popupDesdeAtributos = popupDesdeAtributos = function(feature) {
        if (!feature || !feature.properties) return 'Sin atributos';
        var props = feature.properties;
        var campos = (tablaEstado.camposVisibles && tablaEstado.camposVisibles.length ? tablaEstado.camposVisibles : camposClave(Object.keys(props))).filter(function(c) {
            return props.hasOwnProperty(c);
        });
        var html = '<div class="popup-pro popup-simple"><div class="popup-pro-head"><span>Registro</span><strong>' + escaparHtml(tituloFeature(feature)) + '</strong></div><div class="popup-pro-table">';
        campos.forEach(function(campo) {
            html += '<div class="popup-pro-row"><span>' + escaparHtml(campo) + '</span><strong>' + escaparHtml(props[campo] == null ? '' : props[campo]) + '</strong></div>';
        });
        return html + '</div></div>';
    };

    function featuresTabla() {
        if (!tablaEstado.geojson) return [];
        var q = normal(uiState.search);
        return (tablaEstado.geojson.features || []).filter(function(feature) {
            if (!q) return true;
            var props = feature.properties || {};
            return Object.keys(props).some(function(campo) { return normal(props[campo]).indexOf(q) !== -1; });
        });
    }
    window.getFeaturesFiltradasTabla = getFeaturesFiltradasTabla = featuresTabla;

    function refrescarPopups(key) {
        var grupo = capasLeaflet[key];
        if (!grupo || !grupo.eachLayer) return;
        grupo.eachLayer(function(layer) {
            var item = featureLayerIndex[layer._gcId];
            if (item && layer.bindPopup) layer.bindPopup(popupDesdeAtributos(item.feature));
        });
    }

    window.aplicarEstiloTablaAlMapa = aplicarEstiloTablaAlMapa = function() {
        if (!tablaEstado.key || !capasLeaflet[tablaEstado.key]) return;
        if (!capasEstado[tablaEstado.key] || !capasEstado[tablaEstado.key].visible) setCapaVisibleDesdeCodigo(tablaEstado.key, true);
        var ids = new Set(featuresTabla().map(function(f) { return f._gcId; }));
        var hayBusqueda = !!uiState.search;
        capasLeaflet[tablaEstado.key].eachLayer(function(layer) {
            if (!layer.setStyle) return;
            var estilo = estiloActualCapa(tablaEstado.key);
            var seleccionado = tablaEstado.seleccionId && layer._gcId === tablaEstado.seleccionId;
            var visible = !hayBusqueda || ids.has(layer._gcId) || seleccionado;
            if (!visible) {
                estilo.opacity = 0.05;
                if (estilo.fillOpacity != null) estilo.fillOpacity = 0.01;
                if (estilo.radius != null) estilo.radius = 2;
            } else if (seleccionado) {
                estilo.color = '#00e5ff';
                estilo.fillColor = '#00e5ff';
                estilo.opacity = 1;
                estilo.weight = 4;
                if (estilo.fillOpacity != null) estilo.fillOpacity = 0.68;
                if (estilo.radius != null) estilo.radius = 8;
            } else if (hayBusqueda) {
                estilo.opacity = 1;
                estilo.weight = Math.max(estilo.weight || 1.5, 2.5);
                if (estilo.fillOpacity != null) estilo.fillOpacity = Math.max(estilo.fillOpacity, 0.32);
            }
            layer.setStyle(estilo);
            if (seleccionado && layer.bringToFront) layer.bringToFront();
        });
        renderEtiquetasTabla();
    };

    function seleccionarRegistro(key, id, zoom) {
        var item = featureLayerIndex[id];
        if (!item) return;
        var config = capasConfig.find(function(c) { return c.key === key; });
        if (!tablaEstado.geojson || tablaEstado.key !== key) mostrarTablaAtributos(capasGeoJSON[key], config ? config.nombre : key, key);
        tablaEstado.seleccionId = id;
        seleccionMapa = { key: key, id: id, layer: item.layer };
        if (!capasEstado[key] || !capasEstado[key].visible) setCapaVisibleDesdeCodigo(key, true);
        refrescarPopups(key);
        aplicarEstiloTablaAlMapa();
        if (zoom) {
            if (item.layer.getBounds) map.fitBounds(item.layer.getBounds(), { padding: [36, 36], maxZoom: 18 });
            else if (item.layer.getLatLng) map.setView(item.layer.getLatLng(), Math.max(map.getZoom(), 17));
        }
        if (item.layer.openPopup) item.layer.openPopup();
        var selector = document.getElementById('selectorCapa');
        if (selector) selector.value = key;
    }

    window.seleccionarFeatureMapa = seleccionarFeatureMapa = function(key, id, desdeMapa) {
        seleccionarRegistro(key, id, !desdeMapa);
        renderTablaAtributos();
        if (desdeMapa) {
            var panel = document.getElementById('tablaAtributos');
            if (panel) panel.style.display = 'flex';
        }
    };
    window.seleccionarFeatureDesdeTabla = seleccionarFeatureDesdeTabla = function(key, id) {
        seleccionarRegistro(key, id, true);
        renderTablaAtributos();
    };
    window.__seleccionarTablaAtributo = function(id) { seleccionarFeatureDesdeTabla(tablaEstado.key, id); };

    window.mostrarTablaAtributos = mostrarTablaAtributos = function(geojson, titulo, key) {
        var contenedor = document.getElementById('tablaContenido');
        if (!contenedor) return;
        if (!geojson || !geojson.features || !geojson.features.length) {
            contenedor.innerHTML = '<div class="tabla-empty">Sin datos disponibles.</div>';
            return;
        }
        var cambio = tablaEstado.key !== key;
        tablaEstado.key = key;
        tablaEstado.titulo = titulo;
        tablaEstado.geojson = geojson;
        tablaEstado.campos = ordenar(Object.keys((geojson.features[0] && geojson.features[0].properties) || {}));
        if (cambio || !tablaEstado.camposVisibles || !tablaEstado.camposVisibles.length) tablaEstado.camposVisibles = camposClave(tablaEstado.campos);
        else tablaEstado.camposVisibles = ordenar(tablaEstado.camposVisibles.filter(function(c) { return tablaEstado.campos.indexOf(c) !== -1; }));
        if (!tablaEstado.camposVisibles.length) tablaEstado.camposVisibles = camposClave(tablaEstado.campos);
        if (cambio) {
            uiState.search = '';
            uiState.page = 1;
        }
        refrescarPopups(key);
        renderTablaAtributos();
    };

    window.renderTablaAtributos = renderTablaAtributos = function() {
        var contenedor = document.getElementById('tablaContenido');
        if (!contenedor || !tablaEstado.geojson) return;
        var features = featuresTabla();
        var totalPaginas = Math.max(1, Math.ceil(features.length / uiState.pageSize));
        uiState.page = Math.max(1, Math.min(uiState.page, totalPaginas));
        var inicio = (uiState.page - 1) * uiState.pageSize;
        var pagina = features.slice(inicio, inicio + uiState.pageSize);
        var camposHtml = ordenar(tablaEstado.campos).map(function(campo) {
            return '<label class="attr-field-row"><input type="checkbox" value="' + escaparHtml(campo) + '" ' + (tablaEstado.camposVisibles.indexOf(campo) !== -1 ? 'checked' : '') + '><span>' + escaparHtml(campo) + '</span></label>';
        }).join('');
        var etiquetasHtml = tablaEstado.camposVisibles.map(function(campo) {
            return '<option value="' + escaparHtml(campo) + '" ' + (uiState.labelField === campo ? 'selected' : '') + '>' + escaparHtml(campo) + '</option>';
        }).join('');
        var html = '<div class="attr-compact-head"><div><strong>' + escaparHtml(tablaEstado.titulo || tablaEstado.key || 'Tabla') + '</strong><span>' + features.length + ' registros</span></div><button id="attrClear" type="button">Limpiar</button></div>';
        html += '<div class="attr-compact-tools"><input id="attrSearch" type="search" value="' + escaparHtml(uiState.search || '') + '" placeholder="Buscar"><select id="attrPageSize"><option value="10" ' + (uiState.pageSize === 10 ? 'selected' : '') + '>10</option><option value="25" ' + (uiState.pageSize === 25 ? 'selected' : '') + '>25</option><option value="50" ' + (uiState.pageSize === 50 ? 'selected' : '') + '>50</option></select><button id="attrCSV" type="button">CSV</button></div>';
        html += '<details class="attr-visible-box attr-fields-dropdown"><summary>Campos visibles (' + tablaEstado.camposVisibles.length + ')</summary><div class="attr-field-list">' + camposHtml + '</div></details>';
        html += '<div class="attr-label-tools"><label><input id="attrLabelOn" type="checkbox" ' + (uiState.labelOn ? 'checked' : '') + '> Etiquetas</label><select id="attrLabelField">' + etiquetasHtml + '</select></div>';
        if (!tablaEstado.camposVisibles.length) html += '<div class="tabla-empty">Selecciona al menos un campo.</div>';
        else if (!pagina.length) html += '<div class="tabla-empty">Sin registros para la busqueda.</div>';
        else {
            html += '<div class="tabla-scroll simple attr-compact-scroll"><table><thead><tr><th></th>' + tablaEstado.camposVisibles.map(function(c) { return '<th>' + escaparHtml(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
            pagina.forEach(function(feature) {
                var fid = feature._gcId || '';
                html += '<tr data-feature-id="' + escaparHtml(fid) + '" class="' + (tablaEstado.seleccionId === fid ? 'row-selected' : '') + '"><td><button class="tabla-select-btn" type="button">Ver</button></td>';
                tablaEstado.camposVisibles.forEach(function(c) {
                    html += '<td>' + escaparHtml((feature.properties && feature.properties[c] != null) ? feature.properties[c] : '') + '</td>';
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }
        html += '<div class="tabla-pagination simple"><button id="attrPrev" type="button" ' + (uiState.page <= 1 ? 'disabled' : '') + '>Anterior</button><span>' + uiState.page + ' / ' + totalPaginas + '</span><button id="attrNext" type="button" ' + (uiState.page >= totalPaginas ? 'disabled' : '') + '>Siguiente</button></div>';
        contenedor.innerHTML = html;
        enlazarTablaCompacta(contenedor);
        refrescarPopups(tablaEstado.key);
        aplicarEstiloTablaAlMapa();
    };

    function enlazarTablaCompacta(contenedor) {
        var search = contenedor.querySelector('#attrSearch');
        if (search) search.addEventListener('input', function() { uiState.search = search.value; uiState.page = 1; renderTablaAtributos(); });
        var pageSize = contenedor.querySelector('#attrPageSize');
        if (pageSize) pageSize.addEventListener('change', function() { uiState.pageSize = parseInt(pageSize.value, 10) || 10; uiState.page = 1; renderTablaAtributos(); });
        var clear = contenedor.querySelector('#attrClear');
        if (clear) clear.addEventListener('click', function() { uiState.search = ''; tablaEstado.seleccionId = null; renderTablaAtributos(); });
        var csv = contenedor.querySelector('#attrCSV');
        if (csv) csv.addEventListener('click', exportarCSVTabla);
        var prev = contenedor.querySelector('#attrPrev');
        if (prev) prev.addEventListener('click', function() { uiState.page--; renderTablaAtributos(); });
        var next = contenedor.querySelector('#attrNext');
        if (next) next.addEventListener('click', function() { uiState.page++; renderTablaAtributos(); });
        contenedor.querySelectorAll('.attr-field-row input').forEach(function(input) {
            input.addEventListener('change', function() {
                if (input.checked && tablaEstado.camposVisibles.indexOf(input.value) === -1) tablaEstado.camposVisibles.push(input.value);
                if (!input.checked) tablaEstado.camposVisibles = tablaEstado.camposVisibles.filter(function(c) { return c !== input.value; });
                tablaEstado.camposVisibles = ordenar(tablaEstado.camposVisibles);
                renderTablaAtributos();
            });
        });
        var labelOn = contenedor.querySelector('#attrLabelOn');
        if (labelOn) labelOn.addEventListener('change', function() { uiState.labelOn = labelOn.checked; renderEtiquetasTabla(); });
        var labelField = contenedor.querySelector('#attrLabelField');
        if (labelField) labelField.addEventListener('change', function() { uiState.labelField = labelField.value; renderEtiquetasTabla(); });
        contenedor.querySelectorAll('tr[data-feature-id]').forEach(function(row) {
            row.addEventListener('click', function(ev) { ev.preventDefault(); seleccionarFeatureDesdeTabla(tablaEstado.key, row.dataset.featureId); });
        });
    }

    function renderEtiquetasTabla() {
        if (!tablaEstado.key || !capasLeaflet[tablaEstado.key]) return;
        var campo = uiState.labelField || tablaEstado.camposVisibles[0];
        var conteo = 0;
        capasLeaflet[tablaEstado.key].eachLayer(function(layer) {
            if (layer.unbindTooltip) layer.unbindTooltip();
            if (!uiState.labelOn || !campo || conteo >= 100) return;
            var item = featureLayerIndex[layer._gcId];
            var valor = item && item.feature && item.feature.properties ? item.feature.properties[campo] : '';
            if (valor == null || valor === '') return;
            layer.bindTooltip(escaparHtml(valor), { permanent: true, direction: 'center', className: 'gc-dynamic-label', opacity: 0.9, interactive: false });
            conteo++;
        });
    }

    window.gcToggleOrtoFija = function(index) {
        var img = ORTOFOTOS_DATA[index];
        if (!img) return;
        var layer = crearLayerOrto(img);
        if (map.hasLayer(layer)) map.removeLayer(layer);
        else {
            layer.addTo(map);
            layer.setOpacity(img.opacity / 100);
            registrarOverlaySwipe(img);
            map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        }
        renderPanelOrtofotos();
    };
    window.gcSetOrtoFijaOpacity = function(index, value) {
        var img = ORTOFOTOS_DATA[index];
        if (!img) return;
        img.opacity = parseInt(value, 10) || 0;
        if (img.layer) img.layer.setOpacity(img.opacity / 100);
        registrarOverlaySwipe(img);
    };
    window.gcCentrarOrtoFija = function(index) {
        var img = ORTOFOTOS_DATA[index];
        if (!img) return;
        var layer = crearLayerOrto(img);
        if (!map.hasLayer(layer)) layer.addTo(map);
        registrarOverlaySwipe(img);
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    };
    window.gcGuardarBoundsOrto = function(index) {
        var img = ORTOFOTOS_DATA[index];
        if (!img) return;
        try {
            localStorage.setItem(storageKeyOrto(img.id), JSON.stringify(leerBoundsInputs(img)));
            recrearLayerOrto(img);
            registrarOverlaySwipe(img);
            pcToast('Georreferencia guardada: ' + img.title);
            renderPanelOrtofotos();
        } catch(e) {
            pcToast('Bounds invalidos');
        }
    };
    window.gcUsarVistaActualOrto = function(index) {
        var img = ORTOFOTOS_DATA[index];
        if (!img) return;
        var b = map.getBounds();
        localStorage.setItem(storageKeyOrto(img.id), JSON.stringify({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }));
        recrearLayerOrto(img);
        registrarOverlaySwipe(img);
        renderPanelOrtofotos();
        pcToast('Vista actual aplicada: ' + img.title);
    };
    window.gcRestaurarBoundsOrto = function(index) {
        var img = ORTOFOTOS_DATA[index];
        if (!img) return;
        localStorage.removeItem(storageKeyOrto(img.id));
        recrearLayerOrto(img);
        registrarOverlaySwipe(img);
        renderPanelOrtofotos();
        pcToast('Bounds base restaurados');
    };
    window.gcSetSwipeTarget = function(value) { uiState.swipeId = value; if (swipeActivo) gcAplicarSwipeOrto(); };
    window.gcAplicarSwipeOrtoIndex = function(index) {
        var img = ORTOFOTOS_DATA[index];
        if (!img) return;
        uiState.swipeId = img.id;
        gcAplicarSwipeOrto();
        renderPanelOrtofotos();
    };
    window.gcAplicarSwipeOrto = function() {
        var selectorSwipe = document.getElementById('orthoSwipeSelect');
        var selectedId = selectorSwipe ? selectorSwipe.value : uiState.swipeId;
        uiState.swipeId = selectedId || uiState.swipeId || 'ortho-gep-2019';
        var img = ORTOFOTOS_DATA.find(function(o) { return o.id === uiState.swipeId; }) || ORTOFOTOS_DATA[0];
        if (!img) return;
        var layer = crearLayerOrto(img);
        if (!map.hasLayer(layer)) layer.addTo(map);
        registrarOverlaySwipe(img);
        if (swipeActivo) desactivarSwipeComparacion();
        swipeLayer = layer;
        swipeActivo = true;
        swipeRange = document.createElement('input');
        swipeRange.type = 'range';
        swipeRange.min = 0;
        swipeRange.max = 100;
        swipeRange.value = 50;
        swipeRange.className = 'swipe-range';
        swipeRange.oninput = aplicarSwipeComparacion;
        document.getElementById('mapWrap').appendChild(swipeRange);
        map.on('move zoom', aplicarSwipeComparacion);
        aplicarSwipeComparacion();
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        pcToast('Swipe activo: ' + img.title);
        renderPanelOrtofotos();
    };
    window.toggleSwipeComparacion = toggleSwipeComparacion = function() {
        if (swipeActivo) desactivarSwipeComparacion();
        else gcAplicarSwipeOrto();
    };

    window.renderPanelOrtofotos = renderPanelOrtofotos = function() {
        var contenedor = document.getElementById('ortofotosContenido');
        if (!contenedor) return;
        var filas = ORTOFOTOS_DATA.map(function(img, i) {
            var visible = img.layer && map.hasLayer(img.layer);
            var b = obtenerBoundsObjeto(img);
            return '<div class="ortho-data-row ortho-fixed-row">' +
                '<div><strong>' + escaparHtml(img.title) + '</strong><span>' + img.year + ' - DATA</span></div>' +
                '<button type="button" onclick="gcToggleOrtoFija(' + i + ')">' + (visible ? 'Ocultar' : 'Ver') + '</button>' +
                '<input type="range" min="0" max="100" value="' + img.opacity + '" oninput="gcSetOrtoFijaOpacity(' + i + ', this.value)">' +
                '<button type="button" class="ortho-row-swipe" onclick="gcAplicarSwipeOrtoIndex(' + i + ')">Swipe</button>' +
                '<button type="button" onclick="gcCentrarOrtoFija(' + i + ')">Centrar</button>' +
                '<details class="ortho-georef"><summary>Ajustar georreferencia</summary>' +
                    '<div class="ortho-bounds-mini">' +
                        '<label>N<input id="orthoBound_' + img.id + '_north" type="number" step="0.000001" value="' + b.north + '"></label>' +
                        '<label>S<input id="orthoBound_' + img.id + '_south" type="number" step="0.000001" value="' + b.south + '"></label>' +
                        '<label>O<input id="orthoBound_' + img.id + '_west" type="number" step="0.000001" value="' + b.west + '"></label>' +
                        '<label>E<input id="orthoBound_' + img.id + '_east" type="number" step="0.000001" value="' + b.east + '"></label>' +
                    '</div>' +
                    '<div class="ortho-georef-actions"><button type="button" onclick="gcGuardarBoundsOrto(' + i + ')">Guardar</button><button type="button" onclick="gcUsarVistaActualOrto(' + i + ')">Usar vista</button><button type="button" onclick="gcRestaurarBoundsOrto(' + i + ')">Base</button></div>' +
                '</details>' +
            '</div>';
        }).join('');
        var opciones = ORTOFOTOS_DATA.map(function(img) {
            return '<option value="' + img.id + '" ' + (uiState.swipeId === img.id ? 'selected' : '') + '>' + img.year + ' - ' + escaparHtml(img.title) + '</option>';
        }).join('');
        contenedor.innerHTML = '<div class="ortho-clean-panel">' +
            '<div class="ortho-clean-head"><strong>Ortofotos DATA</strong><span>Activacion, swipe y ajuste espacial</span></div>' +
            '<div class="pro-panel-note">Base inicial: limite de Hoyo Rico. Si una ortofoto queda corrida, ajusta N/S/O/E o encuadra el mapa y usa "Usar vista".</div>' +
            '<div id="orthoDataList" class="ortho-data-list">' + filas + '</div>' +
            '<div class="ortho-swipe-box"><select id="orthoSwipeSelect" onchange="gcSetSwipeTarget(this.value)">' + opciones + '</select><button class="sb-btn sb-btn-accent" type="button" onclick="gcAplicarSwipeOrto()">Aplicar swipe</button><button class="sb-btn" type="button" onclick="desactivarSwipeComparacion()">Quitar swipe</button></div>' +
        '</div>';
    };
    window.toggleCargaOrtofotos = toggleCargaOrtofotos = function() {
        var panel = document.getElementById('panelOrtofotos');
        if (!panel) return;
        if (panel.style.display === 'none' || !panel.style.display) {
            expandirPanel('panelOrtofotos');
            panel.style.width = Math.min(620, document.getElementById('panelInferior').clientWidth - 24) + 'px';
            panel.style.display = 'flex';
            renderPanelOrtofotos();
        } else {
            panel.style.display = 'none';
        }
    };
})();