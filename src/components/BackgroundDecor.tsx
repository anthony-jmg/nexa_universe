const dots = [
  { top: '9%', left: '6%', size: 'w-1 h-1', opacity: 'opacity-35' },
  { top: '13%', left: '18%', size: 'w-1.5 h-1.5', opacity: 'opacity-25' },
  { top: '8%', left: '31%', size: 'w-1 h-1', opacity: 'opacity-30' },
  { top: '17%', left: '43%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '11%', left: '58%', size: 'w-1.5 h-1.5', opacity: 'opacity-30' },
  { top: '15%', left: '73%', size: 'w-1 h-1', opacity: 'opacity-35' },
  { top: '8%', left: '91%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '25%', left: '11%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '29%', left: '27%', size: 'w-1.5 h-1.5', opacity: 'opacity-30' },
  { top: '23%', left: '49%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '31%', left: '66%', size: 'w-1 h-1', opacity: 'opacity-35' },
  { top: '26%', left: '84%', size: 'w-1.5 h-1.5', opacity: 'opacity-25' },
  { top: '42%', left: '5%', size: 'w-1.5 h-1.5', opacity: 'opacity-25' },
  { top: '47%', left: '19%', size: 'w-1 h-1', opacity: 'opacity-30' },
  { top: '39%', left: '38%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '52%', left: '57%', size: 'w-1.5 h-1.5', opacity: 'opacity-30' },
  { top: '44%', left: '76%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '49%', left: '94%', size: 'w-1 h-1', opacity: 'opacity-35' },
  { top: '63%', left: '9%', size: 'w-1 h-1', opacity: 'opacity-30' },
  { top: '69%', left: '24%', size: 'w-1.5 h-1.5', opacity: 'opacity-25' },
  { top: '61%', left: '45%', size: 'w-1 h-1', opacity: 'opacity-35' },
  { top: '72%', left: '68%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '65%', left: '87%', size: 'w-1.5 h-1.5', opacity: 'opacity-30' },
  { top: '84%', left: '15%', size: 'w-1 h-1', opacity: 'opacity-25' },
  { top: '89%', left: '35%', size: 'w-1 h-1', opacity: 'opacity-30' },
  { top: '82%', left: '54%', size: 'w-1.5 h-1.5', opacity: 'opacity-25' },
  { top: '91%', left: '77%', size: 'w-1 h-1', opacity: 'opacity-35' },
  { top: '86%', left: '95%', size: 'w-1 h-1', opacity: 'opacity-25' },
];

export function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {dots.map((dot, index) => (
        <span
          key={`${dot.top}-${dot.left}`}
          className={`absolute rounded-full bg-[#D4AC5B] shadow-[0_0_8px_rgba(212,172,91,0.35)] ${dot.size} ${dot.opacity}`}
          style={{ top: dot.top, left: dot.left, animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}
