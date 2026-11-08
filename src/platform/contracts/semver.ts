export type Semver = [number, number, number];

export function parseSemver(value: string): Semver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[+-][0-9A-Za-z.-]+)?$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(left: Semver, right: Semver): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function satisfies(version: string, range: string): boolean {
  const target = parseSemver(version);
  if (!target) return false;
  const expression = range.trim();
  if (expression === '' || expression === '*') return true;
  if (expression.includes('||')) {
    return expression.split('||').some((part) => satisfies(version, part));
  }
  return splitComparators(expression).every((comparator) => evaluateComparator(target, comparator));
}

function splitComparators(expression: string): string[] {
  return expression
    .replace(/([<>]=?|=)/g, ' $1')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function evaluateComparator(target: Semver, comparator: string): boolean {
  if (comparator.startsWith('^')) {
    const base = parseSemver(comparator.slice(1));
    if (!base) return false;
    return compareSemver(target, base) >= 0 && compareSemver(target, [base[0] + 1, 0, 0]) < 0;
  }
  if (comparator.startsWith('~')) {
    const base = parseSemver(comparator.slice(1));
    if (!base) return false;
    return compareSemver(target, base) >= 0 && compareSemver(target, [base[0], base[1] + 1, 0]) < 0;
  }
  const match = /^(>=|<=|>|<|=)?(.+)$/.exec(comparator);
  if (!match) return false;
  const operator = match[1] ?? '=';
  const base = parseSemver(match[2]);
  if (!base) return false;
  const order = compareSemver(target, base);
  switch (operator) {
    case '>=':
      return order >= 0;
    case '<=':
      return order <= 0;
    case '>':
      return order > 0;
    case '<':
      return order < 0;
    default:
      return order === 0;
  }
}
