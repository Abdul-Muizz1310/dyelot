import "./base.css";

// The preview kit (spec section 7.5): the shared parts every template builds on (Tasks 2.7 to 2.10),
// the mobile template's phone screen, tab bar and bottom sheet among them (section 7.7).

export { BUTTON_ROLES, Button, IconButton } from "./Button";
export { BarsLegend, BarsTable, StackedBars } from "./chart";
export {
  Checkbox,
  CheckboxGroup,
  type ChoiceSurface,
  Radio,
  RadioGroup,
  Segmented,
  Switch,
} from "./choices";
export { Avatar, Badge, Chip, Progress, Readings, Skeleton, type Tone } from "./data";
export { ConfirmDialog } from "./dialog";
export { Accordion, type AccordionItem } from "./disclosure";
export { ColorField, type FieldType, Input, Select, Slider, Textarea } from "./fields";
export { Level, Skeins, TideCurve } from "./figures";
export { Entrance, MotionScope } from "./motion";
export { MenuSpecimen, TabBar, type TabBarItem, TabSpecimen, TabsDemo } from "./navigation";
export { SectionHead } from "./page";
export { PhoneScreen } from "./phone";
export { type NoteIds, NoteRef, RichText, TextLink } from "./prose";
export { BottomSheet } from "./sheet";
export {
  BUTTON_VARIANTS,
  type ButtonVariant,
  KIT_COMPONENTS,
  KIT_STATES,
  type KitComponentId,
  type KitState,
  statesOf,
} from "./states";
export { Alert, Card, DialogStage, SheetStage, Toast, Tooltip } from "./surfaces";
