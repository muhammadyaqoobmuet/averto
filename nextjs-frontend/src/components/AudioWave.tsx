'use client';

interface AudioWaveProps {
  color?: string;
  bars?: number;
  className?: string;
}

export default function AudioWave({ color = '#71717a', bars = 5, className = '' }: AudioWaveProps) {
  return (
    <div className={`audio-wave flex items-end gap-[3px] h-4 ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="audio-wave-bar w-[3px] rounded-full"
          style={{
            background: color,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}
