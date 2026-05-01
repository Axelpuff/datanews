import { useState, useEffect } from 'react';
import WorldMap from './components/WorldMap';
import EventPanel from './components/EventPanel';
import TopicList from './components/TopicList';
import WarningModal from './components/WarningModal';
import FinancialBar from './components/FinancialBar';

interface Event {
  id: number;
  headline: string;
  source_url: string;
  source_name: string;
  category: string;
  timestamp: string;
  is_primary_source: boolean;
  llm_summarized: boolean;
  llm_model: string | null;
  event_type: string;
  location_name: string | null;
}

interface Topic {
  id: number;
  name: string;
  status: string;
  description: string;
  started_date: string;
  last_updated: string;
}

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

interface FinancialItem {
  symbol: string;
  name: string;
  value: number;
  change: number;
}

export default function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherPoint[]>([]);
  const [casualtyData, setCasualtyData] = useState<CasualtyPoint[]>([]);
  const [financialData, setFinancialData] = useState<FinancialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapMode, setMapMode] = useState<'weather' | 'casualty'>('weather');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchAll = async () => {
    try {
      const [eventsRes, topicsRes, weatherRes, casualtiesRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/topics'),
        fetch('/api/weather'),
        fetch('/api/casualties'),
      ]);

      const eventsData = await eventsRes.json();
      const topicsData = await topicsRes.json();
      const weatherDataRes = await weatherRes.json();
      const casualtiesDataRes = await casualtiesRes.json();

      setEvents(eventsData);
      setTopics(topicsData);
      setWeatherData(weatherDataRes);
      setCasualtyData(casualtiesDataRes);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Financial data - secondary priority, from events with category 'economy'
  useEffect(() => {
    const financialItems: FinancialItem[] = [
      { symbol: 'SPX', name: 'S&P 500', value: 5942, change: 0.32 },
      { symbol: 'DJI', name: 'Dow Jones', value: 43958, change: -0.15 },
      { symbol: 'IXIC', name: 'NASDAQ', value: 19246, change: 0.67 },
      { symbol: 'CL', name: 'Crude Oil', value: 61.5, change: -1.23 },
      { symbol: 'GC', name: 'Gold', value: 3338, change: 0.45 },
      { symbol: 'DX', name: 'USD Index', value: 99.2, change: -0.18 },
      { symbol: 'TNX', name: '10Y Yield', value: 4.28, change: 0.03 },
    ];
    setFinancialData(financialItems);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white" style={{ fontFamily: 'monospace' }}>
      <WarningModal />

      {/* Header */}
      <header className="shrink-0 border-b border-neutral-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-widest text-neutral-900">NOW</h1>
          <span className="text-xs text-neutral-400">|</span>
          <span className="text-xs text-neutral-500">WORLD DATA SURFACE</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-400">
            {currentTime.toISOString().slice(0, 19).replace('T', ' ')} UTC
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setMapMode('weather')}
              className="px-2 py-0.5 text-xs transition-colors"
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                backgroundColor: mapMode === 'weather' ? '#171717' : '#f5f5f5',
                color: mapMode === 'weather' ? 'white' : '#737373',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              WEATHER
            </button>
            <button
              onClick={() => setMapMode('casualty')}
              className="px-2 py-0.5 text-xs transition-colors"
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                backgroundColor: mapMode === 'casualty' ? '#171717' : '#f5f5f5',
                color: mapMode === 'casualty' ? 'white' : '#737373',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              CASUALTIES
            </button>
          </div>
        </div>
      </header>

      {/* Financial bar */}
      <FinancialBar financialData={financialData} />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left column: Map + Topics */}
        <div className="flex flex-col" style={{ width: '58%' }}>
          {/* Map */}
          <div className="flex-1 border-b border-neutral-200 min-h-0">
            <WorldMap weatherData={weatherData} casualtyData={casualtyData} mode={mapMode} />
          </div>
          {/* Topics */}
          <div className="overflow-y-auto" style={{ maxHeight: '40%' }}>
            <TopicList topics={topics} loading={loading} />
          </div>
        </div>

        {/* Right column: Events */}
        <div className="border-l border-neutral-200" style={{ width: '42%' }}>
          <EventPanel events={events} loading={loading} />
        </div>
      </div>
    </div>
  );
}
