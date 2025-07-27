/* ============================================================================
 * main.js — North Park Leaflet map
 * - Basemaps: OSM (default), Esri Light/Dark Gray Canvas, SANDAG Imagery
 * - Imagery reference: Esri Hybrid Reference (vector tiles) shown on Imagery only
 * - Overlays: Community Plan Areas (context) + North Park (emphasized)
 * - Labels: permanent Leaflet tooltips; CSV overrides for context layer
 * - Accessibility: pill-style labels (see styles.css), keyboard enabled
 * - Contrast profiles: adjust stroke/casing when Imagery/Dark is active
 * ========================================================================== */

"use strict";

/** Registry of overlay groups by id (cpas-context, north-park, etc.). */
const OVERLAYS = Object.create(null);

/* ============================================================================
 * Helpers: Map & Controls
 * ========================================================================== */

/**
 * Initialize the Leaflet map.
 * @param {string} containerId
 * @param {[number, number]} center [lat, lng]
 * @param {number} zoom
 * @returns {L.Map}
 */
function initMap(containerId, center, zoom) {
  const map = L.map(containerId, {
    zoomControl: true,
    keyboard: true,
  }).setView(center, zoom);

  // Scale bar (both units)
  L.control.scale({ imperial: true, metric: true }).addTo(map);

  return map;
}

/**
 * Add the standard OSM basemap and return it (added to map by default).
 * @param {L.Map} map
 * @returns {L.TileLayer}
 */
function addOsmBasemap(map) {
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "© OpenStreetMap contributors",
  });
  osm.addTo(map); // default basemap
  return osm;
}

/**
 * Layer control (basemaps + overlays).
 * @param {L.Map} map
 * @param {Record<string, L.Layer>} baseLayers
 * @param {Record<string, L.Layer>} [overlays]
 * @returns {L.Control.Layers}
 */
function addLayerControl(map, baseLayers, overlays) {
  return L.control.layers(baseLayers, overlays || {}, { collapsed: false }).addTo(map);
}

/* ============================================================================
 * Helpers: Basemaps
 * ========================================================================== */

/**
 * Esri Light Gray Canvas (base + reference) grouped as one basemap.
 * @returns {L.LayerGroup}
 */
function createEsriLightGrayBasemap() {
  const base = L.esri.tiledMapLayer({
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    attribution: "Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors",
  });
  const ref = L.esri.tiledMapLayer({
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Reference/MapServer",
  });
  return L.layerGroup([base, ref]);
}

/**
 * Esri Dark Gray Canvas (base + reference) grouped as one basemap.
 * @returns {L.LayerGroup}
 */
function createEsriDarkGrayBasemap() {
  const base = L.esri.tiledMapLayer({
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
    attribution: "Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors",
  });
  const ref = L.esri.tiledMapLayer({
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer",
  });
  return L.layerGroup([base, ref]);
}

/**
 * SANDAG Imagery in its own pane below the reference overlay.
 * @param {L.Map} map
 * @param {string} url ImageServer URL
 * @returns {L.esri.ImageMapLayer}
 */
function createSandagImageryBasemap(map, url) {
  if (!map.getPane("imagery")) {
    map.createPane("imagery");
    map.getPane("imagery").style.zIndex = 300; // tile(200) < imagery(300) < ref(350) < overlays(400) < tooltips(650)
  }
  const imagery = L.esri.imageMapLayer({
    url,
    pane: "imagery",
    opacity: 1,
    attribution: "Imagery: SANDAG (Nearmap 2023, 9 in)",
  });
  imagery.once("load", () => console.debug("Imagery basemap loaded:", url));
  return imagery;
}

/**
 * Esri Hybrid Reference (US Edition) as a Vector Tile overlay.
 * Draws in pane "ref", above imagery and below overlays/labels.
 * Requires esri-leaflet-vector + MapLibre CSS (included in index.html).
 * @param {L.Map} map
 * @returns {L.esri.Vector.VectorTileLayer}
 */
function createEsriImageryVectorReference(map) {
  if (!map.getPane("ref")) {
    map.createPane("ref");
    map.getPane("ref").style.zIndex = 350; // sits above imagery (300), below overlays (400)
  }
  const vt = L.esri.Vector.vectorTileLayer("5447e9aef0684ec391ae9381725f7370", {
    portalUrl: "https://www.arcgis.com",
    pane: "ref",
  });
  vt.on("load", () => console.debug("Vector imagery reference loaded."));
  vt.on("error", (e) => console.warn("Vector imagery reference error:", e));
  return vt;
}

/* ============================================================================
 * Helper: FeatureServer overlays with labels and optional casing
 * ========================================================================== */

/**
 * Create and add an ArcGIS FeatureServer overlay from a config entry.
 * - Labels: permanent tooltips per feature via entry.label.{prop|text|minZoom}
 * - Casing: optional underlay FeatureLayer via entry.casing
 * - Contrast profiles: attach group.applyContrastProfile('light'|'imagery')
 * - CSV Overrides: group.refreshLabels() will re-evaluate label text
 * @param {L.Map} map
 * @param {any} entry Config entry (see config.js typedef)
 * @returns {L.LayerGroup}
 */
function addFeatureServerOverlay(map, entry) {
  console.debug("Creating FeatureLayer:", entry.name || entry.id, entry.url, entry.where);

  // Track each per-feature Leaflet layer for labeling (avoids layer.eachLayer())
  const featureLayers = new Set();

  // Optional casing (underlay) for high-contrast outlines
  let casingLayer = null;
  if (entry.casing) {
    casingLayer = L.esri.featureLayer({
      url: entry.url,
      where: entry.where ?? "1=1",
      fields: entry.fields ?? ["*"],
      attribution: entry.attribution || undefined,
      style: () => ({
        color: entry.casing.color || "#ffffff",
        weight: entry.casing.weight != null ? Number(entry.casing.weight) : 7,
        opacity: entry.casing.opacity != null ? Number(entry.casing.opacity) : 1,
        fillOpacity: 0, // stroke-only underlay
      }),
      simplifyFactor: 0.5,
      precision: 5,
    });
  }

  // Main layer
  const layer = L.esri.featureLayer({
    url: entry.url,
    where: entry.where ?? "1=1",
    fields: entry.fields ?? ["*"],
    attribution: entry.attribution || undefined,
    style: () => entry.style || { color: "#3388ff", weight: 2, fillOpacity: 0.1 },
    simplifyFactor: 0.5,
    precision: 5,

    // Called once per feature as it becomes a Leaflet layer
    onEachFeature: function onEachFeature(feature, lyr) {
      featureLayers.add(lyr);
      if (entry.label) {
        // Bind an empty tooltip now; content/visibility set in updateLabels()
        lyr.bindTooltip("", {
          permanent: true,
          direction: "center",
          className: "np-label-tooltip",
          opacity: 1,
        });
      }
    },
  });

  // Optional custom popup renderer
  if (typeof entry.popup === "function") {
    layer.bindPopup((feat) => {
      const props = feat?.feature?.properties || {};
      return entry.popup(props);
    });
  }

  // Build group so layer control can toggle everything together
  const layerGroup = L.layerGroup();
  if (casingLayer) layerGroup.addLayer(casingLayer); // underlay first
  layerGroup.addLayer(layer);
  layerGroup.addTo(map);

  // ----- Labeling logic ------------------------------------------------------

  const labelCfg = entry.label || null;
  const minZoomForLabels = labelCfg && labelCfg.minZoom != null ? Number(labelCfg.minZoom) : null;

  /**
   * Resolve label text for a feature. For the context overlay, allow CSV overrides.
   * @param {GeoJSON.Feature} feature
   * @returns {string|null}
   */
  function labelTextFor(feature) {
    const prop = (labelCfg && labelCfg.prop) || "cpname";
    const fp = feature?.properties || {};

    // CSV overrides only for the context overlay
    if (entry.id === "cpas-context" && window.CPA_LABEL_OVERRIDES) {
      const key = String(fp[prop] ?? "").toUpperCase();
      const override = window.CPA_LABEL_OVERRIDES[key];
      if (override != null && override !== "") {
        // Convert "A|B" to "A\nB" (CSS uses white-space: pre-line)
        return String(override).replace(/\s*\|\s*/g, "\n");
      }
    }

    // Fallbacks
    if (labelCfg?.prop && fp[prop] != null) return String(fp[prop]);
    if (labelCfg?.text) return String(labelCfg.text);
    return entry.name || null;
  }

  function shouldSkip(feature) {
    if (!labelCfg || !Array.isArray(labelCfg.skipValues) || !labelCfg.prop) return false;
    const v = feature?.properties?.[labelCfg.prop];
    return labelCfg.skipValues.includes(v);
  }

  function updateLabels() {
    const zoomOK = minZoomForLabels == null || map.getZoom() >= minZoomForLabels;
    featureLayers.forEach((lyr) => {
      const feature = lyr?.feature;
      if (!feature || shouldSkip(feature) || !zoomOK) {
        if (lyr.getTooltip()) lyr.setTooltipContent(""), lyr.closeTooltip();
        return;
      }
      const text = labelTextFor(feature);
      if (!text) {
        if (lyr.getTooltip()) lyr.setTooltipContent(""), lyr.closeTooltip();
        return;
      }
      if (lyr.getTooltip()) {
        lyr.setTooltipContent(String(text));
        lyr.openTooltip();
      }
    });
  }

  // Expose a refresh hook (used after CSV overrides load)
  layerGroup.refreshLabels = updateLabels;

  // ----- End labeling logic --------------------------------------------------

  layer.once("load", () => {
    console.debug("FeatureLayer loaded:", entry.name || entry.id);

    // Keep casing as an underlay after draw
    if (casingLayer && typeof casingLayer.bringToBack === "function") {
      casingLayer.bringToBack();
    }

    // Initialize labels and wire zoom gating if needed
    if (labelCfg) {
      updateLabels();
      if (minZoomForLabels != null) {
        map.on("zoomend", updateLabels);
        // Detach listener if overlay toggled off
        layerGroup.on("remove", () => map.off("zoomend", updateLabels));
        layerGroup.on("add", updateLabels);
      }
    }

    // Fit to bounds after first load if enabled
    if (entry.fitBounds !== false) {
      try {
        const b = layer.getBounds();
        if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      } catch (_e) {
        /* no-op */
      }
    }
  });

  // Attach a contrast profile applicator (used on baselayerchange)
  layerGroup.applyContrastProfile = function applyContrastProfile(profile) {
    // North Park emphasis
    if (entry.id === "north-park") {
      if (profile === "imagery") {
        layer.setStyle({
          color: "#08519c",
          weight: 4,
          opacity: 1,
          fillColor: "#08519c",
          fillOpacity: 0.08,
        });
        casingLayer?.setStyle({ color: "#ffffff", weight: 9, opacity: 1, fillOpacity: 0 });
      } else {
        layer.setStyle({
          color: "#08519c",
          weight: 3,
          opacity: 1,
          fillColor: "#08519c",
          fillOpacity: 0.06,
        });
        casingLayer?.setStyle({ color: "#ffffff", weight: 7, opacity: 1, fillOpacity: 0 });
      }
    }

    // Context CPAs (enhance on imagery/dark)
    if (entry.id === "cpas-context") {
      if (profile === "imagery") {
        layer.setStyle({ color: "#222222", weight: 2.5, opacity: 1, fillOpacity: 0 });
        casingLayer?.setStyle({ color: "#ffffff", weight: 4, opacity: 0.9, fillOpacity: 0 });
      } else {
        layer.setStyle({ color: "#444444", weight: 1.5, opacity: 0.9, fillOpacity: 0 });
        casingLayer?.setStyle({ color: "#ffffff", weight: 3, opacity: 0, fillOpacity: 0 });
      }
    }
  };

  // Register for external access (contrast/refresh)
  if (entry.id) OVERLAYS[entry.id] = layerGroup;

  return layerGroup;
}

/* ============================================================================
 * Entry point: set up the map when the DOM is ready.
 * ========================================================================== */
(function bootstrap() {
  const CONFIG =
    (typeof window !== "undefined" && window.APP_CONFIG) ||
    (typeof APP_CONFIG !== "undefined" ? APP_CONFIG : null);

  if (!CONFIG) {
    console.error("APP_CONFIG not found. Ensure config.js loads before main.js.");
    return;
  }

  const { map: mapCfg, layers, attribution } = CONFIG;

  // Map & basemaps
  const map = initMap("map", mapCfg.center, mapCfg.zoom);

  const osm = addOsmBasemap(map); // default
  const lightGray = createEsriLightGrayBasemap();
  const darkGray = createEsriDarkGrayBasemap();
  const sandagImagery = createSandagImageryBasemap(
    map,
    "https://gis.sandag.org/sdgis/rest/services/Imagery/SD2023_9inch/ImageServer"
  );

  // Vector reference overlay for imagery (pane "ref" @ 350)
  const imageryVectorRef = createEsriImageryVectorReference(map);

  // Layers control (single declaration)
  const baseLayers = {
    OpenStreetMap: osm,
    "Light Gray Canvas": lightGray,
    "Dark Gray Canvas": darkGray,
    "Imagery (SANDAG 2023 9in)": sandagImagery,
  };
  const layerControl = addLayerControl(map, baseLayers, {});

  if (attribution) map.attributionControl.addAttribution(attribution);

  // Overlays from config (context first, then North Park)
  (layers?.overlays || []).forEach((entry) => {
    if (entry?.type === "featureServer") {
      const group = addFeatureServerOverlay(map, entry);
      layerControl.addOverlay(group, entry.name || entry.id || "Overlay");
      // ensure registry (in case helper was changed)
      if (entry.id && !OVERLAYS[entry.id]) OVERLAYS[entry.id] = group;
    }
  });

  // Basemap-dependent reference overlay (imagery only)
  function syncImageryRefs() {
    const imageryOn = map.hasLayer(sandagImagery);
    if (imageryOn) {
      if (!map.hasLayer(imageryVectorRef)) imageryVectorRef.addTo(map);
    } else {
      if (map.hasLayer(imageryVectorRef)) imageryVectorRef.removeFrom(map);
    }
  }

  // Contrast profiles: treat Dark Gray like Imagery
  function currentProfile() {
    return map.hasLayer(sandagImagery) || map.hasLayer(darkGray) ? "imagery" : "light";
  }
  function applyProfileToAll(profile) {
    Object.values(OVERLAYS).forEach((g) => g?.applyContrastProfile?.(profile));
  }

  // Initial syncs
  syncImageryRefs();
  applyProfileToAll(currentProfile());

  map.on("baselayerchange", () => {
    syncImageryRefs();
    applyProfileToAll(currentProfile());
  });

  // Load CPA label overrides (CSV) and refresh context labels once loaded
  fetch("data/cpa-labels.csv")
    .then((r) => r.text())
    .then((text) => {
      const lines = text.trim().split(/\r?\n/);
      const header = (lines.shift() || "").toUpperCase();
      // Expect "CPNAME,LABEL"
      if (!/^CPNAME\s*,\s*LABEL/.test(header)) {
        console.warn("cpa-labels.csv header not recognized:", header);
      }
      const mapCSV = Object.create(null);
      for (const line of lines) {
        // split at first comma only
        const m = line.match(/^(.*?),(.*)$/);
        if (!m) continue;
        const rawKey = m[1].trim();
        const rawVal = m[2].trim();
        if (!rawKey) continue;
        mapCSV[rawKey.toUpperCase()] = rawVal;
      }
      window.CPA_LABEL_OVERRIDES = mapCSV;
      OVERLAYS["cpas-context"]?.refreshLabels?.();
      console.debug("Loaded label overrides:", Object.keys(mapCSV).length);
    })
    .catch((e) => console.error("cpa-labels.csv load/parse failed:", e));
})();
