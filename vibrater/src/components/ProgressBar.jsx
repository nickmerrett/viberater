export default function ProgressBar({ progress, currentPhase }) {
  const phases = [
    { key: 'purpose', label: 'Purpose', icon: '🎯' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'features', label: 'Features', icon: '✨' },
    { key: 'implementation', label: 'Tech', icon: '🔧' }
  ];

  return (
    <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-white/10 bg-surface/50">
      {phases.map((phase, index) => {
        const isComplete = progress[phase.key];
        const isCurrent = phase.key === currentPhase;

        return (
          <div key={phase.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                  isComplete
                    ? 'bg-gradient-primary text-white shadow-lg shadow-primary/40'
                    : isCurrent
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'glass text-gray-500'
                }`}
              >
                {isComplete ? '✓' : phase.icon}
              </div>
              <div className={`text-xs mt-1 font-medium ${isCurrent ? 'text-primary' : isComplete ? 'text-white' : 'text-gray-500'}`}>
                {phase.label}
              </div>
            </div>

            {index < phases.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 ${isComplete ? 'bg-primary' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
