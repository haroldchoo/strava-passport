"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countryMetadata from "world-countries";
import worldTopology from "world-atlas/countries-110m.json";
import { formatDistance } from "@/lib/domain";
import type { PassportEntry } from "@/lib/types";

type AtlasProperties = { name?: string };
type CountryMetadata = { cca2: string; ccn3?: string };

const numericCountryCodes = new Map(
  (countryMetadata as CountryMetadata[])
    .filter((country) => country.ccn3)
    .map((country) => [country.ccn3!, country.cca2]),
);

const topology = worldTopology as unknown as Topology<{
  countries: GeometryCollection<AtlasProperties>;
}>;
const countryFeatures = feature(topology, topology.objects.countries).features;
const projection = geoNaturalEarth1().fitExtent(
  [[18, 18], [982, 482]],
  { type: "FeatureCollection", features: countryFeatures },
);
const path = geoPath(projection);
const mapCountries = countryFeatures
  .map((country) => {
    const numericCode = String(country.id ?? "").padStart(3, "0");
    return {
      code: numericCountryCodes.get(numericCode) ?? null,
      name: country.properties?.name ?? "Unknown country",
      path: path(country) ?? "",
    };
  })
  .filter((country) => country.path && country.code !== "AQ");

export function WorldMap({ entries }: { entries: PassportEntry[] }) {
  const [selectedCode, setSelectedCode] = useState<string | null>(entries[0]?.country.code ?? null);
  const entriesByCode = useMemo(() => new Map(entries.map((entry) => [entry.country.code, entry])), [entries]);
  const selectedEntry = (selectedCode ? entriesByCode.get(selectedCode) : null) ?? entries[0] ?? null;

  return (
    <div className="world-map" aria-label="Visited countries on a world map">
      <svg className="world-map-canvas" viewBox="0 0 1000 500" role="img" aria-labelledby="world-map-title world-map-description">
        <title id="world-map-title">Your Strava passport world map</title>
        <desc id="world-map-description">Visited countries are highlighted. Select a highlighted country to see its activity summary.</desc>
        <g>
          {mapCountries.map((country) => {
            const entry = country.code ? entriesByCode.get(country.code) : null;
            const isSelected = Boolean(entry && entry.country.code === selectedEntry?.country.code);
            const label = entry
              ? `${entry.country.name}: ${entry.activityCount} activities, ${formatDistance(entry.totalDistanceMeters)}`
              : country.name;

            return (
              <path
                key={`${country.code ?? "unknown"}-${country.name}`}
                d={country.path}
                className={`country-shape${entry ? " visited" : ""}${isSelected ? " selected" : ""}`}
                role={entry ? "button" : undefined}
                tabIndex={entry ? 0 : undefined}
                aria-label={entry ? label : undefined}
                aria-hidden={entry ? undefined : true}
                onClick={entry ? () => setSelectedCode(entry.country.code) : undefined}
                onKeyDown={entry ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedCode(entry.country.code);
                  }
                } : undefined}
              >
                <title>{label}</title>
              </path>
            );
          })}
        </g>
      </svg>
      <div className="map-summary" aria-live="polite">
        {selectedEntry ? (
          <div className="map-selection">
            <span className="flag">{selectedEntry.country.flag}</span>
            <div>
              <strong>{selectedEntry.country.name}</strong>
              <small>{selectedEntry.activityCount} activities · {formatDistance(selectedEntry.totalDistanceMeters)}</small>
            </div>
          </div>
        ) : <span>No visited countries yet</span>}
        <div className="map-legend" aria-label="Map legend">
          <span><i className="legend-swatch visited" /> Visited</span>
          <span><i className="legend-swatch" /> Not visited</span>
        </div>
      </div>
    </div>
  );
}
