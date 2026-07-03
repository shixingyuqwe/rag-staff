import { v4 as uuidv4 } from 'uuid';

export function generateSessionSn(): string {
  return `session-${uuidv4().replace(/-/g, '')}`;
}
