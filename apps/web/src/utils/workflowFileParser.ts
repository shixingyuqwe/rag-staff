import type { WorkflowResult } from '@/types/mfAgent';

export interface DownloadableFile {
  fileName: string;
  fileSn: string;
  name?: string;
}

export function getTextValue(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

export function textValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value).trim();
}

export function parseJsonLoose(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function parseJsonDeep(value: unknown): unknown {
  let current = value;

  for (let index = 0; index < 4; index += 1) {
    const parsed = parseJsonLoose(current);
    if (parsed === current) break;
    current = parsed;
  }

  if (Array.isArray(current) && current.length === 1) {
    return current[0];
  }

  return current;
}

/** 尝试将值解析为 JSON，处理平台可能返回的 JSON 字符串 */
export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export function unwrapWorkflowValue(value: unknown): unknown {
  const parsed = parseJsonLoose(value);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if ('currentValue' in record) {
      return unwrapWorkflowValue(record.currentValue);
    }
  }

  return parsed;
}

export function parseWorkflowFile(value: unknown, name?: string): DownloadableFile | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const text = value.trim();
    let fileName = '';
    let fileSn = '';

    if (text.startsWith('RunFileDTO(')) {
      const inner = text.replace(/^RunFileDTO\(/, '').replace(/\)$/, '');
      const nameMatch = inner.match(/(?:fieldName|fileName)=([^,)}]+)/);
      const snMatch = inner.match(/(?:fieldSn|fileSn)=([^,)}]+)/);

      fileName = getTextValue(nameMatch?.[1]);
      fileSn = getTextValue(snMatch?.[1]);
    }

    if (!fileName && !fileSn) return null;
    return { fileName, fileSn, name };
  }

  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;

  if ('currentValue' in record) {
    return parseWorkflowFile(record.currentValue, getTextValue(record.name) || name);
  }

  const fileName = getTextValue(record.fileName || record.fieldName || record.name);
  const fileSn = getTextValue(record.fileSn || record.fieldSn || record.sn);

  if (!fileName && !fileSn) return null;
  return { fileName, fileSn, name };
}

export function extractDownloadableFiles(
  output?: Record<string, unknown>,
  files?: WorkflowResult['files'],
): DownloadableFile[] {
  const fileMap = new Map<string, DownloadableFile>();

  const addFile = (file: DownloadableFile | null) => {
    if (!file?.fileSn) return;
    fileMap.set(file.fileSn, file);
  };

  for (const file of files || []) {
    addFile({
      fileName: file.fileName,
      fileSn: file.fileSn,
      name: file.fileName,
    });
  }

  for (const raw of Object.values(output || {})) {
    addFile(parseWorkflowFile(raw));

    if (raw && typeof raw === 'object') {
      const record = raw as Record<string, unknown>;
      addFile(parseWorkflowFile(record.currentValue, getTextValue(record.name)));
    }
  }

  return Array.from(fileMap.values());
}

export function extractFileInfo(
  value: unknown,
  fileType: 'excel' | 'pdf' | 'other',
  label: string,
): { fileSn: string; fileName: string; fileType: 'excel' | 'pdf' | 'other'; label: string } | null {
  const parsed = parseJsonDeep(value);
  let fileSn = '';
  let fileName = '';

  const extractFromText = (source: unknown) => {
    const text = textValue(source);
    if (!text) return;

    const snMatch = text.match(/(?:fieldSn|fileSn)=([^,\s)}]+)/);
    const nameMatch = text.match(/(?:fieldName|fileName)=([^,)}]+)/);

    if (snMatch?.[1]) fileSn = snMatch[1].trim();
    if (nameMatch?.[1]) fileName = nameMatch[1].trim();
  };

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const currentValue =
      record.currentValue && typeof record.currentValue === 'object'
        ? (record.currentValue as Record<string, unknown>)
        : record;

    for (const candidate of [
      currentValue.fileName,
      currentValue.fieldName,
      currentValue.name,
      currentValue.fileSn,
      currentValue.fieldSn,
      currentValue.sn,
      value,
    ]) {
      extractFromText(candidate);
    }

    if (!fileSn) {
      fileSn = textValue(currentValue.fileSn || currentValue.fieldSn || currentValue.sn);
    }
    if (!fileName) {
      fileName = textValue(currentValue.fileName || currentValue.fieldName || currentValue.name);
    }
  } else {
    extractFromText(parsed || value);
  }

  if (!fileSn && !fileName) return null;

  return {
    fileSn,
    fileName: fileName || label,
    fileType,
    label,
  };
}

/** 按工作流文档输出变量名查找文件 */
export function getWorkflowFileByName(
  output: Record<string, unknown> | undefined,
  variableName: string,
): DownloadableFile | null {
  if (!output) return null;

  const directValue = output[variableName];
  if (directValue != null) {
    const file = parseWorkflowFile(directValue, variableName);
    if (file) return file;
  }

  for (const raw of Object.values(output)) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const record = raw as Record<string, unknown>;
      const name = getTextValue(record.name);
      if (name === variableName || name.includes(variableName)) {
        const file = parseWorkflowFile(record.currentValue ?? record, variableName);
        if (file) return file;
      }
    }
  }

  return null;
}
