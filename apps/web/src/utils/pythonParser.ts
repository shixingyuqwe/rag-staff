export function parsePythonStyleObject(text: string): unknown | null {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (const char of text) {
    if (escapeNext) {
      if (inSingleQuote && char === "'") {
        result += "'";
      } else if ((inSingleQuote || inDoubleQuote) && char === '"') {
        result += '\\"';
      } else {
        result += `\\${char}`;
      }
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        inSingleQuote = false;
        result += '"';
      } else if (char === '"') {
        result += '\\"';
      } else {
        result += char;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      result += char;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      result += '"';
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
    }

    result += char;
  }

  if (escapeNext) {
    result += '\\';
  }

  let normalized = '';
  inDoubleQuote = false;
  escapeNext = false;

  for (let index = 0; index < result.length; index += 1) {
    const char = result[index];

    if (escapeNext) {
      normalized += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      normalized += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      normalized += char;
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inDoubleQuote && result.startsWith('True', index)) {
      normalized += 'true';
      index += 3;
      continue;
    }

    if (!inDoubleQuote && result.startsWith('False', index)) {
      normalized += 'false';
      index += 4;
      continue;
    }

    if (!inDoubleQuote && result.startsWith('None', index)) {
      normalized += 'null';
      index += 3;
      continue;
    }

    normalized += char;
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

export function parseStructuredString(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return parsePythonStyleObject(trimmed);
  }
}
