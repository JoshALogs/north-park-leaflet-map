/**
 * Application configuration for the North Park Leaflet map.
 * Centralizes map defaults and data sources so layers can be added without
 * touching core app logic. Keep ASCII-only characters in this file.
 *
 * Notes:
 * - "overlays" can list any number of FeatureServer layers.
 * - For each overlay, provide a human-readable "name" for the layer control.
 * - "popup" is a function receiving properties; return safe HTML.
 */
window.APP_CONFIG = {
  map: {
    /** @type {[number, number]} Default map center [lat, lng] */
    center: [32.745, -117.129],
    /** @type {number} Default zoom level */
    zoom: 14,
  },

  /** Additional credit shown in the attribution control. */
  attribution: "Data: City of San Diego Planning Dept via SANDAG RDW",

  layers: {
    overlays: [
      // Context layer (draw first / below North Park)
      {
        id: "cpas-context",
        type: "featureServer",
        url: "https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0",
        where: "cpname <> 'NORTH PARK'",
        fields: ["objectid", "cpname"],
        name: "All Community Plans (context)",
        attribution: "Community Plans: SANDAG RDW",
        // Base (light‑basemap) style — muted but legible
        style: { color: "#444444", weight: 1.5, opacity: 0.9, fillOpacity: 0 },
        // NEW: thin white casing we can boost on imagery
        casing: { color: "#ffffff", weight: 3, opacity: 0 }, // start off (light)
        label: { prop: "cpname", minZoom: 12 },
        fitBounds: false,
      },

      // North Park (draw above; add casing)
      {
        id: "north-park",
        type: "featureServer",
        url: "https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0",
        where: "cpname = 'NORTH PARK'",
        fields: ["objectid", "cpname"],
        name: "North Park Boundary",
        attribution: "Community Plans: SANDAG RDW",

        // Base (light‑basemap) style — strong dark stroke + subtle fill
        style: { color: "#08519c", weight: 3, opacity: 1, fillOpacity: 0.06, fillColor: "#08519c" },
        // NEW: white casing underlay for contrast on imagery
        casing: { color: "#ffffff", weight: 7, opacity: 1 },

        label: { prop: "cpname" },
        fitBounds: true,
      },
    ],
  },
};
