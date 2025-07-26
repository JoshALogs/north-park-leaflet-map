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

/**
 * Initialize a Leaflet map.
 * @param {string} containerId - DOM id of the map container.
 * @param {[number, number]} center - [lat, lng] center coordinate.
 * @param {number} zoom - Initial zoom level.
 * @returns {L.Map} Leaflet map instance.
 */
function initMap(containerId, center, zoom) {
  // Explicit options aid future maintenance.
  const map = L.map(containerId, {
    zoomControl: true,
  }).setView(center, zoom);

  // Add a scale control for reference.
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
 * Add the North Park boundary from SANDAG's Community_Plan_SD feature layer.
 * Source: https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0
 * Fields include cpname (display field). We'll filter cpname='NORTH PARK'.
 * @param {L.Map} map - Target map.
 * @returns {L.esri.FeatureLayer} The added feature layer.
 */
function addNorthParkBoundaryFromSANDAG(map) {
  const url =
    "https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0";
  const where = "cpname = 'NORTH PARK'";

  const layer = L.esri.featureLayer({
    url,
    where,
    fields: ["cpname"], // request only what we need
    style: () => ({ color: "#0066ff", weight: 2, fillOpacity: 0.1 }),
    simplifyFactor: 0.5, // light server-side/generalization hints
    precision: 5,
  });

  // Simple popup with plan name.
  layer.bindPopup((feat) => {
    const props = feat?.feature?.properties || {};
    const name = props.cpname || "North Park";
    return `<strong>${name}</strong>`;
  });

  // Fit to boundary once loaded.
  layer.on("load", () => {
    console.debug("FeatureLayer loaded:", entry.name || entry.id);
  });

  // Credit the data source.
  map.attributionControl.addAttribution("Data: City of San Diego Planning Dept via SANDAG RDW");

  layer.addTo(map);
  return layer;
}

/**
 * Create and add an ArcGIS FeatureServer overlay from a config entry.
 * Reads url/where/fields/style/popup/fitBounds from the entry.
 * @param {L.Map} map - Target map.
 * @param {Object} entry - Overlay config.
 * @param {string} entry.url - FeatureServer layer URL.
 * @param {string} [entry.where="1=1"] - WHERE clause.
 * @param {string[]} [entry.fields=["*"]] - Fields to request.
 * @param {Object} [entry.style] - Leaflet Path style.
 * @param {(props:Object)=>string} [entry.popup] - Popup HTML renderer.
 * @param {boolean} [entry.fitBounds=true] - Fit to bounds on first load.
 * @returns {L.esri.FeatureLayer} The created and added layer.
 */
function addFeatureServerOverlay(map, entry) {
  console.debug("Creating FeatureLayer:", entry.name || entry.id, entry.url, entry.where);

  const layer = L.esri.featureLayer({
    url: entry.url,
    where: entry.where ?? "1=1",
    fields: entry.fields ?? ["*"],
    style: () => entry.style || { color: "#3388ff", weight: 2, fillOpacity: 0.1 },
    simplifyFactor: 0.5,
    precision: 5,
  });

  if (typeof entry.popup === "function") {
    layer.bindPopup((feat) => {
      const props = feat?.feature?.properties || {};
      return entry.popup(props);
    });
  }

  layer.on("load", () => {
    const count = layer.getLayers().length;
    console.debug("FeatureLayer loaded:", entry.name || entry.id, "features:", count);
  });

  layer.on("error", (e) => console.error("FeatureLayer error:", e));

  if (entry.fitBounds !== false) {
    layer.once("load", () => {
      try {
        const b = layer.getBounds();
        if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      } catch (_e) {
        /* no-op */
      }
    });
  }

  layer.addTo(map);
  return layer;
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
  const osm = addOsmBasemap(map);

  if (attribution) {
    map.attributionControl.addAttribution(attribution);
  }

  const baseLayers = { OpenStreetMap: osm };
  const layerControl = addLayerControl(map, baseLayers, {});

  (layers?.overlays || []).forEach((entry) => {
    if (entry.type === "featureServer") {
      const lyr = addFeatureServerOverlay(map, entry);
      layerControl.addOverlay(lyr, entry.name || entry.id || "Overlay");
    }
  });
})();
