import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getRadarSnapshot } from "@/lib/ptfs.functions";
import { RadarMap } from "@/components/RadarMap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ATC365 Flight Radar — Live PTFS Traffic" },
      {
        name: "description",
        content:
          "Live radar for Pilot Training Flight Simulator: track aircraft, online ATC, ATIS and charts for the ATC365 community.",
      },
      { property: "og:title", content: "ATC365 Flight Radar — Live PTFS Traffic" },
      {
        property: "og:description",
        content: "Track live PTFS aircraft, online controllers, ATIS and charts.",
      },
    ],
  }),
  component: RadarPage,
});

type Tab = "flights" | "atc" | "atis" | "charts";

function RadarPage() {
  const fetchSnapshot = useServerFn(getRadarSnapshot);
  const { data, isLoading } = useQuery({
    queryKey: ["radar"],
    queryFn: () => fetchSnapshot({}),
    refetchInterval: 6000,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("flights");
  const [search, setSearch] = useState("");

  const aircraft = data?.aircraft ?? [];
  const flights = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...aircraft]
      .filter(
        (a) =>
          !q ||
          a.callsign.toLowerCase().includes(q) ||
          a.playerName.toLowerCase().includes(q) ||
          a.aircraftType.toLowerCase().includes(q),
      )
      .sort((a, b) => b.altitude - a.altitude);
  }, [aircraft, search]);

  const sel = aircraft.find((a) => a.callsign === selected) ?? null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded bg-primary px-2 py-1 font-mono text-xs font-bold text-primary-foreground">
            ATC365
          </span>
          <h1 className="text-sm font-semibold tracking-wide">FLIGHT RADAR</h1>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
          <span>{aircraft.length} ACFT</span>
          <span>{data?.controllers.length ?? 0} ATC</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            {isLoading ? "SYNC" : "LIVE"}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[45vh] flex-1">
          <RadarMap aircraft={aircraft} selected={selected} onSelect={setSelected} />
          {sel && (
            <div className="absolute left-4 top-4 w-64 rounded-lg border border-border bg-card/95 p-3 font-mono text-xs shadow-lg backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-accent">{sel.callsign}</span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-muted-foreground">{sel.aircraftType}</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1">
                <Row k="PILOT" v={sel.playerName} />
                <Row k="ALT" v={`${sel.altitude} ft`} />
                <Row k="GS" v={`${sel.groundSpeed} kt`} />
                <Row k="HDG" v={`${String(sel.heading).padStart(3, "0")}°`} />
                <Row k="WIND" v={sel.wind || "—"} />
                <Row k="STATE" v={sel.isOnGround ? "GROUND" : "AIRBORNE"} />
              </dl>
              {sel.isEmergencyOccuring && (
                <p className="mt-2 rounded bg-destructive px-2 py-1 text-destructive-foreground">
                  EMERGENCY
                </p>
              )}
            </div>
          )}
        </div>

        <aside className="flex w-full flex-col border-t border-border bg-sidebar lg:h-full lg:w-96 lg:border-l lg:border-t-0">
          <nav className="flex border-b border-border">
            {(["flights", "atc", "atis", "charts"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2 font-mono text-xs uppercase transition-colors ${
                  tab === t
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "flights" && (
              <div>
                <div className="p-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search callsign, pilot, type…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring"
                  />
                </div>
                <ul>
                  {flights.map((a) => (
                    <li key={a.callsign}>
                      <button
                        onClick={() => setSelected(a.callsign)}
                        className={`flex w-full items-center justify-between border-b border-border px-3 py-2 text-left font-mono text-xs hover:bg-secondary ${
                          selected === a.callsign ? "bg-secondary" : ""
                        }`}
                      >
                        <span>
                          <span
                            className={
                              a.isEmergencyOccuring ? "text-destructive" : "text-foreground"
                            }
                          >
                            {a.callsign}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {a.aircraftType} · {a.playerName}
                          </span>
                        </span>
                        <span className="text-right text-muted-foreground">
                          {a.altitude} ft
                          <span className="block text-[10px]">{a.groundSpeed} kt</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {!flights.length && (
                    <li className="p-4 text-center font-mono text-xs text-muted-foreground">
                      No traffic
                    </li>
                  )}
                </ul>
              </div>
            )}

            {tab === "atc" && (
              <ul>
                {(data?.controllers ?? []).map((c) => (
                  <li
                    key={`${c.airport}-${c.position}`}
                    className="border-b border-border px-3 py-2 font-mono text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="text-primary">
                        {c.airport}_{c.position}
                      </span>
                      <span className="text-muted-foreground">{c.holder}</span>
                    </div>
                    {c.queue.length > 0 && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Queue: {c.queue.length}
                      </p>
                    )}
                  </li>
                ))}
                {!data?.controllers.length && (
                  <li className="p-4 text-center font-mono text-xs text-muted-foreground">
                    No controllers online
                  </li>
                )}
              </ul>
            )}

            {tab === "atis" && (
              <ul>
                {(data?.atis ?? []).map((a) => (
                  <li key={a.airport} className="border-b border-border px-3 py-2">
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-primary">{a.airport}</span>
                      <span className="text-accent">INFO {a.letter}</span>
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                      {a.content}
                    </pre>
                  </li>
                ))}
                {!data?.atis.length && (
                  <li className="p-4 text-center font-mono text-xs text-muted-foreground">
                    No ATIS published
                  </li>
                )}
              </ul>
            )}

            {tab === "charts" && (
              <div className="space-y-3 p-4 font-mono text-xs">
                <p className="text-muted-foreground">
                  Official PTFS chart sources used by ATC365.
                </p>
                <a
                  className="block rounded-md border border-border bg-card px-3 py-3 hover:border-primary"
                  href="https://ptfs.app/charts"
                  target="_blank"
                  rel="noreferrer"
                >
                  PTFS.app — Ground charts
                </a>
                <a
                  className="block rounded-md border border-border bg-card px-3 py-3 hover:border-primary"
                  href="https://aeronav.space/app"
                  target="_blank"
                  rel="noreferrer"
                >
                  AeroNav — Procedures &amp; approach plates
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right text-foreground">{v}</dd>
    </>
  );
}
