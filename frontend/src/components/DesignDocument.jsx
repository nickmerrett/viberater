import { useEffect, useRef } from 'react';

export default function DesignDocument({ content }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!content || !containerRef.current) return;

    // Load Mermaid from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.async = true;

    script.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#7c3aed',
          primaryTextColor: '#fff',
          primaryBorderColor: '#a78bfa',
          lineColor: '#a78bfa',
          secondaryColor: '#581c87',
          tertiaryColor: '#1e1b4b',
        }
      });
      renderContent();
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [content]);

  const renderContent = async () => {
    if (!containerRef.current || !window.mermaid) return;

    // Parse markdown and render mermaid diagrams
    const parts = content.split(/```mermaid\n([\s\S]*?)```/g);
    let html = '';

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular markdown text
        html += `<div class="prose prose-invert max-w-none">${formatMarkdown(parts[i])}</div>`;
      } else {
        // Mermaid diagram
        try {
          const { svg } = await window.mermaid.render(`mermaid-${i}`, parts[i]);
          html += `<div class="mermaid-diagram bg-gray-900/50 rounded-lg p-6 my-6 overflow-x-auto">${svg}</div>`;
        } catch (e) {
          console.error('Mermaid render error:', e);
          html += `<div class="bg-red-500/10 border border-red-500/50 rounded-lg p-4 my-4">
            <p class="text-red-400 font-medium">Failed to render diagram</p>
            <pre class="text-xs text-gray-400 mt-2 overflow-x-auto">${parts[i]}</pre>
          </div>`;
        }
      }
    }

    containerRef.current.innerHTML = html;
  };

  const formatMarkdown = (text) => {
    return text
      .replace(/#{3} (.*?)$/gm, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>')
      .replace(/#{2} (.*?)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
      .replace(/#{1} (.*?)$/gm, '<h1 class="text-3xl font-bold mt-10 mb-5">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-2 py-1 rounded text-sm text-accent">$1</code>')
      .replace(/^- (.*?)$/gm, '<li class="ml-6">$1</li>')
      .replace(/^(\d+)\. (.*?)$/gm, '<li class="ml-6">$2</li>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/^(?!<[h|l])/gm, '<p class="mb-4">');
  };

  return (
    <div
      ref={containerRef}
      className="design-document text-gray-200"
    >
      {!content && <p className="text-gray-400">No design document available</p>}
    </div>
  );
}
