export function flattenCardFrames(card) {
  const frames = [];
  function walk(node, depth) {
    frames.push({
      title: node.title,
      subtitle: node.subtitle || '',
      image_url: node.image_url || card.image_url || '',
      link: node.link,
      accent: node.accent || card.accent,
      depth
    });
    (node.children || []).forEach(child => walk(child, depth + 1));
  }
  walk(card, 0);
  return frames;
}
