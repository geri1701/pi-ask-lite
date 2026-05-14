import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAskMarkdown } from "../src/parse.js";
import { buildAnswerMarkdown, createAskState, isOptionActive, isSelectionValid, selectOption } from "../src/state.js";
import type { OptionGroup } from "../src/types.js";

function firstGroup(markdown: string): OptionGroup {
  const block = parseAskMarkdown(markdown).sections[0].blocks[0];
  assert.equal(block.type, "group");
  return block;
}

describe("ask state", () => {
  it("validates and renders a single choice", () => {
    const document = parseAskMarkdown("- Red\n- Blue");
    const state = createAskState();
    const group = firstGroup("- Red\n- Blue");

    assert.equal(isSelectionValid(document, state), false);
    selectOption(document, state, group.options[1].id);

    assert.equal(isSelectionValid(document, state), true);
    assert.equal(buildAnswerMarkdown(document, state), "- Blue");
  });

  it("validates and renders multiple checked choices", () => {
    const document = parseAskMarkdown("- [ ] Email\n- [ ] SMS\n- [ ] Phone");
    const state = createAskState();
    const group = document.sections[0].blocks[0] as OptionGroup;

    selectOption(document, state, group.options[0].id);
    selectOption(document, state, group.options[2].id);

    assert.equal(isSelectionValid(document, state), true);
    assert.equal(buildAnswerMarkdown(document, state), "- [x] Email\n- [x] Phone");
  });

  it("requires active child groups to be answered", () => {
    const document = parseAskMarkdown("- [ ] Parent\n    - Child A\n    - Child B");
    const state = createAskState();
    const group = document.sections[0].blocks[0] as OptionGroup;
    const parent = group.options[0];
    const child = parent.children[0].options[1];

    assert.equal(isOptionActive(document, state, child.id), false);
    selectOption(document, state, parent.id);

    assert.equal(isSelectionValid(document, state), false);
    assert.equal(isOptionActive(document, state, child.id), true);

    selectOption(document, state, child.id);

    assert.equal(isSelectionValid(document, state), true);
    assert.equal(buildAnswerMarkdown(document, state), "- [x] Parent\n    - Child B");
  });

  it("clears child choices when a parent is unselected", () => {
    const document = parseAskMarkdown("- [ ] Parent\n    - [ ] Child A\n    - [ ] Child B");
    const state = createAskState();
    const group = document.sections[0].blocks[0] as OptionGroup;
    const parent = group.options[0];
    const child = parent.children[0].options[0];

    selectOption(document, state, parent.id);
    selectOption(document, state, child.id);
    assert.equal(buildAnswerMarkdown(document, state), "- [x] Parent\n    - [x] Child A");

    selectOption(document, state, parent.id);

    assert.equal(state.selected.has(parent.id), false);
    assert.equal(state.selected.has(child.id), false);
    assert.equal(isSelectionValid(document, state), false);
  });

  it("switches single parents and clears the previous subtree", () => {
    const document = parseAskMarkdown("- First\n    - Detail A\n- Second\n    - Detail B");
    const state = createAskState();
    const group = document.sections[0].blocks[0] as OptionGroup;
    const first = group.options[0];
    const firstChild = first.children[0].options[0];
    const second = group.options[1];

    selectOption(document, state, first.id);
    selectOption(document, state, firstChild.id);
    selectOption(document, state, second.id);

    assert.equal(state.selected.has(first.id), false);
    assert.equal(state.selected.has(firstChild.id), false);
    assert.equal(state.selected.has(second.id), true);
    assert.equal(isSelectionValid(document, state), false);
  });

  it("keeps headings only for sections with selected answers", () => {
    const document = parseAskMarkdown("## Color\n- Red\n- Blue\n\n## Size\n- Small\n- Large");
    const state = createAskState();
    const color = document.sections[0].blocks[0] as OptionGroup;
    const size = document.sections[1].blocks[0] as OptionGroup;

    selectOption(document, state, color.options[0].id);
    selectOption(document, state, size.options[1].id);

    assert.equal(buildAnswerMarkdown(document, state), "## Color\n- Red\n\n## Size\n- Large");
  });

  it("sets draft mode when selecting as draft", () => {
    const document = parseAskMarkdown("- Red\n- Blue");
    const state = createAskState();
    const group = document.sections[0].blocks[0] as OptionGroup;

    selectOption(document, state, group.options[0].id, true);

    assert.equal(state.draftMode, true);
    assert.equal(buildAnswerMarkdown(document, state), "- Red");
  });
});
