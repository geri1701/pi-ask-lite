import type { AskBlock, AskDocument, AskOption, AskSection, AskState, OptionGroup } from "./types.js";

export function createAskState(): AskState {
  return {
    selected: new Set<string>(),
    draftMode: false,
  };
}

export function selectOption(document: AskDocument, state: AskState, optionId: string, asDraft = false): void {
  const location = findOption(document, optionId);
  if (!location || !isOptionActive(document, state, optionId)) return;

  if (asDraft) state.draftMode = true;

  if (location.group.mode === "single") {
    for (const option of location.group.options) {
      if (option.id !== optionId) clearOptionAndChildren(state, option);
    }
    state.selected.add(optionId);
    return;
  }

  if (state.selected.has(optionId)) {
    clearOptionAndChildren(state, location.option);
  } else {
    state.selected.add(optionId);
  }
}

export function isSelectionValid(document: AskDocument, state: AskState): boolean {
  return document.sections.every((section) => section.blocks.every((block) => {
    if (block.type !== "group") return true;
    return isGroupValid(block, state);
  }));
}

export function buildAnswerMarkdown(document: AskDocument, state: AskState): string {
  const sections = document.sections
    .map((section) => renderSection(section, state))
    .filter((lines) => lines.length > 0);

  return sections.map((lines) => lines.join("\n")).join("\n\n");
}

export function isOptionActive(document: AskDocument, state: AskState, optionId: string): boolean {
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.type === "group" && optionActiveInGroup(block, state, optionId, true)) return true;
    }
  }

  return false;
}

function isGroupValid(group: OptionGroup, state: AskState): boolean {
  const selectedOptions = group.options.filter((option) => state.selected.has(option.id));

  if (group.mode === "single" && selectedOptions.length !== 1) return false;
  if (group.mode === "multi" && selectedOptions.length < 1) return false;

  return selectedOptions.every((option) => option.children.every((childGroup) => isGroupValid(childGroup, state)));
}

function renderSection(section: AskSection, state: AskState): string[] {
  const body = section.blocks.flatMap((block) => renderBlock(block, state, 0));
  if (body.length === 0) return [];

  if (!section.heading) return body;

  return [`${"#".repeat(section.heading.level)} ${section.heading.text}`, ...body];
}

function renderBlock(block: AskBlock, state: AskState, depth: number): string[] {
  if (block.type === "text") return [];
  return renderGroup(block, state, depth);
}

function renderGroup(group: OptionGroup, state: AskState, depth: number): string[] {
  return group.options.flatMap((option) => {
    if (!state.selected.has(option.id)) return [];

    const prefix = group.mode === "multi" ? "- [x]" : "-";
    const indent = "    ".repeat(depth);
    const lines = [`${indent}${prefix} ${option.label}`];

    for (const childGroup of option.children) {
      lines.push(...renderGroup(childGroup, state, depth + 1));
    }

    return lines;
  });
}

function optionActiveInGroup(group: OptionGroup, state: AskState, optionId: string, active: boolean): boolean {
  for (const option of group.options) {
    if (option.id === optionId) return active;

    const childActive = active && state.selected.has(option.id);
    for (const childGroup of option.children) {
      if (optionActiveInGroup(childGroup, state, optionId, childActive)) return true;
    }
  }

  return false;
}

function findOption(document: AskDocument, optionId: string): { group: OptionGroup; option: AskOption } | undefined {
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.type !== "group") continue;
      const result = findOptionInGroup(block, optionId);
      if (result) return result;
    }
  }

  return undefined;
}

function findOptionInGroup(group: OptionGroup, optionId: string): { group: OptionGroup; option: AskOption } | undefined {
  for (const option of group.options) {
    if (option.id === optionId) return { group, option };

    for (const childGroup of option.children) {
      const result = findOptionInGroup(childGroup, optionId);
      if (result) return result;
    }
  }

  return undefined;
}

function clearOptionAndChildren(state: AskState, option: AskOption): void {
  state.selected.delete(option.id);

  for (const childGroup of option.children) {
    for (const child of childGroup.options) {
      clearOptionAndChildren(state, child);
    }
  }
}
