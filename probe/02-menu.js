const { attach } = require('./attach');
const fs = require('fs');

(async () => {
  const { page } = await attach();
  await page.waitForTimeout(1000);

  const tree = await page.evaluate(() => {
    const root = document.querySelector('ul.menu-list');
    if (!root) return null;

    const readNode = (li) => {
      const content = li.querySelector(':scope > .menu-content');
      const sub = li.querySelector(':scope > .ant-menu-sub > ul');
      const titleEl = li.querySelector(':scope > .ant-menu-submenu-title .menu-content');
      const icon = li.querySelector(':scope > .ant-menu-submenu-title .icon-container i, :scope > .menu-content .icon-container i');
      const node = {
        id: (content || titleEl)?.id || null,
        text: ((content || titleEl)?.innerText || '').trim().replace(/\s+/g, ' '),
        level: [...li.classList].find((c) => /^level-\d+$/.test(c)) || null,
        type: li.classList.contains('ant-menu-submenu') ? 'submenu' : 'item',
        attrs: {
          'data-*': [...li.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `${a.name}=${a.value}`),
          role: li.getAttribute('role'),
        },
        icon: icon ? icon.className.replace(/^.*icon\s+/, '') : null,
      };
      if (sub) node.children = [...sub.children].filter((c) => c.tagName === 'LI').map(readNode);
      return node;
    };

    return {
      rootClass: root.className,
      items: [...root.children].filter((c) => c.tagName === 'LI').map(readNode),
    };
  });

  fs.mkdirSync('outputs', { recursive: true });
  fs.writeFileSync('outputs/menu-tree.json', JSON.stringify(tree, null, 2), 'utf8');

  const count = (nodes) => nodes.reduce((n, x) => n + 1 + (x.children ? count(x.children) : 0), 0);
  console.log('top-level:', tree.items.length, 'total nodes:', count(tree.items));
  console.log(JSON.stringify(tree.items.map((i) => ({
    id: i.id, text: i.text, type: i.type,
    children: i.children ? i.children.length : 0,
  })), null, 2));
  process.exit(0);
})();
