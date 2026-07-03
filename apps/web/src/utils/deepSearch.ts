import { parsePythonStyleObject } from './pythonParser';

export interface DeepSearchOptions {
  maxDepth?: number;
  parseStrings?: boolean;
  pythonStyle?: boolean;
}

export function findDeep<T>(
  value: unknown,
  predicate: (v: unknown) => v is T,
  options: DeepSearchOptions = {},
): T | null {
  const { maxDepth = 8, parseStrings = true, pythonStyle = false } = options;

  const parseString = (text: string): unknown | null => {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    if (pythonStyle) {
      return parsePythonStyleObject(trimmed);
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  };

  const search = (current: unknown, depth: number): T | null => {
    if (current == null || depth > maxDepth) return null;

    if (typeof current === 'string' && parseStrings) {
      const parsed = parseString(current);
      if (parsed != null) {
        const found = search(parsed, depth + 1);
        if (found) return found;
      }
    }

    if (typeof current !== 'object') return null;

    if (predicate(current)) return current;

    if (Array.isArray(current)) {
      for (const item of current) {
        const found = search(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    for (const child of Object.values(current as Record<string, unknown>)) {
      const found = search(child, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return search(value, 0);
}

export function findDeepAll<T>(
  value: unknown,
  predicate: (v: unknown) => v is T,
  options: DeepSearchOptions = {},
): T[] {
  const { maxDepth = 8, parseStrings = true, pythonStyle = false } = options;

  const parseString = (text: string): unknown | null => {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    if (pythonStyle) {
      return parsePythonStyleObject(trimmed);
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  };

  const search = (current: unknown, depth: number): T[] | null => {
    if (current == null || depth > maxDepth) return null;

    if (typeof current === 'string' && parseStrings) {
      const parsed = parseString(current);
      if (parsed != null) {
        const found = search(parsed, depth + 1);
        if (found) return found;
      }
    }

    if (typeof current !== 'object') return null;

    if (predicate(current)) return [current as unknown as T];

    if (Array.isArray(current)) {
      const matchingItems = current.filter(predicate);
      if (matchingItems.length > 0) return matchingItems;

      for (const item of current) {
        const found = search(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    for (const child of Object.values(current as Record<string, unknown>)) {
      const found = search(child, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return search(value, 0) || [];
}
