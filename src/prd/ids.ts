import crypto from 'node:crypto';

export function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function shortHash(input: string): string {
  return sha256(input).slice(0, 12).toUpperCase();
}

export function stableId(prefix: string, key: string): string {
  return `${prefix}-${shortHash(key)}`;
}

export function documentId(relativePath: string): string {
  return stableId('DOC', relativePath.replace(/\\/g, '/').toLowerCase());
}

export function entityId(entityNo: string): string {
  return stableId('ENT', entityNo.toLowerCase());
}

export function fieldId(documentIdValue: string, entityNo: string | null, fieldNo: string | null, label: string): string {
  return stableId('FLD', `${documentIdValue}|${entityNo ?? ''}|${fieldNo ?? label}`);
}

export function ruleId(documentIdValue: string, key: string): string {
  return stableId('RULE', `${documentIdValue}|${key}`);
}

export function pageId(documentIdValue: string, key: string): string {
  return stableId('PAGE', `${documentIdValue}|${key}`);
}

export function actionId(documentIdValue: string, key: string): string {
  return stableId('ACT', `${documentIdValue}|${key}`);
}

export function workflowId(documentIdValue: string): string {
  return stableId('WF', documentIdValue);
}

export function dependencyId(documentIdValue: string, key: string): string {
  return stableId('DEP', `${documentIdValue}|${key}`);
}

export function scenarioId(key: string): string {
  return stableId('SCN', key);
}

export function questionId(key: string): string {
  return stableId('OQ', key);
}
