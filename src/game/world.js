// The land as map shapes: every country but Antarctica, as one feature collection.

import { feature } from "topojson-client";

export const landGeometries = (topology) => topology.objects.countries.geometries.filter((g) => g.properties.name !== "Antarctica");

export function buildWorld(topology) {
  return { collection: { type: "FeatureCollection", features: landGeometries(topology).map((g) => feature(topology, g)) } };
}
