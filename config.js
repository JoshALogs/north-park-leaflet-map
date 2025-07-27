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
      {
        id: "cpas-context",
        type: "featureServer",
        url: "https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0",
        where: "cpname <> 'NORTH PARK'", // exclude NP so labels don’t duplicate
        fields: ["objectid", "cpname"],
        name: "All Community Plans (context)",
        attribution: "Community Plans: SANDAG RDW",
        // Muted symbology for context
        style: { color: "#666666", weight: 1, fillOpacity: 0.03 },

        // Label all other communities at higher zoom
        label: { prop: "cpname", minZoom: 12 },
        fitBounds: false, // don’t re-zoom when this loads; NP overlay handles that
      },
      {
        id: "north-park",
        type: "featureServer",
        url: "https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0",
        where: "cpname = 'NORTH PARK'",
        fields: ["objectid", "cpname"],

        // NPPC green and a slightly thicker stroke
        style: { color: "#1e5e4e", weight: 3, fillOpacity: 0.12 },

        name: "North Park Boundary",

        // NEW: label config read by main.js
        label: { prop: "cpname" }, // or { text: "North Park" }
        fitBounds: true,
      },
    ],
  },
};
