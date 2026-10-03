const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
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
  'strong',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'alt',
  'class',
  'colspan',
  'data-material-image',
  'height',
  'href',
  'rel',
  'rowspan',
  'src',
  'style',
  'target',
  'title',
  'width',
]);

function isSafeUrl(value: string, kind: 'href' | 'src') {
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/g, '');
  if (!normalized) return false;

  if (kind === 'src' && /^{{MATERIAL_IMAGE:[^}]+}}$/.test(normalized)) {
    return true;
  }

  if (/^(https?:|mailto:|tel:)/i.test(normalized)) return true;
  return false;
}

function sanitizeStyle(value: string) {
  return value
    .replace(/url\\s*\\(\\s*['"]?\\s*(?:javascript:|vbscript:|data:text\\/html)[^)]*\\)/gi, '')
    .replace(/expression\\s*\\(/gi, '')
    .replace(/-moz-binding\\s*:/gi, '');
}

export function sanitizeMaterialHtml(html: string) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';

  const elements = Array.from(wrapper.querySelectorAll('*'));

  elements.forEach((element) => {
    const tag = element.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (name.startsWith('on') || name === 'srcdoc' || !ALLOWED_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if ((name === 'href' || name === 'src') && !isSafeUrl(value, name)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (name === 'style') {
        const safeStyle = sanitizeStyle(value);
        if (safeStyle.trim()) {
          element.setAttribute('style', safeStyle);
        } else {
          element.removeAttribute('style');
        }
      }
    });

    if (tag === 'a') {
      const href = element.getAttribute('href');
      if (!href) {
        element.removeAttribute('target');
        element.removeAttribute('rel');
      } else if (element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', 'noopener noreferrer');
      }
    }

    if (tag === 'img') {
      element.setAttribute('loading', 'lazy');
      element.setAttribute('decoding', 'async');
    }
  });

  return wrapper.innerHTML;
}
