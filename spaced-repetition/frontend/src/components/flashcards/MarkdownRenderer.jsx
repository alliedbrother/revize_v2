import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import './MarkdownRenderer.css';

const MarkdownRenderer = ({ content }) => {
  // Custom components for better styling control
  const components = {
    h1: ({ node, ...props }) => <h1 className="md-h1" {...props} />,
    h2: ({ node, ...props }) => <h2 className="md-h2" {...props} />,
    h3: ({ node, ...props }) => <h3 className="md-h3" {...props} />,
    h4: ({ node, ...props }) => <h4 className="md-h4" {...props} />,
    h5: ({ node, ...props }) => <h5 className="md-h5" {...props} />,
    h6: ({ node, ...props }) => <h6 className="md-h6" {...props} />,
    p: ({ node, ...props }) => <p className="md-paragraph" {...props} />,
    strong: ({ node, ...props }) => <strong className="md-strong" {...props} />,
    em: ({ node, ...props }) => <em className="md-em" {...props} />,
    pre: ({ node, ...props }) => <pre className="md-pre" {...props} />,
    code: ({ node, inline, className, children, ...props }) => {
      // Check if this is inline code or a code block
      // inline prop indicates whether the code is inline (true) or in a block (false)
      // className is usually present for code blocks (e.g., "language-javascript")
      const isInline = inline || !className;

      return isInline ? (
        <code className="md-code-inline" {...props}>
          {children}
        </code>
      ) : (
        <code className="md-code-block" {...props}>
          {children}
        </code>
      );
    },
    ul: ({ node, ...props }) => <ul className="md-list" {...props} />,
    ol: ({ node, ...props }) => <ol className="md-list-ordered" {...props} />,
    li: ({ node, ...props }) => <li className="md-list-item" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="md-quote" {...props} />,
    a: ({ node, ...props }) => (
      <a className="md-link" target="_blank" rel="noopener noreferrer" {...props} />
    ),
    table: ({ node, ...props }) => (
      <div className="md-table-wrapper">
        <table className="md-table" {...props} />
      </div>
    ),
    hr: ({ node, ...props }) => <hr className="md-hr" {...props} />,
  };

  // Fallback for empty or invalid content
  if (!content || typeof content !== 'string') {
    return (
      <div className="md-content md-empty">
        <p className="md-paragraph">No content available</p>
      </div>
    );
  }

  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
        skipHtml={true}
        unwrapDisallowed={true}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
