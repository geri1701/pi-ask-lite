# pi-ask-lite

A tiny, pleasant Markdown ask tool for Pi.

`pi-ask-lite` registers one tool, `ask`. The agent passes one complete Markdown prompt; the user selects, edits, or writes a free-text answer; the tool returns the final answer as Markdown/text.

## Install

```bash
pi install npm:pi-ask-lite
```

## Tool

Tool name: `ask`

Parameter:

```ts
{
  markdown: string
}
```

## Example

Ask with this Markdown:

```md
Choose what to do next:

* The implementation is complete.
* Checks passed locally.

- Release now
- Run one more smoke test
- Make a small polish pass
```

The user sees a TUI-native choice prompt and the agent receives the selected answer as Markdown/text.

## Markdown interaction syntax

Use normal Markdown for explanation and a few lightweight conventions for choices.

Non-interactive context bullets use `*`:

```md
Given:

* non-interactive context bullet
* another context fact
```

Single choice uses `- option`:

```md
- Option A
- Option B
```

Multi choice uses `- [ ] option`:

```md
- [ ] Option A
- [ ] Option B
```

Independent required groups can be separated with headings:

```md
## Color
- Red
- Blue

## Size
- Small
- Large
```

Dependent subchoices are expressed by indentation:

```md
- [ ] Parent
    - Child A
    - Child B
```

Do not preselect options with `- [x]` in prompts. Express recommendations in normal Markdown text or emphasis instead.

## User interaction

The extension uses a focused TUI overlay during the tool call:

- `Space` selects/toggles the focused option.
- `Shift+Space` selects/toggles and marks the answer for draft editing.
- `Enter` sends a valid selection, or opens the selected Markdown as an editable draft when draft mode is active.
- `Esc` / `Ctrl+C` opens an empty free-text editor.

Direct selections return only the selected Markdown structure. Free-text and edited drafts are returned unchanged.

## Development

Run locally:

```bash
pi --extension ./src/index.ts
```

Checks:

```bash
npm run check
npm test
npm run pack:dry
```
