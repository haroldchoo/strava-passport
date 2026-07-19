import "server-only";
import { iso1A2Code } from "@rapideditor/country-coder";

export function resolveCountryCode(startLatLng: [number, number] | null | undefined) {
  if (!startLatLng || startLatLng.length !== 2) return null;
  const [latitude, longitude] = startLatLng;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return iso1A2Code([longitude, latitude], { level: "country" })?.toUpperCase() ?? null;
}
