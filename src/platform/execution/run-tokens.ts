export function formatRunTimestamp(now: Date): string {
  const pad = (input: number): string => String(input).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function substituteRunTokens(value: string, runId: string, runTimestamp: string): string {
  return value.split('${RUN_ID}').join(runId).split('${RUN_TIMESTAMP}').join(runTimestamp);
}
