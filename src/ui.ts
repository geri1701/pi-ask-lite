import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

import { buildAnswerMarkdown, createAskState, isOptionActive, isSelectionValid, selectOption } from "./state.js";
import type { AskBlock, AskDocument, AskOption, AskSection, OptionGroup, TextBlock } from "./types.js";

interface OptionRow {
  option: AskOption;
  group: OptionGroup;
  depth: number;
  active: boolean;
}

interface RenderRow {
  text: string;
  optionId?: string;
}

const maxBodyLines = 24;

export async function runAskUi(ctx: ExtensionContext, document: AskDocument): Promise<string> {
  return ctx.ui.custom<string>((tui, theme, _keybindings, done) => {
    const state = createAskState();
    let focusedId = firstActiveOptionId(document, state);
    let editMode = focusedId === undefined;
    let scrollOffset = 0;
    let cachedWidth: number | undefined;
    let cachedLines: string[] | undefined;

    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (s) => theme.fg("accent", s),
        selectedText: (s) => theme.fg("accent", s),
        description: (s) => theme.fg("muted", s),
        scrollInfo: (s) => theme.fg("dim", s),
        noMatch: (s) => theme.fg("warning", s),
      },
    };
    const editor = new Editor(tui, editorTheme);

    editor.onSubmit = (value) => {
      done(value);
    };

    function refresh() {
      cachedWidth = undefined;
      cachedLines = undefined;
      tui.requestRender();
    }

    function ensureFocus() {
      const rows = collectOptionRows(document, state).filter((row) => row.active);
      if (rows.length === 0) {
        focusedId = undefined;
        return;
      }
      if (!focusedId || !rows.some((row) => row.option.id === focusedId)) {
        focusedId = rows[0].option.id;
      }
    }

    function moveFocus(delta: number) {
      const rows = collectOptionRows(document, state).filter((row) => row.active);
      if (rows.length === 0) return;

      const current = Math.max(0, rows.findIndex((row) => row.option.id === focusedId));
      const next = Math.max(0, Math.min(rows.length - 1, current + delta));
      focusedId = rows[next].option.id;
      refresh();
    }

    function enterEditMode(prefill: string) {
      editMode = true;
      editor.setText(prefill);
      refresh();
    }

    function handleInput(data: string) {
      if (editMode) {
        if (focusedId && matchesKey(data, Key.escape)) {
          editMode = false;
          refresh();
          return;
        }
        editor.handleInput(data);
        refresh();
        return;
      }

      ensureFocus();

      if (matchesKey(data, Key.up)) {
        moveFocus(-1);
        return;
      }
      if (matchesKey(data, Key.down)) {
        moveFocus(1);
        return;
      }
      if (matchesKey(data, Key.pageUp)) {
        moveFocus(-8);
        return;
      }
      if (matchesKey(data, Key.pageDown)) {
        moveFocus(8);
        return;
      }

      if (matchesKey(data, "shift+space")) {
        if (focusedId) selectOption(document, state, focusedId, true);
        ensureFocus();
        refresh();
        return;
      }

      if (matchesKey(data, Key.space) || data === " ") {
        if (focusedId) selectOption(document, state, focusedId);
        ensureFocus();
        refresh();
        return;
      }

      if (matchesKey(data, Key.enter)) {
        if (!isSelectionValid(document, state)) return;

        const answer = buildAnswerMarkdown(document, state);
        if (state.draftMode) {
          enterEditMode(answer);
        } else {
          done(answer);
        }
        return;
      }

      if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
        enterEditMode("");
      }
    }

    function render(width: number): string[] {
      if (cachedLines && cachedWidth === width) return cachedLines;

      ensureFocus();
      const lines: string[] = [];
      const add = (line: string) => lines.push(truncateToWidth(line, width));

      add(theme.fg("accent", "─".repeat(width)));
      add(theme.fg("accent", " Ask User"));
      add(theme.fg("dim", editMode ? " Freitext/Draft: Enter sendet • Esc zurück zur Auswahl" : " ↑↓ bewegen • Space wählen • Shift+Space Draft • Enter senden • Esc Freitext"));
      lines.push("");

      const bodyRows = renderDocumentRows(document, state, focusedId, {
        heading: (s) => theme.fg("accent", s),
        text: (s) => theme.fg("text", s),
        muted: (s) => theme.fg("muted", s),
        dim: (s) => theme.fg("dim", s),
        focus: (s) => theme.fg("accent", s),
      });

      if (editMode) {
        bodyRows.push({ text: "" }, { text: theme.fg("muted", "Antwort:") });
        for (const editorLine of editor.render(Math.max(10, width - 2))) {
          bodyRows.push({ text: ` ${editorLine}` });
        }
      }

      if (editMode) {
        scrollOffset = Math.max(0, bodyRows.length - maxBodyLines);
      } else {
        const focusedLine = bodyRows.findIndex((row) => row.optionId === focusedId);
        if (focusedLine >= 0) {
          if (focusedLine < scrollOffset) scrollOffset = focusedLine;
          if (focusedLine >= scrollOffset + maxBodyLines) scrollOffset = focusedLine - maxBodyLines + 1;
        }
        scrollOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, bodyRows.length - maxBodyLines)));
      }

      const visibleRows = bodyRows.slice(scrollOffset, scrollOffset + maxBodyLines);
      if (scrollOffset > 0) add(theme.fg("dim", `… ${scrollOffset} Zeilen darüber`));
      for (const row of visibleRows) add(row.text);
      if (scrollOffset + maxBodyLines < bodyRows.length) {
        add(theme.fg("dim", `… ${bodyRows.length - scrollOffset - maxBodyLines} Zeilen darunter`));
      }

      lines.push("");
      add(theme.fg("accent", "─".repeat(width)));

      cachedWidth = width;
      cachedLines = lines;
      return lines;
    }

    return {
      get focused() {
        return editor.focused;
      },
      set focused(value: boolean) {
        editor.focused = value;
      },
      render,
      invalidate: () => {
        cachedWidth = undefined;
        cachedLines = undefined;
        editor.invalidate();
      },
      handleInput,
    };
  }, {
    overlay: true,
    overlayOptions: {
      width: "100%",
      minWidth: 50,
      maxHeight: "65%",
      anchor: "bottom-center",
      offsetY: -2,
      margin: 1,
    },
  });
}

function collectOptionRows(document: AskDocument, state: ReturnType<typeof createAskState>): OptionRow[] {
  return document.sections.flatMap((section) => section.blocks.flatMap((block) => collectBlockRows(document, state, block, 0)));
}

function collectBlockRows(document: AskDocument, state: ReturnType<typeof createAskState>, block: AskBlock, depth: number): OptionRow[] {
  if (block.type !== "group") return [];
  return collectGroupRows(document, state, block, depth);
}

function collectGroupRows(document: AskDocument, state: ReturnType<typeof createAskState>, group: OptionGroup, depth: number): OptionRow[] {
  return group.options.flatMap((option) => {
    const active = isOptionActive(document, state, option.id);
    return [
      { option, group, depth, active },
      ...option.children.flatMap((childGroup) => collectGroupRows(document, state, childGroup, depth + 1)),
    ];
  });
}

function firstActiveOptionId(document: AskDocument, state: ReturnType<typeof createAskState>): string | undefined {
  return collectOptionRows(document, state).find((row) => row.active)?.option.id;
}

function renderDocumentRows(
  document: AskDocument,
  state: ReturnType<typeof createAskState>,
  focusedId: string | undefined,
  style: {
    heading: (s: string) => string;
    text: (s: string) => string;
    muted: (s: string) => string;
    dim: (s: string) => string;
    focus: (s: string) => string;
  },
): RenderRow[] {
  return document.sections.flatMap((section) => renderSectionRows(document, state, section, focusedId, style));
}

function renderSectionRows(
  document: AskDocument,
  state: ReturnType<typeof createAskState>,
  section: AskSection,
  focusedId: string | undefined,
  style: Parameters<typeof renderDocumentRows>[3],
): RenderRow[] {
  const rows: RenderRow[] = [];
  if (section.heading) rows.push({ text: style.heading(`${"#".repeat(section.heading.level)} ${section.heading.text}`) });

  for (const block of section.blocks) {
    if (block.type === "text") {
      rows.push(...renderTextRows(block, style));
    } else {
      rows.push(...renderGroupRows(document, state, block, focusedId, 0, style));
    }
  }

  return rows;
}

function renderTextRows(block: TextBlock, style: Parameters<typeof renderDocumentRows>[3]): RenderRow[] {
  return block.lines.map((line) => ({ text: line.trim() ? style.text(line) : "" }));
}

function renderGroupRows(
  document: AskDocument,
  state: ReturnType<typeof createAskState>,
  group: OptionGroup,
  focusedId: string | undefined,
  depth: number,
  style: Parameters<typeof renderDocumentRows>[3],
): RenderRow[] {
  return group.options.flatMap((option) => {
    const active = isOptionActive(document, state, option.id);
    const selected = state.selected.has(option.id);
    const focused = active && option.id === focusedId;
    const marker = group.mode === "multi" ? (selected ? "[x]" : "[ ]") : (selected ? "(•)" : "( )");
    const cursor = focused ? ">" : " ";
    const indent = "  ".repeat(depth);
    const raw = `${cursor} ${indent}${marker} ${option.label}`;
    const text = !active ? style.dim(raw) : focused ? style.focus(raw) : style.muted(raw);

    return [
      { text, optionId: option.id },
      ...option.children.flatMap((childGroup) => renderGroupRows(document, state, childGroup, focusedId, depth + 1, style)),
    ];
  });
}
