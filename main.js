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
 * Create and add an ArcGIS FeatureServer overlay from a config entry.
 * Uses a permanent Leaflet tooltip as the label (centered on the polygon).
 * @param {L.Map} map
 * @param {Object} entry
 * @returns {L.LayerGroup} A group containing the feature layer
 */
function addFeatureServerOverlay(map, entry) {
  console.debug("Creating FeatureLayer:", entry.name || entry.id, entry.url, entry.where);

  const layer = L.esri.featureLayer({
    url: entry.url,
    where: entry.where ?? "1=1",
    fields: entry.fields ?? ["*"],
    attribution: entry.attribution || undefined, // overlay-specific credit (optional)
    style: () => entry.style || { color: "#3388ff", weight: 2, fillOpacity: 0.1 },
    simplifyFactor: 0.5,
    precision: 5,

    // Bind a permanent, centered tooltip per feature as it is created
    onEachFeature: function (feature, lyr) {
      const name = feature?.properties?.cpname || entry.label?.text || entry.name || "North Park";

      lyr
        .bindTooltip(String(name), {
          permanent: true,
          direction: "center",
          className: "np-label-tooltip",
          opacity: 1,
        })
        .openTooltip();
    },
  });

  if (typeof entry.popup === "function") {
    layer.bindPopup((feat) => {
      const props = feat?.feature?.properties || {};
      return entry.popup(props);
    });
  }

  // Fit to bounds after first load if enabled
  layer.once("load", () => {
    console.debug("FeatureLayer loaded:", entry.name || entry.id);
    if (entry.fitBounds !== false) {
      try {
        const b = layer.getBounds();
        if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      } catch (_e) {
        /* no-op */
      }
    }
  });

  // Return a group so the overlay toggles cleanly in the control
  const group = L.layerGroup();
  group.addLayer(layer);
  group.addTo(map);
  return group;
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

  // Create SANDAG imagery basemap (not added by default so OSM remains initial)
  const sandagImagery = createSandagImageryBasemap(
    map,
    "https://gis.sandag.org/sdgis/rest/services/Imagery/SD2023_9inch/ImageServer"
  );

  if (attribution) {
    map.attributionControl.addAttribution(attribution);
  }

  const baseLayers = {
    OpenStreetMap: osm,
    "Imagery (SANDAG 2023 9in)": sandagImagery,
  };

  const layerControl = addLayerControl(map, baseLayers, {});

  (layers?.overlays || []).forEach((entry) => {
    if (entry.type === "featureServer") {
      const lyr = addFeatureServerOverlay(map, entry);
      layerControl.addOverlay(lyr, entry.name || entry.id || "Overlay");
    }
  });
})();
