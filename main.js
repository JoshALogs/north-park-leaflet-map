/* eslint no-console: "off" */

/**
 * Leaflet bootstrap for the North Park web map.
 * - Initializes a map centered on North Park.
 * - Adds an OpenStreetMap basemap and layer control.
 * - Provides extension points for future overlays (GeoJSON or ArcGIS services).
 *
 * Notes:
 * - This file prefers small, named helpers with JSDoc for clarity.
 * - Keep ASCII-only characters (use "x" not "×"; avoid nonstandard spaces).
 */

// Registry of overlay groups by id, for runtime restyling
const OVERLAYS = {};

/**
 * Initialize a Leaflet map.
 * @param {string} containerId - DOM id of the map container.
 * @param {[number, number]} center - [lat, lng] center coordinate.
 * @param {number} zoom - Initial zoom level.
 * @returns {L.Map} Leaflet map instance.
 */
function initMap(containerId, center, zoom) {
  const map = L.map(containerId, {
    zoomControl: true,
    keyboard: true, // 2.1.1 Keyboard
  }).setView(center, zoom);
  L.control.scale().addTo(map);
  return map;
}

/**
 * Add an OpenStreetMap tile layer.
 * @param {L.Map} map - Target map.
 * @returns {L.TileLayer} Added OSM tile layer.
 */
function addOsmBasemap(map) {
  const layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  });
  layer.addTo(map);
  return layer;
}

/**
 * Add a Leaflet layer control.
 * @param {L.Map} map - Target map.
 * @param {Record<string, L.Layer>} baseLayers - Named base layers.
 * @param {Record<string, L.Layer>} overlays - Named overlay layers.
 * @returns {L.Control.Layers} The created control.
 */
function addLayerControl(map, baseLayers, overlays) {
  return L.control.layers(baseLayers, overlays, { collapsed: true }).addTo(map);
}

/**
 * Create and add an ArcGIS FeatureServer overlay from a config entry.
 * Supports per-feature labels (entry.label.*) and optional stroke casing (entry.casing).
 * @param {L.Map} map
 * @param {Object} entry
 * @returns {L.LayerGroup}
 */
function addFeatureServerOverlay(map, entry) {
  console.debug("Creating FeatureLayer:", entry.name || entry.id, entry.url, entry.where);

  // Registry for feature layers (for label updates)
  const featureLayers = new Set();

  // --- NEW: optional casing layer (underlay) for high-contrast outlines ---
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
        fillOpacity: 0, // casing is stroke-only
      }),
      simplifyFactor: 0.5,
      precision: 5,
    });
  }
  // -----------------------------------------------------------------------

  const layer = L.esri.featureLayer({
    url: entry.url,
    where: entry.where ?? "1=1",
    fields: entry.fields ?? ["*"],
    attribution: entry.attribution || undefined,
    style: () => entry.style || { color: "#3388ff", weight: 2, fillOpacity: 0.1 },
    simplifyFactor: 0.5,
    precision: 5,

    // Track each created feature; bind empty tooltip now (content set in updateLabels)
    onEachFeature: function (feature, lyr) {
      featureLayers.add(lyr);
      if (entry.label) {
        lyr.bindTooltip("", {
          permanent: true,
          direction: "center",
          className: "np-label-tooltip",
          opacity: 1,
        });
      }
    },
  });

  if (typeof entry.popup === "function") {
    layer.bindPopup((feat) => {
      const props = feat?.feature?.properties || {};
      return entry.popup(props);
    });
  }

  // Build a group so the overlay toggles cleanly
  const layerGroup = L.layerGroup();
  if (casingLayer) layerGroup.addLayer(casingLayer); // add casing first (under)
  layerGroup.addLayer(layer);
  layerGroup.addTo(map);

  OVERLAYS[entry.id] = layerGroup;

  /**
   * Apply a contrast profile to this overlay.
   * profile: 'light' | 'imagery'
   */
  layerGroup.applyContrastProfile = function (profile) {
    // North Park emphasis
    if (entry.id === "north-park") {
      if (profile === "imagery") {
        // imagery: slightly heavier + full white casing
        layer.setStyle({
          color: "#08519c",
          weight: 4,
          opacity: 1,
          fillColor: "#08519c",
          fillOpacity: 0.08,
        });
        casingLayer?.setStyle({ color: "#ffffff", weight: 9, opacity: 1, fillOpacity: 0 });
      } else {
        // light tiles
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

    // Context CPAs (make visible on imagery)
    if (entry.id === "cpas-context") {
      if (profile === "imagery") {
        layer.setStyle({ color: "#222222", weight: 2.5, opacity: 1, fillOpacity: 0 });
        casingLayer?.setStyle({ color: "#ffffff", weight: 4, opacity: 0.9, fillOpacity: 0 });
      } else {
        // light
        layer.setStyle({ color: "#444444", weight: 1.5, opacity: 0.9, fillOpacity: 0 });
        casingLayer?.setStyle({ color: "#ffffff", weight: 3, opacity: 0, fillOpacity: 0 }); // hide casing on light
      }
    }
  };

  // ----- Label logic (same as your working version) -----
  const labelCfg = entry.label || null;
  const minZoomForLabels = labelCfg && labelCfg.minZoom != null ? Number(labelCfg.minZoom) : null;

  function labelTextFor(feature) {
    if (!labelCfg) return null;
    if (labelCfg.prop && feature?.properties) {
      const v = feature.properties[labelCfg.prop];
      return v != null ? String(v) : null;
    }
    return labelCfg.text || entry.name || null;
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
  // -----------------------------------------------------

  layer.once("load", () => {
    console.debug("FeatureLayer loaded:", entry.name || entry.id);

    // Bring casing behind the main layer if present
    if (casingLayer) {
      // After first draw, ensure underlay order
      casingLayer.bringToBack?.();
    }

    if (labelCfg) {
      updateLabels();
      if (minZoomForLabels != null) {
        map.on("zoomend", updateLabels);
        layerGroup.on("remove", () => map.off("zoomend", updateLabels));
        layerGroup.on("add", updateLabels);
      }
    }

    if (entry.fitBounds !== false) {
      try {
        const b = layer.getBounds();
        if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      } catch (_e) {
        /* no-op */
      }
    }
  });

  return layerGroup;
}

/**
 * Add a SANDAG imagery basemap from an ArcGIS ImageServer via Esri Leaflet.
 * @param {L.Map} map - Target map.
 * @param {string} url - ImageServer URL.
 * @returns {L.esri.ImageMapLayer} The imagery layer (not added by default).
 */
function createSandagImageryBasemap(map, url) {
  const imagery = L.esri.imageMapLayer({
    url,
    opacity: 1,
    attribution: "Imagery: SANDAG (Nearmap 2023, 9 in)",
  });
  imagery.once("load", () => console.debug("Imagery basemap loaded:", url));
  return imagery;
}

/**
 * Create Esri Light Gray Canvas basemap (base + reference labels).
 * Returns a single LayerGroup so the control can toggle it as one basemap.
 * Docs: L.esri.tiledMapLayer for MapServer tiles; ImageMapLayer for imagery.
 */
function createEsriLightGrayBasemap() {
  const base = L.esri.tiledMapLayer({
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    attribution: "Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors",
  });

  // Optional reference labels layer (places, boundaries)
  const ref = L.esri.tiledMapLayer({
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Reference/MapServer",
  });

  // Group them so they toggle together
  return L.layerGroup([base, ref]);
}

/**
 * Esri Dark Gray Canvas (base + reference labels) as a single basemap.
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
 * Entry point: set up the map when the DOM is ready.
 */
(function bootstrap() {
  // Find the config, whether it’s on window or as a global binding.
  const CONFIG =
    (typeof window !== "undefined" && window.APP_CONFIG) ||
    (typeof APP_CONFIG !== "undefined" ? APP_CONFIG : null);

  if (!CONFIG) {
    console.error("APP_CONFIG not found. Ensure config.js loads before main.js.");
    return;
  }

  console.debug("APP_CONFIG overlays:", CONFIG.layers?.overlays?.length ?? 0);

  const { map: mapCfg, layers, attribution } = CONFIG;

  const map = initMap("map", mapCfg.center, mapCfg.zoom);

  // Basemaps
  const osm = addOsmBasemap(map); // DEFAULT (leave added)
  const lightGray = createEsriLightGrayBasemap(); // not added by default
  const darkGray = createEsriDarkGrayBasemap(); // not added by default
  const sandagImagery = createSandagImageryBasemap(
    map,
    "https://gis.sandag.org/sdgis/rest/services/Imagery/SD2023_9inch/ImageServer"
  );

  // Layers control
  const baseLayers = {
    OpenStreetMap: osm,
    "Light Gray Canvas": lightGray,
    "Dark Gray Canvas": darkGray,
    "Imagery (SANDAG 2023 9in)": sandagImagery,
  };
  const layerControl = addLayerControl(map, baseLayers, {});

  // Determine current contrast profile for overlays
  function currentProfile() {
    // Treat Dark Gray and Imagery as the same high‑contrast profile
    if (map.hasLayer(sandagImagery) || map.hasLayer(darkGray)) return "imagery";
    return "light";
  }

  function applyProfileToAll(profile) {
    Object.values(OVERLAYS).forEach((g) => g?.applyContrastProfile?.(profile));
  }

  applyProfileToAll(currentProfile());
  map.on("baselayerchange", () => applyProfileToAll(currentProfile()));

  (layers?.overlays || []).forEach((entry) => {
    if (entry.type === "featureServer") {
      const lyr = addFeatureServerOverlay(map, entry);
      layerControl.addOverlay(lyr, entry.name || entry.id || "Overlay");
    }
  });
})();
