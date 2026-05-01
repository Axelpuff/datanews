interface Props {
  financialData: { symbol: string; name: string; value: number; change: number }[];
}

export default function FinancialBar({ financialData }: Props) {
  return (
    <div className="border-t border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-4 px-3 py-2 overflow-x-auto">
        <span
          className="shrink-0 text-xs font-bold tracking-wider"
          style={{ fontFamily: 'monospace', color: '#999', fontSize: '9px' }}
        >
          MARKETS ▸
        </span>
        {financialData.map((item) => (
          <div key={item.symbol} className="shrink-0 flex items-center gap-1.5">
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#737373' }}>
              {item.symbol}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#171717' }}>
              {item.value.toLocaleString()}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                color: item.change >= 0 ? '#16a34a' : '#dc2626',
              }}
            >
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
            </span>
          </div>
        ))}
        <span style={{ fontFamily: 'monospace', fontSize: '8px', color: '#ccc' }}>
          · SECONDARY PRIORITY · REFLECTS MARKET CONSENSUS
        </span>
      </div>
    </div>
  );
}
