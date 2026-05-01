import { useState, useEffect } from 'react';

export default function WarningModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('warning-dismissed');
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('warning-dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        className="bg-white border border-neutral-300 max-w-lg w-full mx-4 shadow-lg"
        style={{ fontFamily: 'monospace' }}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-xs font-bold tracking-widest text-neutral-500">DISCLAIMER</span>
          </div>

          <p className="text-sm leading-relaxed text-neutral-800 mb-4">
            Even seemingly factual information can be spun. Curation of published news by nations and news agencies can lead to misrepresentative distributions of coverage. Use with caution.
          </p>

          <div className="border-t border-neutral-200 pt-4 mt-4">
            <p className="text-xs text-neutral-500 mb-3">
              This application uses LLMs for summarization only. LLM use is always indicated on individual items. No LLM is used to judge what should or should not be shown. Curation decisions follow transparent, rule-based criteria.
            </p>
            <p className="text-xs text-neutral-400 mb-4">
              Casualty figures reflect reported numbers only. Absence of reports does not indicate absence of events. Regions with suppressed or absent reporting are marked accordingly.
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full py-2 bg-neutral-900 text-white text-xs tracking-wider hover:bg-neutral-800 transition-colors"
          >
            I UNDERSTAND
          </button>
        </div>
      </div>
    </div>
  );
}
