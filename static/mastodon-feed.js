(() => {
  const list = document.querySelector('[data-mastodon-feed]');
  const status = document.querySelector('[data-mastodon-status]');
  if (!list) return;

  const accountId = '116704794004638319';
  const endpoint = `https://hachyderm.io/api/v1/accounts/${accountId}/statuses?limit=5&exclude_replies=true&exclude_reblogs=true`;
  const cacheKey = 'mastodon-feed:v1';
  // 1 hour.
  const cacheTtl = 60 * 60 * 1000;

  const allowedTags = new Set(['A', 'P', 'SPAN', 'BR']);
  const allowedAttrs = new Set(['href']);

  function cleanContent(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    for (const el of [...template.content.querySelectorAll('*')]) {
      if (!allowedTags.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        continue;
      }

      for (const attr of [...el.attributes]) {
        if (!allowedAttrs.has(attr.name)) el.removeAttribute(attr.name);
      }

      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (!href.startsWith('https://')) {
          el.removeAttribute('href');
        } else {
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }

    return template.innerHTML;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (Array.isArray(cached)) return { fetchedAt: 0, posts: cached };
      if (Array.isArray(cached?.posts)) return cached;
      return null;
    } catch {
      return null;
    }
  }

  function writeCache(posts) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), posts }));
    } catch {
      // Ignore private browsing/storage quota failures.
    }
  }

  function render(posts) {
    list.replaceChildren();

    for (const post of posts.slice(0, 5)) {
      const item = document.createElement('li');
      const date = document.createElement('a');
      const content = document.createElement('div');
      const formattedDate = formatDate(post.created_at);

      date.href = post.url;
      date.textContent = formattedDate;
      date.rel = 'noopener noreferrer';
      date.setAttribute('aria-label', `View Mastodon post from ${formattedDate}`);
      content.innerHTML = cleanContent(post.content);

      item.append(date, content);
      list.append(item);
    }

    if (status) status.remove();
  }

  const cached = readCache();
  if (cached) render(cached.posts);

  if (cached && Date.now() - cached.fetchedAt < cacheTtl) return;

  fetch(endpoint, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`Mastodon returned ${response.status}`);
      return response.json();
    })
    .then((posts) => {
      const freshPosts = posts.map(({ created_at, url, content }) => ({ created_at, url, content }));
      writeCache(freshPosts);
      render(freshPosts);
    })
    .catch(() => {
      if (!cached && status) {
        status.innerHTML = 'Could not load Mastodon posts. <a href="https://hachyderm.io/@keinzirp" rel="me noopener noreferrer">View them on Mastodon</a>.';
      }
    });
})();
