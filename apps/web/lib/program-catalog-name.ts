const CATALOG_CODE = /^[WM][BMP][234][A-Z]?$/;

export function programCatalogName(template: { name: string }) {
  const suffix = ' - copy';
  let base = template.name;
  let copies = '';
  while (base.endsWith(suffix)) {
    base = base.slice(0, -suffix.length);
    copies += suffix;
  }
  const [head, ...rest] = base.split(' — ');
  const tail = rest.join(' — ');
  const code = head?.trim() ?? '';
  const label = CATALOG_CODE.test(code) && tail.includes('·') ? code : base;
  return `${label}${copies}`;
}
