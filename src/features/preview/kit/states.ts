import { assertOneOf } from "@/features/studio/guards";

// The kit's components and the states each supports (spec section 7.5, F-TPL-03). The kitchen sink
// renders every pair; a forced state is `data-state` on the component (R2-20). Pure data.

/** The states of section 7.5, in its order. */
export const KIT_STATES = Object.freeze([
  "default",
  "hover",
  "focus-visible",
  "pressed",
  "selected",
  "indeterminate",
  "disabled",
  "read-only",
  "loading",
  "invalid",
  "success",
  "placeholder",
  "empty",
] as const);

export type KitState = (typeof KIT_STATES)[number];

/** The button variants of section 7.5 and R2-20. */
export const BUTTON_VARIANTS = Object.freeze([
  "primary",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const);

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

const component = <const Id extends string>(id: Id, label: string, states: readonly KitState[]) =>
  Object.freeze({ id, label, states: Object.freeze([...states]) });

const FIELD: readonly KitState[] = [
  "default",
  "hover",
  "focus-visible",
  "placeholder",
  "disabled",
  "read-only",
  "invalid",
  "success",
];
const TOGGLE: readonly KitState[] = ["default", "hover", "focus-visible", "selected", "disabled"];

/** The 21 components of section 7.5, in its order, with the states each supports. */
export const KIT_COMPONENTS = Object.freeze([
  component("button", "Button", [
    "default",
    "hover",
    "focus-visible",
    "pressed",
    "disabled",
    "loading",
  ]),
  component("input", "Input", FIELD),
  component("textarea", "Textarea", FIELD),
  component("select", "Select", [
    "default",
    "hover",
    "focus-visible",
    "placeholder",
    "disabled",
    "invalid",
  ]),
  component("checkbox", "Checkbox", [
    "default",
    "hover",
    "focus-visible",
    "selected",
    "indeterminate",
    "disabled",
    "invalid",
  ]),
  component("radio", "Radio", TOGGLE),
  component("switch", "Switch", TOGGLE),
  component("tab", "Tab", TOGGLE),
  component("menu-item", "Menu item", TOGGLE),
  component("table-row", "Table row", ["default", "hover", "selected", "empty"]),
  component("card", "Interactive card", [
    "default",
    "hover",
    "focus-visible",
    "pressed",
    "selected",
    "disabled",
  ]),
  component("badge", "Badge", ["default"]),
  component("alert", "Alert", ["default", "success", "invalid"]),
  component("tooltip", "Tooltip", ["default"]),
  component("dialog", "Dialog", ["default"]),
  component("sheet", "Sheet", ["default"]),
  component("toast", "Toast", ["default", "success", "invalid", "loading"]),
  component("avatar", "Avatar", ["default", "empty", "loading"]),
  component("chip", "Chip", TOGGLE),
  component("skeleton", "Skeleton", ["loading"]),
  component("progress", "Progress", ["default", "indeterminate", "success", "empty"]),
]);

export type KitComponentId = (typeof KIT_COMPONENTS)[number]["id"];

const IDS: readonly KitComponentId[] = KIT_COMPONENTS.map((entry) => entry.id);

/** The states `id` supports; an unknown id is a RangeError, a non-string a TypeError. */
export function statesOf(id: KitComponentId): readonly KitState[] {
  assertOneOf(id, IDS, "statesOf: id");
  return KIT_COMPONENTS[IDS.indexOf(id)].states;
}
