export function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagText(block, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  return stripTags(m ? m[1] || m[2] || '' : '');
}

export function parseRssItems(xml, source) {
  const items = [];
  const chunks = String(xml || '').split(/<item[\s>]/i).slice(1);
  for (const chunk of chunks) {
    const block = chunk.split(/<\/item>/i)[0];
    const title = tagText(block, 'title');
    const link = tagText(block, 'link');
    const description = tagText(block, 'description');
    if (!title && !link) continue;
    items.push({
      id: `${source}:${link || title}`,
      title,
      body: description,
      text: `${title}\n${description}`,
      url: link,
      subreddit: source,
      source,
      createdUtc: null,
    });
  }
  return items;
}

export function decodeDdgHref(href) {
  if (!href) return '';
  try {
    const abs = href.startsWith('//') ? `https:${href}` : href;
    const u = new URL(abs, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : abs;
  } catch {
    return href;
  }
}

export function parseDdgHtml(html, source = 'duckduckgo') {
  const items = [];
  const re =
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(html))) {
    const url = decodeDdgHref(m[1].replace(/&amp;/g, '&'));
    const title = stripTags(m[2]);
    const snippet = stripTags(m[3]);
    if (!title || seen.has(url || title)) continue;
    seen.add(url || title);
    items.push({
      id: `${source}:${url || title}`,
      title,
      body: snippet,
      text: `${title}\n${snippet}`,
      url,
      subreddit: source,
      source,
      createdUtc: null,
    });
  }
  return items;
}
