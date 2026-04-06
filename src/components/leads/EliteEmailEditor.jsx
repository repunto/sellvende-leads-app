import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Link as LinkIcon, Unlink
} from 'lucide-react';
import { flattenHtml } from '../../lib/emailTemplate';

/* ─────────────────────────────────────────────────────────
   TOOLBAR BUTTON — individual formatting action
   ───────────────────────────────────────────────────────── */
const ToolbarBtn = ({ icon: Icon, active, onClick, title, disabled }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 6, border: 'none', cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s ease',
        background: active
          ? 'rgba(59,130,246,0.18)'
          : hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: active ? '#60a5fa' : disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon size={16} strokeWidth={active ? 2.8 : 2} />
    </button>
  );
};

/* ─────────────────────────────────────────────────────────
   TOOLBAR — format bar with grouped actions
   ───────────────────────────────────────────────────────── */
const MenuBar = ({ editor }) => {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL del enlace:', previousUrl);
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const dividerStyle = {
    width: 1, alignSelf: 'stretch', margin: '4px 6px',
    background: 'rgba(255,255,255,0.1)',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '8px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '10px 10px 0 0',
      flexWrap: 'wrap',
    }}>
      {/* Format */}
      <ToolbarBtn icon={Bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita" />
      <ToolbarBtn icon={Italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva" />
      <ToolbarBtn icon={UnderlineIcon} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado" />

      <div style={dividerStyle} />

      {/* Lists */}
      <ToolbarBtn icon={List} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista de viñetas" />
      <ToolbarBtn icon={ListOrdered} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada" />

      <div style={dividerStyle} />

      {/* Links */}
      <ToolbarBtn icon={LinkIcon} active={editor.isActive('link')} onClick={setLink} title="Insertar enlace" />
      <ToolbarBtn icon={Unlink} active={false} onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} title="Quitar enlace" />

      {/* Variable Dropdown removed: handled beautifully by parent context-aware buttons (ConfiguracionPage) */}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   MAIN EDITOR COMPONENT (HYBRID: VISUAL & RAW HTML)
   ───────────────────────────────────────────────────────── */
export default function EliteEmailEditor({ value, onChange, placeholder }) {
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'html'
  const lastEmittedValue = useRef(value);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        strike: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: 'color: #3b82f6; text-decoration: underline;',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Only emit changes if we are currently using the visual editor.
      if (activeTab === 'visual') {
        const html = editor.getHTML();
        lastEmittedValue.current = html;
        onChange(html);
      }
    },
    editorProps: {
      attributes: {
        class: 'elite-tiptap-body',
        style: [
          'min-height: 220px',
          'padding: 20px 24px',
          'font-size: 14px',
          'line-height: 1.7',
          'color: rgba(255,255,255,0.88)',
          'outline: none',
          'cursor: text',
        ].join(';'),
      },
    },
  });

  // Re-sync editor content if "value" changes from outside (e.g., switching templates)
  // We ONLY sync if activeTab is 'visual', to prevent TipTap from overwriting raw HTML mode
  useEffect(() => {
    if (editor && value !== undefined && activeTab === 'visual') {
      // Skip sync if we just emitted this exact HTML.
      // This prevents the cursor from jumping to the end of the input when typing.
      if (value === lastEmittedValue.current) {
        return;
      }
      
      if (value !== editor.getHTML()) {
        editor.commands.setContent(value || '', false);
        lastEmittedValue.current = value;
      }
    }
  }, [value, editor, activeTab]);

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'var(--color-bg-elevated, #1a1d2e)',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12), 0 2px 12px rgba(0,0,0,0.15)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
      }}
    >
      {/* ──────────────── TABS HEADER ──────────────── */}
      <div style={{
        display: 'flex',
        background: 'rgba(0,0,0,0.2)',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('visual');
            // Flatten HTML before feeding it back to TipTap to prevent nesting accumulation
            const cleanValue = flattenHtml(value || '');
            if (editor && cleanValue !== editor.getHTML()) {
              editor.commands.setContent(cleanValue, false);
            }
          }}
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer',
            color: activeTab === 'visual' ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            fontWeight: activeTab === 'visual' ? 600 : 400,
            borderBottom: activeTab === 'visual' ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.2s ease',
            fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}
        >
          <span>👁️</span> Vista Visual (Diseño)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('html')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer',
            color: activeTab === 'html' ? '#facc15' : 'rgba(255,255,255,0.5)',
            fontWeight: activeTab === 'html' ? 600 : 400,
            borderBottom: activeTab === 'html' ? '2px solid #facc15' : '2px solid transparent',
            transition: 'all 0.2s ease',
            fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}
        >
          <span>💻</span> Código Crudo (Avanzado)
        </button>
      </div>

      {activeTab === 'visual' ? (
        <>
          <MenuBar editor={editor} />
          <div style={{
            maxHeight: '45vh',
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <EditorContent editor={editor} />
          </div>
        </>
      ) : (
        <div style={{ padding: '0', background: '#0d1117' }}>
          <div style={{
            padding: '8px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'flex', justifyContent: 'space-between'
          }}>
            <span>Edita el HTML puro sin intervención del editor. Se enviará exactamente esto.</span>
            <span>Usa &lt;br&gt; para saltos de línea.</span>
          </div>
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Escribe el código HTML directamente..."}
            style={{
              width: '100%',
              minHeight: '260px',
              maxHeight: '50vh',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#c9d1d9',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'vertical'
            }}
          />
        </div>
      )}

      {/* ProseMirror internal styles — scoped to our editor */}
      <style dangerouslySetInnerHTML={{ __html: `
        .elite-tiptap-body p {
          margin-top: 0;
          margin-bottom: 0.65em;
        }
        .elite-tiptap-body p:last-child {
          margin-bottom: 0;
        }
        .elite-tiptap-body ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .elite-tiptap-body ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .elite-tiptap-body li p {
          display: inline;
          margin: 0;
        }
        .elite-tiptap-body a {
          color: #60a5fa;
          text-decoration: underline;
        }
        .elite-tiptap-body .ProseMirror:focus-visible {
          outline: none;
        }

        .elite-tiptap-body.ProseMirror:focus-visible {
          outline: none;
        }
        .ProseMirror.elite-tiptap-body:focus {
          outline: none;
        }
        .elite-tiptap-body p.is-editor-empty:first-child::before {
          content: 'Escribe el contenido del correo aquí...';
          float: left;
          height: 0;
          pointer-events: none;
          color: rgba(255,255,255,0.25);
          font-style: italic;
        }
      `}} />
    </div>
  );
}
