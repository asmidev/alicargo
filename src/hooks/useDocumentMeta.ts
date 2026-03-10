import { useEffect } from 'react';

interface DocumentMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

const SITE_NAME = 'AliBrand.uz';

function setMetaTag(property: string, content: string, isOg = true) {
  const attr = isOg ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

export function useDocumentMeta({ title, description, image, url, type }: DocumentMeta) {
  useEffect(() => {
    const prev = document.title;
    if (title) {
      document.title = `${title} — ${SITE_NAME}`;
    }

    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDesc = metaDesc?.content;
    if (description) {
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = description;
    }

    // OG tags
    const ogTitle = title ? `${title} — ${SITE_NAME}` : undefined;
    if (ogTitle) setMetaTag('og:title', ogTitle);
    if (description) setMetaTag('og:description', description);
    if (image) setMetaTag('og:image', image);
    if (url) setMetaTag('og:url', url);
    if (type) setMetaTag('og:type', type);
    setMetaTag('og:site_name', SITE_NAME);

    return () => {
      document.title = prev;
      if (metaDesc && prevDesc !== undefined) {
        metaDesc.content = prevDesc || '';
      }
    };
  }, [title, description, image, url, type]);
}
