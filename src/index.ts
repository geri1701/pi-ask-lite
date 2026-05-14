import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { parseAskMarkdown } from "./parse.js";
import { runAskUi } from "./ui.js";

const AskParams = Type.Object({
  markdown: Type.String({
    description: "Complete Markdown prompt to show to the user. The tool returns the final user answer as Markdown/text.",
  }),
});

type AskDetails = {
  answer: string;
};

const askDescription = `Ask the user with a Markdown prompt.

Use exactly:
- \`- option\` for single choice.
- \`- [ ] option\` for multi choice.
- \`* item\` for non-interactive context bullets.
- Headings split independent required groups.
- Indented options create dependent subchoices.
- Never use \`- [x]\` in prompts; express recommendations in normal Markdown.

The tool returns the user's final answer as Markdown/text.`;

export default function askUserLite(pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask",
    label: "Ask User",
    description: askDescription,
    promptSnippet: "Ask the user with one complete Markdown prompt; returns the user's final Markdown/text answer.",
    parameters: AskParams,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) throw new Error("Operation aborted");
      if (!ctx.hasUI) throw new Error("Interactive UI is not available for ask.");

      const document = parseAskMarkdown(params.markdown);
      if (signal?.aborted) throw new Error("Operation aborted");

      const answer = await runAskUi(ctx, document);
      if (signal?.aborted) throw new Error("Operation aborted");

      return {
        content: [{ type: "text", text: `User answer:\n\n${answer}` }],
        details: { answer } satisfies AskDetails,
      };
    },
  });
}
