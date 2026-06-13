import DOMPurify, { type Config } from 'dompurify'

const SAFE_URI = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$)|data:image\/(?:png|gif|jpe?g|webp);base64,)/i

const COMMON_CONFIG: Config = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'col',
    'colgroup',
    'dd',
    'del',
    'div',
    'dl',
    'dt',
    'em',
    'font',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'span',
    'strike',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ],
  ALLOWED_ATTR: [
    'align',
    'alt',
    'border',
    'cellpadding',
    'cellspacing',
    'colspan',
    'color',
    'height',
    'href',
    'rel',
    'rowspan',
    'src',
    'target',
    'title',
    'width',
  ],
  ALLOWED_URI_REGEXP: SAFE_URI,
  FORBID_TAGS: ['base', 'embed', 'form', 'iframe', 'link', 'meta', 'object', 'script', 'style'],
  FORBID_ATTR: ['style'],
}

export function sanitizeHtml(html: unknown): string {
  return DOMPurify.sanitize(String(html ?? ''), COMMON_CONFIG)
}

export function htmlFromPlainText(value: string): string {
  const div = document.createElement('div')
  div.textContent = value
  return div.innerHTML.replace(/\r?\n/g, '<br />')
}
