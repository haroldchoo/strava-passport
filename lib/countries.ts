import countryData from "world-countries";
import type { Country } from "@/lib/types";

type WorldCountry = {
  cca2: string;
  name: { common: string };
  region: string;
  flag: string;
  latlng: [number, number];
};

const continentCodes: Record<string, string> = {
  Africa: "AF",
  Americas: "AM",
  Asia: "AS",
  Europe: "EU",
  Oceania: "OC",
  Antarctic: "AN",
};

export const countries: Country[] = (countryData as WorldCountry[])
  .filter((country) => country.cca2 && country.latlng?.length === 2)
  .map((country) => {
    const [latitude, longitude] = country.latlng;
    return {
      code: country.cca2,
      name: country.name.common,
      continent: continentCodes[country.region] ?? "OT",
      flag: country.flag,
      x: Math.max(2, Math.min(98, ((longitude + 180) / 360) * 100)),
      y: Math.max(4, Math.min(96, ((90 - latitude) / 180) * 100)),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const countriesByCode = new Map(countries.map((country) => [country.code, country]));
