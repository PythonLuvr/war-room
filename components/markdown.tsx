"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-neutral-950 prose-pre:border prose-pre:border-neutral-800 prose-pre:rounded-lg prose-code:before:hidden prose-code:after:hidden prose-code:bg-neutral-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-300 prose-code:text-[0.85em] prose-headings:text-neutral-100 prose-strong:text-neutral-100 prose-a:text-sky-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
