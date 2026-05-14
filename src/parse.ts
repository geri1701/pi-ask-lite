import type { AskDocument, AskOption, AskSection, GroupMode, OptionGroup, TextBlock } from "./types.js";

interface GroupContext {
  indent: number;
  group: OptionGroup;
  lastOption?: AskOption;
}

interface ParsedOptionLine {
  indent: number;
  mode: GroupMode;
  label: string;
  rawLabel: string;
}

const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const optionPattern = /^([ \t]*)-\s+(?:\[([ xX])\](?:\s+(.*)|\s*)|(.*))$/;
const fencePattern = /^\s*(```|~~~)/;

export function parseAskMarkdown(markdown: string): AskDocument {
  const sections: AskSection[] = [{ blocks: [] }];
  let groupStack: GroupContext[] = [];
  let optionCounter = 0;
  let inFence = false;

  const currentSection = () => sections[sections.length - 1];

  const resetOptionContext = () => {
    groupStack = [];
  };

  const appendTextLine = (line: string) => {
    const section = currentSection();
    const lastBlock = section.blocks[section.blocks.length - 1];
    if (lastBlock?.type === "text") {
      lastBlock.lines.push(line);
      return;
    }

    const block: TextBlock = { type: "text", lines: [line] };
    section.blocks.push(block);
  };

  const startSection = (level: number, text: string) => {
    const section = currentSection();
    resetOptionContext();

    if (!section.heading && section.blocks.length === 0) {
      section.heading = { level, text };
      return;
    }

    sections.push({ heading: { level, text }, blocks: [] });
  };

  const addOption = (parsed: ParsedOptionLine, lineNumber: number) => {
    const option: AskOption = {
      id: `opt-${++optionCounter}`,
      label: parsed.label.trim(),
      rawLabel: parsed.rawLabel,
      indent: parsed.indent,
      line: lineNumber,
      children: [],
    };

    if (!option.label) {
      throw invalidAskMarkdown(
        "Interactive options must not be empty.",
        "Write a visible label after `-` or `- [ ]`.",
        lineNumber,
      );
    }

    while (groupStack.length > 0 && parsed.indent < groupStack[groupStack.length - 1].indent) {
      groupStack.pop();
    }

    const existingGroup = groupStack[groupStack.length - 1]?.indent === parsed.indent
      ? groupStack[groupStack.length - 1]
      : undefined;

    if (existingGroup) {
      ensureSameMode(existingGroup.group, parsed.mode, lineNumber);
      existingGroup.group.options.push(option);
      existingGroup.lastOption = option;
      return;
    }

    const parentGroup = groupStack[groupStack.length - 1];
    const group: OptionGroup = {
      type: "group",
      mode: parsed.mode,
      options: [option],
      required: true,
      indent: parsed.indent,
    };

    if (parentGroup && parsed.indent > parentGroup.indent && parentGroup.lastOption) {
      parentGroup.lastOption.children.push(group);
    } else {
      currentSection().blocks.push(group);
      groupStack = [];
    }

    groupStack.push({ indent: parsed.indent, group, lastOption: option });
  };

  markdown.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;

    if (fencePattern.test(line)) {
      inFence = !inFence;
      resetOptionContext();
      appendTextLine(line);
      return;
    }

    if (inFence) {
      appendTextLine(line);
      return;
    }

    const headingMatch = line.match(headingPattern);
    if (headingMatch) {
      startSection(headingMatch[1].length, headingMatch[2].trim());
      return;
    }

    const parsedOption = parseOptionLine(line, lineNumber);
    if (parsedOption) {
      addOption(parsedOption, lineNumber);
      return;
    }

    resetOptionContext();
    appendTextLine(line);
  });

  return { sections };
}

function parseOptionLine(line: string, lineNumber: number): ParsedOptionLine | undefined {
  const match = line.match(optionPattern);
  if (!match) return undefined;

  const checkbox = match[2];
  if (checkbox && checkbox.toLowerCase() === "x") {
    throw invalidAskMarkdown(
      "Preselected options are not allowed.",
      "Use `- [ ] option` for multi choice and describe recommendations in normal Markdown text.",
      lineNumber,
    );
  }

  const rawLabel = checkbox ? (match[3] ?? "") : match[4];

  return {
    indent: indentationWidth(match[1]),
    mode: checkbox === " " ? "multi" : "single",
    label: rawLabel.trim(),
    rawLabel,
  };
}

function ensureSameMode(group: OptionGroup, mode: GroupMode, lineNumber: number) {
  if (group.mode === mode) return;

  throw invalidAskMarkdown(
    "Mixed selection styles in the same option group.",
    "Use either `- option` for single choice or `- [ ] option` for multi choice within one sibling group.",
    lineNumber,
  );
}

function indentationWidth(indent: string): number {
  let width = 0;
  for (const character of indent) {
    width += character === "\t" ? 4 : 1;
  }
  return width;
}

function invalidAskMarkdown(reason: string, fix: string, lineNumber?: number): Error {
  const location = typeof lineNumber === "number" ? `\nLine: ${lineNumber}` : "";
  return new Error(`Invalid ask markdown.\n\nReason: ${reason}${location}\nFix: ${fix}`);
}
