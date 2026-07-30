import { cn, initials, avatarGradient } from '@/lib/utils';

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}

export function Avatar({ name, url, size = 40, className, ring }: AvatarProps) {
  const dim = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={dim}
        className={cn('rounded-full object-cover', ring && 'ring-2 ring-white/20', className)}
      />
    );
  }
  return (
    <div
      style={dim}
      className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold shrink-0',
        avatarGradient(name),
        ring && 'ring-2 ring-white/20',
        className
      )}
    >
      <span style={{ fontSize: size * 0.38 }}>{initials(name)}</span>
    </div>
  );
}
