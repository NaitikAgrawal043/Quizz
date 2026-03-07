'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';

/**
 * Pre-processes markdown content to resolve `cld:publicId` references
 * into full Cloudinary URLs before react-markdown parses them.
 * This is necessary because react-markdown sanitizes non-standard protocols.
 */
function resolveCloudinaryUrls(markdown: string): string {
    if (!CLOUD_NAME) return markdown;
    // Match ![alt](cld:publicId) and replace with full URL
    return markdown.replace(
        /!\[([^\]]*)\]\(cld:([^)]+)\)/g,
        (_match, alt, publicId) =>
            `![${alt}](https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId})`
    );
}

const components: Components = {
    img: ({ src, alt, ...props }) => {
        if (!src) return null;
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={src as string}
                alt={alt || 'Question image'}
                loading="lazy"
                className="max-w-full h-auto rounded-lg border my-3 shadow-sm"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
                {...props}
            />
        );
    },
    p: ({ children, ...props }) => (
        <p className="mb-2 leading-relaxed" {...props}>{children}</p>
    ),
    strong: ({ children, ...props }) => (
        <strong className="font-semibold" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }) => (
        <em className="italic" {...props}>{children}</em>
    ),
    code: ({ children, className, ...props }) => {
        const isInline = !className;
        if (isInline) {
            return (
                <code
                    className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                    {...props}
                >
                    {children}
                </code>
            );
        }
        return (
            <code className={`${className || ''} block`} {...props}>
                {children}
            </code>
        );
    },
    pre: ({ children, ...props }) => (
        <pre
            className="bg-muted p-4 rounded-lg overflow-x-auto text-sm my-3"
            {...props}
        >
            {children}
        </pre>
    ),
    ul: ({ children, ...props }) => (
        <ul className="list-disc pl-6 mb-2 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }) => (
        <ol className="list-decimal pl-6 mb-2 space-y-1" {...props}>{children}</ol>
    ),
    blockquote: ({ children, ...props }) => (
        <blockquote
            className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground my-3"
            {...props}
        >
            {children}
        </blockquote>
    ),
    table: ({ children, ...props }) => (
        <div className="overflow-x-auto my-3">
            <table className="min-w-full border-collapse border border-muted" {...props}>
                {children}
            </table>
        </div>
    ),
    th: ({ children, ...props }) => (
        <th className="border border-muted bg-muted/50 px-3 py-2 text-left font-semibold text-sm" {...props}>
            {children}
        </th>
    ),
    td: ({ children, ...props }) => (
        <td className="border border-muted px-3 py-2 text-sm" {...props}>
            {children}
        </td>
    ),
    h1: ({ children, ...props }) => (
        <h1 className="text-2xl font-bold mt-4 mb-2" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
        <h2 className="text-xl font-bold mt-3 mb-2" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }) => (
        <h3 className="text-lg font-semibold mt-3 mb-1" {...props}>{children}</h3>
    ),
    hr: (props) => (
        <hr className="my-4 border-muted" {...props} />
    ),
};

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    if (!content) return null;

    // Resolve cld: references to full Cloudinary URLs before parsing
    const processedContent = resolveCloudinaryUrls(content);

    return (
        <div className={`prose dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}

