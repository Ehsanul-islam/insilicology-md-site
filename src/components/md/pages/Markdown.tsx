import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

/**
 * Renders trusted or user-written Markdown. Raw HTML is not enabled (react-markdown
 * ignores it by default), so authored content cannot inject markup or scripts.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ href = "", children: c }) =>
            href.startsWith("/") || href.startsWith("#") ? (
              <Link href={href}>{c}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {c}
              </a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
