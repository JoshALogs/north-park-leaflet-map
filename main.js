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
 * Labels: uses permanent Leaflet tooltips per feature.
 * Supports entry.label.{prop, text, minZoom, skipValues} and entry.attribution.
 * @param {L.Map} map
 * @param {Object} entry
 * @returns {L.LayerGroup}
 */
function addFeatureServerOverlay(map, entry) {
  console.debug("Creating FeatureLayer:", entry.name || entry.id, entry.url, entry.where);

  // Keep a registry of created feature layers (polygons) for label management.
  const featureLayers = new Set();

  const layer = L.esri.featureLayer({
    url: entry.url,
    where: entry.where ?? "1=1",
    fields: entry.fields ?? ["*"],
    attribution: entry.attribution || undefined,
    style: () => entry.style || { color: "#3388ff", weight: 2, fillOpacity: 0.1 },
    simplifyFactor: 0.5,
    precision: 5,

    // Called once per feature as it’s turned into a Leaflet layer.
    onEachFeature: function (feature, lyr) {
      featureLayers.add(lyr);
      // Bind an empty tooltip now; content/visibility decided in updateLabels().
      // (Binding once avoids rebinding churn on zoom.)
      lyr.bindTooltip("", {
        permanent: true,
        direction: "center",
        className: "np-label-tooltip",
        opacity: 1,
      });
    },
  });

  if (typeof entry.popup === "function") {
    layer.bindPopup((feat) => {
      const props = feat?.feature?.properties || {};
      return entry.popup(props);
    });
  }

  // Group first so it’s available to closures below.
  const layerGroup = L.layerGroup([layer]).addTo(map);

  // ----- Label logic (no .eachLayer assumptions) -----
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
        // Hide label
        if (lyr.getTooltip()) lyr.setTooltipContent(""), lyr.closeTooltip();
        return;
      }
      const text = labelTextFor(feature);
      if (!text) {
        if (lyr.getTooltip()) lyr.setTooltipContent(""), lyr.closeTooltip();
        return;
      }
      // Show/update label
      if (lyr.getTooltip()) {
        lyr.setTooltipContent(String(text));
        lyr.openTooltip();
      }
    });
  }
  // ----- End label logic -----

  layer.once("load", () => {
    console.debug("FeatureLayer loaded:", entry.name || entry.id);

    // Initialize labels if configured
    if (labelCfg) {
      updateLabels();
      if (minZoomForLabels != null) {
        map.on("zoomend", updateLabels);
        // Optional: remove listener when toggled off
        layerGroup.on("remove", () => map.off("zoomend", updateLabels));
        layerGroup.on("add", updateLabels);
      }
    }

    // Optional fit-to-bounds
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
