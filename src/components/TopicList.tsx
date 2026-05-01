interface Topic {
  id: number;
  name: string;
  status: string;
  description: string;
  started_date: string;
  last_updated: string;
}

interface Props {
  topics: Topic[];
  loading: boolean;
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function getStatusIndicator(status: string, lastUpdated: string): { color: string; label: string } {
  switch (status) {
    case 'active':
      return { color: '#16a34a', label: 'ACTIVE' };
    case 'concluded':
      return { color: '#6b7280', label: 'CONCLUDED' };
    case 'dropped':
      return { color: '#dc2626', label: 'DROPPED' };
    case 'ongoing':
      return { color: '#d97706', label: 'ONGOING' };
    default:
      return { color: '#6b7280', label: status.toUpperCase() };
  }
}

export default function TopicList({ topics, loading }: Props) {
  if (loading) {
    return (
      <div className="p-3">
        <div className="text-xs font-bold tracking-wider mb-3" style={{ fontFamily: 'monospace', color: '#999' }}>MAJOR TOPICS</div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse mb-3">
            <div className="h-3 bg-neutral-100 rounded w-2/3 mb-1" />
            <div className="h-2 bg-neutral-50 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="text-xs font-bold tracking-wider mb-3" style={{ fontFamily: 'monospace', color: '#999' }}>MAJOR TOPICS</div>
      <div className="space-y-0">
        {topics.map((topic) => {
          const indicator = getStatusIndicator(topic.status, topic.last_updated);
          const daysSinceUpdate = daysSince(topic.last_updated);
          const isDropped = topic.status === 'dropped';

          return (
            <div
              key={topic.id}
              className="py-2 border-b border-neutral-100 last:border-b-0"
              style={isDropped ? { backgroundColor: '#fef2f2' } : undefined}
            >
              <div className="flex items-start gap-2">
                <div
                  className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: indicator.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold text-neutral-900"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {topic.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '8px',
                        color: indicator.color,
                        border: `1px solid ${indicator.color}30`,
                        backgroundColor: `${indicator.color}08`,
                        padding: '0 3px',
                      }}
                    >
                      {indicator.label}
                    </span>
                  </div>
                  <div
                    className="text-xs text-neutral-500 mt-0.5"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {topic.description}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#bbb' }}>
                      Started {topic.started_date.slice(0, 10)}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#bbb' }}>·</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: isDropped ? '#dc2626' : '#bbb' }}>
                      {daysSinceUpdate === 0 ? 'Updated today' : `${daysSinceUpdate}d since update`}
                    </span>
                  </div>
                  {isDropped && (
                    <div
                      className="mt-1 text-xs"
                      style={{ fontFamily: 'monospace', color: '#dc2626', fontSize: '9px' }}
                    >
                      ⚠ No concluding coverage found. Status uncertain.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
