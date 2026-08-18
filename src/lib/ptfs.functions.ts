import { createServerFn } from "@tanstack/react-start";

const BASE = "https://24data.ptfs.app";

async function getJson(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PTFS request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export type Aircraft = {
  callsign: string;
  playerName: string;
  aircraftType: string;
  altitude: number;
  heading: number;
  speed: number;
  groundSpeed: number;
  wind: string;
  isOnGround: boolean;
  isEmergencyOccuring: boolean;
  x: number;
  y: number;
};

export type Controller = {
  holder: string;
  airport: string;
  position: string;
  heldSince: number;
  claimable: boolean;
  queue: string[];
};

export type Atis = {
  airport: string;
  letter: string;
  lines: string[];
  content: string;
};

export const getRadarSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const [rawAcft, controllers, atis] = await Promise.all([
    getJson("/acft-data") as Promise<Record<string, any>>,
    getJson("/controllers") as Promise<Controller[]>,
    getJson("/atis") as Promise<Atis[]>,
  ]);

  const aircraft: Aircraft[] = Object.entries(rawAcft).map(([callsign, a]) => ({
    callsign,
    playerName: a.playerName ?? "",
    aircraftType: a.aircraftType ?? "Unknown",
    altitude: Math.round(a.altitude ?? 0),
    heading: Math.round(a.heading ?? 0),
    speed: Math.round(a.speed ?? 0),
    groundSpeed: Math.round(a.groundSpeed ?? a.speed ?? 0),
    wind: a.wind ?? "",
    isOnGround: Boolean(a.isOnGround),
    isEmergencyOccuring: Boolean(a.isEmergencyOccuring),
    x: a.position?.x ?? 0,
    y: a.position?.y ?? 0,
  }));

  return {
    aircraft,
    controllers: controllers ?? [],
    atis: atis ?? [],
    fetchedAt: Date.now(),
  };
});
