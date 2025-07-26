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
        fields: ["cpname"],
        name: "North Park Boundary",
        style: { color: "#0066ff", weight: 2, fillOpacity: 0.1 },
        /** @param {Record<string, any>} props */
        popup: (props) => `<strong>${props.cpname || "North Park"}</strong>`,
        /** Fit map to bounds after first load (set false to skip) */
        fitBounds: true,
      },
    ],
  },
};
