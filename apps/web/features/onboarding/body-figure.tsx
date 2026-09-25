export function bodySliderSrc(track: 'female' | 'male', step: number) {
  return `/marketing/body-slider/${track}-${step}.svg`;
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
