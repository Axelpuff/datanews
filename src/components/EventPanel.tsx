import { useState } from 'react';

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

interface Props {
  events: Event[];
  loading: boolean;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function getCategoryTag(category: string): { label: string; color: string } {
  switch (category) {
    case 'conflict': return { label: 'CONFLICT', color: '#dc2626' };
    case 'politics': return { label: 'POLITICS', color: '#7c3aed' };
    case 'economy': return { label: 'ECONOMY', color: '#0891b2' };
    case 'environment': return { label: 'ENVIRONMENT', color: '#16a34a' };
    case 'technology': return { label: 'TECHNOLOGY', color: '#2563eb' };
    case 'health': return { label: 'HEALTH', color: '#d97706' };
    case 'infrastructure': return { label: 'INFRA', color: '#64748b' };
    case 'diplomacy': return { label: 'DIPLOMACY', color: '#9333ea' };
    default: return { label: category.toUpperCase(), color: '#6b7280' };
  }
}

export default function EventPanel({ events, loading }: Props) {
  const [filter, setFilter] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(events.map(e => e.category)))];
  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter);

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-neutral-200">
          <div className="text-xs font-bold tracking-wider" style={{ fontFamily: 'monospace', color: '#999' }}>EVENTS</div>
        </div>
        <div className="flex-1 p-3 space-y-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-neutral-100 rounded w-3/4 mb-2" />
              <div className="h-2 bg-neutral-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold tracking-wider" style={{ fontFamily: 'monospace', color: '#999' }}>EVENTS</div>
          <div className="text-xs" style={{ fontFamily: 'monospace', color: '#bbb' }}>{filtered.length}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-2 py-0.5 text-xs transition-colors"
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                backgroundColor: filter === cat ? '#171717' : '#f5f5f5',
                color: filter === cat ? 'white' : '#737373',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((event) => {
          const tag = getCategoryTag(event.category);
          return (
            <a
              key={event.id}
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <div
                  className="shrink-0 px-1.5 py-0.5 mt-0.5"
                  style={{
                    fontSize: '8px',
                    fontFamily: 'monospace',
                    color: tag.color,
                    border: `1px solid ${tag.color}30`,
                    backgroundColor: `${tag.color}08`,
                    letterSpacing: '0.05em',
                  }}
                >
                  {tag.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm leading-snug text-neutral-900 group-hover:text-neutral-700"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {event.headline}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#aaa' }}>
                      {formatTimestamp(event.timestamp)}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#bbb' }}>·</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#aaa' }}>
                      {event.source_name}
                    </span>
                    {event.is_primary_source && (
                      <span style={{ fontFamily: 'monospace', fontSize: '8px', color: '#16a34a', border: '1px solid #16a34a30', backgroundColor: '#16a34a08', padding: '0 3px' }}>
                        PRIMARY
                      </span>
                    )}
                    {event.llm_summarized && (
                      <span style={{ fontFamily: 'monospace', fontSize: '8px', color: '#d97706', border: '1px solid #d9770630', backgroundColor: '#d9770608', padding: '0 3px' }}>
                        LLM:{event.llm_model || '?'}
                      </span>
                    )}
                    {event.location_name && (
                      <>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#bbb' }}>·</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#999' }}>{event.location_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
