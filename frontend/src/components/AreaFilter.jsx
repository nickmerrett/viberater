import { useAreaStore } from '../store/useAreaStore';

export default function AreaFilter() {
  const { areas, activeArea, setActive } = useAreaStore();

  if (!areas.length) return null;

  return (
    <div className="flex gap-1.5 px-3 py-2 sm:px-6 overflow-x-auto flex-shrink-0 border-b border-white/5">
      <button
        onClick={() => setActive(null)}
        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
          activeArea === null
            ? 'bg-white/15 text-white'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        All
      </button>
      {areas.map(area => (
        <button
          key={area.id}
          onClick={() => setActive(activeArea === area.id ? null : area.id)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
            activeArea === area.id
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          style={activeArea === area.id ? { backgroundColor: area.color + '33', color: area.color, border: `1px solid ${area.color}55` } : {}}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: area.color }}
          />
          {area.name}
        </button>
      ))}
    </div>
  );
}
