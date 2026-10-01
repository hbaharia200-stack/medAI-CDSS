export type DeltaDirection = 'up' | 'down' | 'neutral';

const VARIANTS: Record<DeltaDirection, string> = {
  up: 'bg-green-50 text-green-700 border border-green-200/50',
  down: 'bg-red-50 text-red-700 border border-red-200/50',
  neutral: 'bg-gray-100 text-gray-600 border border-gray-200/50',
};

const ARROW: Record<DeltaDirection, string> = {
  up: '▲',
  down: '▼',
  neutral: '◆',
};

interface DeltaBadgeProps {
  value: string;
  direction: DeltaDirection;
}

export function DeltaBadge({ value, direction }: DeltaBadgeProps) {
  return (
    <span
      className={"inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold " + VARIANTS[direction]}
    >
      <span aria-hidden className="text-[10px]">{ARROW[direction]}</span>
      {value}
    </span>
  );
}

export default DeltaBadge;
