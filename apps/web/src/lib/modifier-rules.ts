// Selection rules of a modifier group, shared by the POS dialog and the public order sheet (S10, S20).

export interface ModifierRule {
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
}

/** Options chosen per modifier group id. */
export type ModifierSelection = Record<string, string[]>;

export function minimumOf(group: ModifierRule): number {
  return group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;
}

export function isSatisfied(group: ModifierRule, count: number): boolean {
  if (count > group.maxSelection) return false;
  if (count === 0 && !group.isRequired) return true;
  return count >= minimumOf(group);
}

export function ruleText(group: ModifierRule): string {
  const parts = [group.isRequired ? 'Obligatorio' : 'Opcional'];
  const min = minimumOf(group);
  if (min > 1) parts.push(`mínimo ${min}`);
  parts.push(group.maxSelection === 1 ? 'elegí 1' : `hasta ${group.maxSelection}`);
  return parts.join(' · ');
}

/** Options of the group after tapping one: single-choice groups swap it, full groups ignore a new one. */
export function toggleOption(group: ModifierRule, chosen: string[], optionId: string): string[] {
  if (chosen.includes(optionId)) return chosen.filter((id) => id !== optionId);
  if (group.maxSelection === 1) return [optionId];
  if (chosen.length >= group.maxSelection) return chosen;
  return [...chosen, optionId];
}

/** True when the group allows several options and no more fit. */
export function isFull(group: ModifierRule, chosen: string[]): boolean {
  return group.maxSelection > 1 && chosen.length >= group.maxSelection;
}
