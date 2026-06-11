'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none text-[0.9rem] prose-headings:tracking-normal prose-a:text-accent prose-a:no-underline prose-a:border-b prose-a:border-accent-muted hover:prose-a:border-accent prose-code:rounded prose-code:bg-line-soft prose-code:px-1.5 prose-code:py-0.5 prose-code:text-accent prose-table:text-[0.85rem]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
