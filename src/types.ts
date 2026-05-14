export type GroupMode = "single" | "multi";

export interface AskDocument {
  sections: AskSection[];
}

export interface AskSection {
  heading?: AskHeading;
  blocks: AskBlock[];
}

export interface AskHeading {
  level: number;
  text: string;
}

export type AskBlock = TextBlock | OptionGroup;

export interface TextBlock {
  type: "text";
  lines: string[];
}

export interface OptionGroup {
  type: "group";
  mode: GroupMode;
  options: AskOption[];
  required: true;
  indent: number;
}

export interface AskOption {
  id: string;
  label: string;
  rawLabel: string;
  indent: number;
  line: number;
  children: OptionGroup[];
}

export interface AskState {
  selected: Set<string>;
  draftMode: boolean;
}
