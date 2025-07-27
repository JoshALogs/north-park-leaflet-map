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
        id: "north-park",
        type: "featureServer",
        url: "https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0",
        where: "cpname = 'NORTH PARK'",
        fields: ["objectid", "cpname"],

        // NPPC green and a slightly thicker stroke
        style: { color: "#1e5e4e", weight: 3, fillOpacity: 0.12 },

        name: "North Park Boundary",

        // NEW: label config read by main.js
        label: {
          text: "North Park",
          fontSize: "16px",
          fontWeight: 700,
          color: "#1e5e4e",
          haloColor: "#ffffff",
          haloWidthPx: 3,
        },

        fitBounds: true,
      },
    ],
  },
};
