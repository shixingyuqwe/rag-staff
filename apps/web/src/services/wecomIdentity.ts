export interface WecomOperator {
  userId: string;
  name: string;
}

export async function getCurrentWecomOperator(): Promise<WecomOperator> {
  return {
    userId: 'system',
    name: '系统',
  };
}
