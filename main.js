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
  layer.once("load", () => {
    try {
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    } catch (_e) {
      /* no-op */
    }
  });

  // Credit the data source.
  map.attributionControl.addAttribution("Data: City of San Diego Planning Dept via SANDAG RDW");

  layer.addTo(map);
  return layer;
}

/**
 * Entry point: set up the map when the DOM is ready.
 */
(function bootstrap() {
  const center = [32.745, -117.129];
  const zoom = 14;

  const map = initMap("map", center, zoom);
  const osm = addOsmBasemap(map);

  const baseLayers = { OpenStreetMap: osm };
  const overlays = {};
  const layerControl = addLayerControl(map, baseLayers, overlays);

  // Add SANDAG North Park boundary and expose it in the control
  const np = addNorthParkBoundaryFromSANDAG(map);
  layerControl.addOverlay(np, "North Park Boundary");
})();
