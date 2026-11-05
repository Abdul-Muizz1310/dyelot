import "./base.css";

// The preview kit (spec section 7.5): the shared parts every template builds on (Tasks 2.7 to 2.10),
// the mobile template's phone screen, tab bar and bottom sheet among them (section 7.7).

export { Button, IconButton } from "./Button";
export { BarsLegend, BarsTable, StackedBars } from "./chart";
export {
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Segmented,
  Switch,
} from "./choices";
export { Avatar, Badge, Chip, Progress, Readings, Skeleton, type Tone } from "./data";
export { ConfirmDialog } from "./dialog";
export { Accordion } from "./disclosure";
export { ColorField, Input, Select, Slider, Textarea } from "./fields";
export { Level, Skeins, TideCurve } from "./figures";
export { Entrance, MotionScope } from "./motion";
export { MenuSpecimen, TabBar, TabSpecimen, TabsDemo } from "./navigation";
export { SectionHead } from "./page";
export { PhoneScreen } from "./phone";
export { type NoteIds, RichText, TextLink } from "./prose";
export { BottomSheet } from "./sheet";
export {
  BUTTON_VARIANTS,
  type ButtonVariant,
  KIT_COMPONENTS,
  type KitComponentId,
  type KitState,
} from "./states";
export { Alert, Card, DialogStage, SheetStage, Toast, Tooltip } from "./surfaces";
