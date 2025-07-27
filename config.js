/**
 * Application configuration for the North Park Leaflet map.
 * Centralizes map defaults and data sources so layers can be added without
 * touching core app logic. Keep ASCII-only characters in this file.
 *
 * Notes:
 * - "overlays" can list any number of FeatureServer layers.
 * - For each overlay, provide a human-readable "name" for the layer control.
 * - "popup" is an optional function receiving properties; return safe HTML.
 *
 * Types (for reference):
 * @typedef {Object} OverlayEntry
 * @property {string} id
 * @property {'featureServer'} type
 * @property {string} url
 * @property {string} [where]
 * @property {string[]} [fields]
 * @property {{color:string, weight:number, opacity?:number, fillColor?:string, fillOpacity?:number}} [style]
 * @property {{color:string, weight:number, opacity?:number}} [casing]
 * @property {{prop?:string, text?:string, minZoom?:number, skipValues?:string[]}} [label]
 * @property {string} [name]
 * @property {string} [attribution]
 * @property {boolean} [fitBounds=true]
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

        // Base (light-basemap) style — muted but legible
        style: { color: "#444444", weight: 1.5, opacity: 0.9, fillOpacity: 0 },

        // Thin white casing we can boost on imagery (see contrast profiles in main.js)
        casing: { color: "#ffffff", weight: 3, opacity: 0 }, // start off (light)

        // Label all other CPAs by name when zoomed in (minZoom avoids clutter).
        // CSV overrides (data/cpa-labels.csv) can replace text per CPA at runtime.
        label: { prop: "cpname", minZoom: 12 },

        // North Park overlay handles fitBounds; context should not re-zoom.
        fitBounds: false,
      },

      // North Park (draw above; emphasized with color and casing)
      {
        id: "north-park",
        type: "featureServer",
        url: "https://geo.sandag.org/server/rest/services/Hosted/Community_Plan_SD/FeatureServer/0",
        where: "cpname = 'NORTH PARK'",
        fields: ["objectid", "cpname"],
        name: "North Park Boundary",
        attribution: "Community Plans: SANDAG RDW",

        // Base (light-basemap) style — strong dark blue stroke + subtle fill
        style: { color: "#08519c", weight: 3, opacity: 1, fillOpacity: 0.06, fillColor: "#08519c" },

        // White casing underlay for contrast on imagery/dark basemaps
        casing: { color: "#ffffff", weight: 7, opacity: 1 },

        // Always label North Park (from attribute)
        label: { prop: "cpname" },

        // Fit the initial view to North Park after the layer loads
        fitBounds: true,

        // Optional popup example (disabled by default):
        // popup: (p) => `<strong>${p.cpname ?? "Community"}</strong>`
      },
    ],
  },
};
