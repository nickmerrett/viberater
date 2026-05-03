import { useAreaStore } from '../store/useAreaStore';

export default function AreaSelect({ value, onChange, className = '' }) {
  const areas = useAreaStore(s => s.areas);

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary/40 transition-colors ${className}`}
    >
      <option value="">No area</option>
      {areas.map(area => (
        <option key={area.id} value={area.id}>{area.name}</option>
      ))}
    </select>
  );
}
