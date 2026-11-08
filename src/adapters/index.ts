import { Page } from '@playwright/test';
import { AthenaProfile } from '../locator/athena-profile';
import { LocatorResolver } from '../locator/strategy';
import { SafetyPolicy } from '../runner/safety-policy';
import { AdapterContext } from './base/adapter-context';
import { ButtonAdapter } from './button-adapter';
import { DateAdapter } from './date-adapter';
import { DropdownAdapter } from './dropdown-adapter';
import { GridAdapter, GridOptions } from './grid-adapter';
import { InputAdapter } from './input-adapter';
import { LookupAdapter } from './lookup-adapter';
import { ModalAdapter } from './modal-adapter';
import { TabAdapter } from './tab-adapter';
import { TreeAdapter } from './tree-adapter';

export interface AdapterSet {
  context: AdapterContext;
  profile: AthenaProfile;
  input: InputAdapter;
  button: ButtonAdapter;
  dropdown: DropdownAdapter;
  date: DateAdapter;
  lookup: LookupAdapter;
  grid: (options: GridOptions) => GridAdapter;
  tab: TabAdapter;
  modal: ModalAdapter;
  tree: TreeAdapter;
}

export function createAdapters(
  page: Page,
  policy: SafetyPolicy,
  timeoutMs = 15_000,
): AdapterSet {
  const context: AdapterContext = {
    page,
    resolver: new LocatorResolver(page, timeoutMs),
    policy,
    timeoutMs,
  };
  return {
    context,
    profile: new AthenaProfile(page),
    input: new InputAdapter(context),
    button: new ButtonAdapter(context),
    dropdown: new DropdownAdapter(context),
    date: new DateAdapter(context),
    lookup: new LookupAdapter(context),
    grid: (options: GridOptions) => new GridAdapter(context, options),
    tab: new TabAdapter(context),
    modal: new ModalAdapter(context),
    tree: new TreeAdapter(context),
  };
}

export { ButtonAdapter, DateAdapter, DropdownAdapter, GridAdapter, InputAdapter, LookupAdapter, ModalAdapter, TabAdapter, TreeAdapter };
