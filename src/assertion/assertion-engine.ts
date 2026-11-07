export type AssertionLevel = 'ui' | 'business' | 'persistence';

export interface AssertionResult {
  level: AssertionLevel;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  detail?: string;
}

export interface VisibleLike {
  isVisible(): Promise<boolean>;
}

export class AssertionEngine {
  private results: AssertionResult[] = [];

  record(result: AssertionResult): void {
    this.results.push(result);
  }

  equals(level: AssertionLevel, name: string, actual: unknown, expected: unknown): boolean {
    const left = normalize(actual);
    const right = normalize(expected);
    const passed = left === right;
    this.record({ level, name, expected: right, actual: left, passed });
    return passed;
  }

  contains(level: AssertionLevel, name: string, actual: unknown, expected: string): boolean {
    const text = normalize(actual);
    const passed = text.includes(expected);
    this.record({ level, name, expected: `包含 ${expected}`, actual: text, passed });
    return passed;
  }

  gte(level: AssertionLevel, name: string, actual: number, expected: number): boolean {
    const passed = Number.isFinite(actual) && actual >= expected;
    this.record({ level, name, expected: `>= ${expected}`, actual: String(actual), passed });
    return passed;
  }

  async visible(level: AssertionLevel, name: string, target: VisibleLike): Promise<boolean> {
    let passed = false;
    try {
      passed = await target.isVisible();
    } catch {
      passed = false;
    }
    this.record({ level, name, expected: '可见', actual: passed ? '可见' : '不可见', passed });
    return passed;
  }

  all(): AssertionResult[] {
    return [...this.results];
  }

  get passed(): boolean {
    return this.results.every((item) => item.passed);
  }

  reset(): void {
    this.results = [];
  }
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  return String(value);
}
