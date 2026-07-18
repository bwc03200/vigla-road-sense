import type { HazardType, ConvoyReactionKind } from "@/types/vigla";
import i18n from "@/i18n/i18n";

export function hazardLabel(type: HazardType): string {
  return i18n.t(`hazard.types.${type}`);
}

export function reactionLabel(kind: ConvoyReactionKind): string {
  return i18n.t(`convoy.reactions.${kind}`);
}

export function reactionText(kind: ConvoyReactionKind): string {
  const key = `convoy.reactions.${kind}Msg`;
  const v = i18n.t(key);
  return v === key ? "" : v;
}
