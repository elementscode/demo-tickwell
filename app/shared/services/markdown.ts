import { Marked } from "marked";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SAFE_URL = /^(https?:|mailto:|\/|#)/i;

/**
 * Descriptions and comments come from any teammate and render as html, so
 * raw html in the source is shown as text and a link can only point at the
 * web, mail, or this app.
 */
const markdown = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
  walkTokens(token) {
    if ((token.type === "link" || token.type === "image") && !SAFE_URL.test(token.href.trim())) {
      token.href = "#";
    }
  },
});

export function renderMarkdown(source: string): string {
  return markdown.parse(source) as string;
}
