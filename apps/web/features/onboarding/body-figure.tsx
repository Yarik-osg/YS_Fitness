export function bodySliderSrc(track: 'female' | 'male', step: number) {
  return `/marketing/body-slider/${track}-${step}.svg`;
}

export function currentBodyPhoto(track: 'female' | 'male', index: number) {
  return `/marketing/body-current/${track}-${String(index + 1).padStart(2, '0')}.jpg`;
}

export function desiredBodyPhoto(track: 'female' | 'male', index: number) {
  return `/marketing/body-desired/${track}-${index + 1}.jpg`;
}

export function isLocalSvg(src?: string) {
  return Boolean(src?.endsWith('.svg'));
}

export function BodyFigure({
  src,
  className,
  color = 'var(--accent)',
}: {
  src: string;
  className?: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        backgroundColor: color,
        maskImage: `url("${src}")`,
        WebkitMaskImage: `url("${src}")`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center top',
        WebkitMaskPosition: 'center top',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
      }}
    />
  );
}
