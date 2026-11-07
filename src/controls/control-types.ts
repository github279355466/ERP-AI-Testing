export type ErpControlKind =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'DROPDOWN'
  | 'LOOKUP'
  | 'TREE_SELECT'
  | 'GRID'
  | 'READONLY'
  | 'CHECKBOX'
  | 'SWITCH'
  | 'TAB'
  | 'MODAL'
  | 'WORKFLOW_BUTTON'
  | 'UNKNOWN';

export type Confidence = 'high' | 'medium' | 'low';

export interface ControlDescriptor {
  tag: string;
  className?: string;
  inputType?: string;
  readOnly?: boolean;
  disabled?: boolean;
  role?: string;
  ariaHasPopup?: string;
}

export interface ControlClassification {
  kind: ErpControlKind;
  confidence: Confidence;
  reason: string;
}
