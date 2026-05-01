import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { omProtocol, normalizeUrl } from '@openmeteo/weather-map-layer';

interface WeatherPoint {
  id: number;
  region_name: string;
  region_code: string;
  lat: number;
  lon: number;
  temperature_c: number;
  condition: string;
  is_hot_zone: boolean;
  is_hurricane: boolean;
}

interface CasualtyPoint {
  id: number;
  region_name: string;
  lat: number;
  lon: number;
  casualties_reported: number;
  casualties_estimated: number | null;
  event_type: string;
  reporting_reliability: string;
  timestamp: string;
}

interface Props {
  weatherData: WeatherPoint[];
  casualtyData: CasualtyPoint[];
  mode: 'weather' | 'casualty';
}

const WX_LAYER_ID = 'om-weather-layer';
const WX_SOURCE_ID = 'om-weather-source';
const OM_MODEL_BASE = 'https://map-tiles.open-meteo.com/data_spatial/dwd_icon';

type Variable = 'temperature_2m' | 'precipitation' | 'wind_gusts_10m';
const VARIABLE_LABELS: Record<Variable, string> = {
  temperature_2m: 'TEMPERATURE @ 2M',
  precipitation: 'PRECIPITATION',
  wind_gusts_10m: 'WIND GUSTS @ 10M',
};

const SLIDER_RANGE_H = 24;

// Register the Open-Meteo `om://` protocol once for the lifetime of the page.
let omProtocolRegistered = false;
function ensureOmProtocol() {
  if (omProtocolRegistered) return;
  maplibregl.addProtocol('om', omProtocol);
  omProtocolRegistered = true;
}

const BASE_STYLE_URL = 'https://map-assets.open-meteo.com/styles/minimal-planet-maps.json';

function casualtyToColor(casualties: number): string {
  if (casualties >= 10000) return '#7f1d1d';
  if (casualties >= 1000) return '#991b1b';
  if (casualties >= 100) return '#dc2626';
  if (casualties >= 10) return '#ef4444';
  return '#fca5a5';
}

function reliabilityToOpacity(reliability: string): number {
  switch (reliability) {
    case 'confirmed': return 1;
    case 'likely': return 0.75;
    case 'unverified': return 0.5;
    case 'unknown': return 0.3;
    default: return 0.6;
  }
}

// Build the openmeteo data URL using the protocol's `current_time` capture so
// we don't need a separate metadata fetch to resolve the model run path —
// the protocol does that itself when the tile request fires.
function buildOmUrl(variable: Variable, offsetH: number): string {
  let timeStep: string;
  if (offsetH === 0) timeStep = 'current_time';
  else if (offsetH > 0) timeStep = `current_time+${offsetH}H`;
  else timeStep = `current_time${offsetH}H`; // negative number already carries the sign
  return `${OM_MODEL_BASE}/latest.json?variable=${variable}&time_step=${timeStep}`;
}

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

export default function WorldMap({ weatherData, casualtyData, mode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<{ name: string; info: string } | null>(null);

  const [variable, setVariable] = useState<Variable>('temperature_2m');
  const [timeOffsetH, setTimeOffsetH] = useState(0);

  // Initialize MapLibre map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureOmProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE_URL,
      center: [10, 25],
      zoom: 1.3,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add / replace the weather raster source+layer whenever the URL inputs change.
  //
  // We pre-resolve `latest.json?...&time_step=...` to the concrete `.om` file URL
  // ourselves via the protocol's exported `normalizeUrl`. We can't pass the
  // `latest.json` URL directly to MapLibre as the source URL: MapLibre builds
  // tile URLs by string-appending `/{z}/{x}/{y}` to the source URL, which would
  // corrupt the trailing `time_step` query value (e.g. `current_time/1/1/0`)
  // and the protocol's internal parseMetaJson then throws "Modifier or amount
  // not supported" for every tile, leaving the layer blank.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    const apply = async () => {
      const sourceUrl = buildOmUrl(variable, timeOffsetH);

      let resolvedUrl: string;
      try {
        resolvedUrl = await normalizeUrl('om://' + sourceUrl);
      } catch (err) {
        if (!cancelled) console.error('[WorldMap] failed to resolve om URL', err);
        return;
      }
      if (cancelled) return;

      const m = mapRef.current;
      if (!m) return;

      if (m.getLayer(WX_LAYER_ID)) m.removeLayer(WX_LAYER_ID);
      if (m.getSource(WX_SOURCE_ID)) m.removeSource(WX_SOURCE_ID);

      m.addSource(WX_SOURCE_ID, {
        url: resolvedUrl,
        type: 'raster',
        maxzoom: 12,
      } as unknown as maplibregl.RasterSourceSpecification);

      const layers = m.getStyle().layers ?? [];
      const beforeId = layers.find((l) => l.type === 'line' || l.type === 'symbol')?.id;

      m.addLayer(
        {
          id: WX_LAYER_ID,
          type: 'raster',
          source: WX_SOURCE_ID,
          paint: { 'raster-opacity': 0.7 },
          layout: { visibility: mode === 'weather' ? 'visible' : 'none' },
        },
        beforeId,
      );
    };

    const onLoad = () => { void apply(); };

    if (map.isStyleLoaded()) void apply();
    else map.once('load', onLoad);

    return () => {
      cancelled = true;
      map.off('load', onLoad);
    };
  }, [variable, timeOffsetH, mode]);

  // Render markers for the active dataset.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (mode === 'weather') {
      weatherData.forEach((point) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(23,23,23,0.85);
          color: #171717;
          display: flex; align-items: center; justify-content: center;
          font-family: monospace; font-size: 10px; font-weight: 700;
          cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        `;
        el.textContent = `${Math.round(point.temperature_c)}°`;
        if (point.is_hot_zone) {
          el.style.borderColor = '#dc2626';
          el.style.color = '#dc2626';
        }
        if (point.is_hurricane) {
          el.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.25), 0 1px 2px rgba(0,0,0,0.15)';
        }

        const info = `${point.temperature_c}°C · ${point.condition}` +
          `${point.is_hurricane ? ' · HURRICANE' : ''}` +
          `${point.is_hot_zone ? ' · HOT ZONE' : ''}`;
        el.addEventListener('mouseenter', () =>
          setHoveredPoint({ name: point.region_name, info }),
        );
        el.addEventListener('mouseleave', () => setHoveredPoint(null));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([point.lon, point.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    } else {
      casualtyData.forEach((point) => {
        const size = Math.max(10, Math.min(40, Math.log10(Math.max(point.casualties_reported, 1)) * 12));
        const el = document.createElement('div');
        el.style.cssText = `
          width: ${size}px; height: ${size}px; border-radius: 50%;
          background: ${casualtyToColor(point.casualties_reported)};
          opacity: ${reliabilityToOpacity(point.reporting_reliability)};
          border: 1px solid rgba(0,0,0,0.4);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: white; font-family: monospace; font-size: 10px; font-weight: 700;
        `;
        if (point.reporting_reliability === 'unknown') el.textContent = '?';

        const info = `${point.casualties_reported} reported` +
          `${point.casualties_estimated ? ` · ~${point.casualties_estimated} est.` : ''}` +
          ` · ${point.reporting_reliability} · ${point.event_type}`;
        el.addEventListener('mouseenter', () =>
          setHoveredPoint({ name: point.region_name, info }),
        );
        el.addEventListener('mouseleave', () => setHoveredPoint(null));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([point.lon, point.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    }
  }, [mode, weatherData, casualtyData]);

  const overlayBoxStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: '#525252',
    background: 'rgba(255,255,255,0.92)',
    padding: '3px 6px',
    border: '1px solid #e5e5e5',
  };

  // Snap the displayed time to the start of the current UTC hour, then offset.
  const baseHourMs = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const selectedMs = baseHourMs + timeOffsetH * 3_600_000;
  const offsetLabel =
    timeOffsetH === 0 ? 'NOW' : `${timeOffsetH > 0 ? '+' : ''}${timeOffsetH}h`;

  return (
    <div className="relative w-full h-full bg-white">
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-left: variable selector (weather mode) or static label (casualty mode) */}
      {mode === 'weather' ? (
        <div className="absolute top-2 left-2 flex items-center gap-2" style={overlayBoxStyle}>
          <span>VARIABLE:</span>
          <select
            value={variable}
            onChange={(e) => setVariable(e.target.value as Variable)}
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#171717',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="temperature_2m">{VARIABLE_LABELS.temperature_2m}</option>
            <option value="precipitation">{VARIABLE_LABELS.precipitation}</option>
            <option value="wind_gusts_10m">{VARIABLE_LABELS.wind_gusts_10m}</option>
          </select>
          <span style={{ color: '#999' }}>· OPEN-METEO · DWD ICON</span>
        </div>
      ) : (
        <div className="absolute top-2 left-2 pointer-events-none" style={overlayBoxStyle}>
          CASUALTY EVENTS
        </div>
      )}

      {/* Top-right: timeline (weather mode only) */}
      {mode === 'weather' && (
        <div
          className="absolute top-2 right-2 flex items-center gap-2"
          style={{ ...overlayBoxStyle, minWidth: 380 }}
        >
          <button
            onClick={() => setTimeOffsetH(0)}
            style={{
              fontFamily: 'monospace',
              fontSize: '9px',
              padding: '1px 5px',
              background: timeOffsetH === 0 ? '#171717' : '#f5f5f5',
              color: timeOffsetH === 0 ? 'white' : '#525252',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            NOW
          </button>
          <span style={{ color: '#999', fontSize: '9px' }}>-{SLIDER_RANGE_H}h</span>
          <input
            type="range"
            min={-SLIDER_RANGE_H}
            max={SLIDER_RANGE_H}
            step={1}
            value={timeOffsetH}
            onChange={(e) => setTimeOffsetH(Number(e.target.value))}
            style={{ flex: 1, minWidth: 180, accentColor: '#171717' }}
          />
          <span style={{ color: '#999', fontSize: '9px' }}>+{SLIDER_RANGE_H}h</span>
          <span style={{ color: '#171717', fontSize: '10px', fontWeight: 700, minWidth: 130, textAlign: 'right' }}>
            {formatUtc(selectedMs)} ({offsetLabel})
          </span>
        </div>
      )}

      {/* Temperature legend (only meaningful for the temperature variable) */}
      {mode === 'weather' && variable === 'temperature_2m' && (
        <div
          className="absolute bottom-2 right-2 flex items-center gap-1 pointer-events-none"
          style={{ ...overlayBoxStyle, fontSize: '9px' }}
        >
          <span>-10°C</span>
          <div style={{ width: 110, height: 8, background: 'linear-gradient(to right, #8b5cf6, #6366f1, #3b82f6, #06b6d4, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #dc2626)' }} />
          <span>40°C+</span>
        </div>
      )}

      {/* Generic low/high indicator for non-temperature variables */}
      {mode === 'weather' && variable !== 'temperature_2m' && (
        <div
          className="absolute bottom-2 right-2 pointer-events-none"
          style={{ ...overlayBoxStyle, fontSize: '9px' }}
        >
          {VARIABLE_LABELS[variable]} · LOW → HIGH (open-meteo palette)
        </div>
      )}

      {/* Casualty legend */}
      {mode === 'casualty' && (
        <div
          className="absolute bottom-2 right-2 flex items-center gap-2 pointer-events-none"
          style={{ ...overlayBoxStyle, fontSize: '9px' }}
        >
          <span>CASUALTIES:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, background: '#fca5a5', borderRadius: '50%' }} />&lt;10
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: '50%' }} />10+
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 12, height: 12, background: '#dc2626', borderRadius: '50%' }} />100+
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 14, height: 14, background: '#991b1b', borderRadius: '50%' }} />1K+
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 16, height: 16, background: '#7f1d1d', borderRadius: '50%' }} />10K+
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredPoint && (
        <div
          className="absolute bottom-2 left-2 bg-white border border-neutral-200 px-3 py-2 shadow-sm pointer-events-none"
          style={{ fontSize: '11px' }}
        >
          <div className="font-bold" style={{ fontFamily: 'monospace' }}>{hoveredPoint.name}</div>
          <div style={{ fontFamily: 'monospace', color: '#666' }}>{hoveredPoint.info}</div>
        </div>
      )}
    </div>
  );
}
