import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAskMarkdown } from "../src/parse.js";
import type { OptionGroup, TextBlock } from "../src/types.js";

function groupAt(markdown: string, sectionIndex = 0, blockIndex = 0): OptionGroup {
  const block = parseAskMarkdown(markdown).sections[sectionIndex].blocks[blockIndex];
  assert.equal(block.type, "group");
  return block;
}

describe("parseAskMarkdown", () => {
  it("parses a simple single-choice group", () => {
    const group = groupAt("- Red\n- Blue");

    assert.equal(group.mode, "single");
    assert.deepEqual(group.options.map((option) => option.label), ["Red", "Blue"]);
  });

  it("parses a simple multi-choice group", () => {
    const group = groupAt("- [ ] Email\n- [ ] SMS");

    assert.equal(group.mode, "multi");
    assert.deepEqual(group.options.map((option) => option.label), ["Email", "SMS"]);
  });

  it("keeps star bullets as non-interactive context", () => {
    const document = parseAskMarkdown("Given:\n\n* context A\n* context B\n\n- Option A");

    assert.equal(document.sections[0].blocks.length, 2);
    assert.equal(document.sections[0].blocks[0].type, "text");
    assert.deepEqual((document.sections[0].blocks[0] as TextBlock).lines, [
      "Given:",
      "",
      "* context A",
      "* context B",
      "",
    ]);
    assert.equal(document.sections[0].blocks[1].type, "group");
  });

  it("rejects preselected checkbox options", () => {
    assert.throws(
      () => parseAskMarkdown("- [x] Recommended"),
      /Preselected options are not allowed/,
    );
  });

  it("rejects empty checkbox options", () => {
    assert.throws(
      () => parseAskMarkdown("- [ ]"),
      /Interactive options must not be empty/,
    );
  });

  it("rejects mixed sibling selection styles", () => {
    assert.throws(
      () => parseAskMarkdown("- Single\n- [ ] Multi"),
      /Mixed selection styles in the same option group/,
    );
  });

  it("splits independent groups by headings", () => {
    const document = parseAskMarkdown("## Color\n- Red\n- Blue\n\n## Size\n- Small\n- Large");

    assert.equal(document.sections.length, 2);
    assert.deepEqual(document.sections.map((section) => section.heading?.text), ["Color", "Size"]);
    assert.equal((document.sections[0].blocks[0] as OptionGroup).options[0].label, "Red");
    assert.equal((document.sections[1].blocks[0] as OptionGroup).options[0].label, "Small");
  });

  it("parses nested dependent child groups", () => {
    const group = groupAt("- [ ] First\n    - Single A\n    - Single B\n- [ ] Second\n    - [ ] Multi A\n    - [ ] Multi B");

    assert.equal(group.mode, "multi");
    assert.equal(group.options[0].children.length, 1);
    assert.equal(group.options[0].children[0].mode, "single");
    assert.deepEqual(group.options[0].children[0].options.map((option) => option.label), ["Single A", "Single B"]);
    assert.equal(group.options[1].children.length, 1);
    assert.equal(group.options[1].children[0].mode, "multi");
    assert.deepEqual(group.options[1].children[0].options.map((option) => option.label), ["Multi A", "Multi B"]);
  });

  it("ignores selection syntax inside code fences", () => {
    const document = parseAskMarkdown("```md\n- [x] not an option\n- neither this\n```\n\n- Real option");

    assert.equal(document.sections[0].blocks.length, 2);
    assert.equal(document.sections[0].blocks[0].type, "text");
    assert.equal((document.sections[0].blocks[1] as OptionGroup).options[0].label, "Real option");
  });

  it("does not treat non-list hyphen text or horizontal rules as options", () => {
    const document = parseAskMarkdown("-not an option\n---\n\n- Real option");

    assert.equal(document.sections[0].blocks.length, 2);
    assert.equal(document.sections[0].blocks[0].type, "text");
    assert.equal((document.sections[0].blocks[1] as OptionGroup).options[0].label, "Real option");
  });
});
