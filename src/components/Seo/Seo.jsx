import { useEffect } from 'react';
import { useLayout } from '../../contexts/LayoutContext';

export default function Seo() {
  const { platform, siteName, level } = useLayout();

  useEffect(() => {
    if (!platform) return;

    document.title = platform.site_name || siteName;

    const setMeta = (name, content) => {
      if (!content) return;

      let element = document.querySelector(`meta[name="${name}"]`);

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    };

    const setProperty = (property, content) => {
      if (!content) return;

      let element = document.querySelector(`meta[property="${property}"]`);

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    };

    setMeta('description', platform.description);
    setMeta('keywords', platform.keywords);
    setProperty('og:title', platform.site_name);
    setProperty('og:description', platform.description);
    setProperty('og:image', platform.og_image_url);
    setProperty('og:type', 'website');

    const favicon = document.querySelector('link[rel="icon"]');

    if (favicon && platform.favicon_url) {
      favicon.href = platform.favicon_url;
    }
  }, [platform, siteName, level]);

  return null;
}
