import { useAreaStore } from '../store/useAreaStore';

export default function AreaBadge({ areaId, className = '' }) {
  const area = useAreaStore(s => s.getById(areaId));
  if (!area) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: area.color + '22', color: area.color, border: `1px solid ${area.color}44` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: area.color }} />
      {area.name}
    </span>
  );
}
