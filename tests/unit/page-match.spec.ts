import { expect, test } from '@playwright/test';
import {
  hostOf,
  isLowcodePage,
  matchesUrl,
  pickPage,
  pickPageByTitle,
} from '../../src/browser/page-match';

function fakePage(url: string, title = '') {
  return { url: () => url, title: async () => title };
}

test('解析主机名', () => {
  expect(hostOf('https://athena-test.digiwincloud.com.cn/login?x=1')).toBe('athena-test.digiwincloud.com.cn');
  expect(hostOf('not-a-url')).toBe('');
});

test('区分业务页与门户', () => {
  const lowcode = 'https://lowcode-form-render-test.apps.digiwincloud.com.cn/?workItemCode=X';
  expect(isLowcodePage(lowcode, 'lowcode-form-render-test.apps.digiwincloud.com.cn')).toBe(true);
  expect(isLowcodePage('https://athena-test.digiwincloud.com.cn/', 'lowcode-form-render-test.apps.digiwincloud.com.cn')).toBe(false);
});

test('URL 条件匹配', () => {
  const url = 'https://lowcode-form-render-test.apps.digiwincloud.com.cn/?tabName=存货参数';
  expect(matchesUrl(url, { urlIncludes: 'lowcode-form-render' })).toBe(true);
  expect(matchesUrl(url, { urlIncludes: 'athena-test.digiwincloud' })).toBe(false);
  expect(matchesUrl(url, { urlPattern: /tabName=/ })).toBe(true);
});

test('prefer=last 返回最后一个匹配页', () => {
  const pages = [fakePage('https://a.test/1'), fakePage('https://a.test/2'), fakePage('https://b.test/3')];
  expect(pickPage(pages, { urlIncludes: 'a.test' })?.url()).toBe('https://a.test/1');
  expect(pickPage(pages, { urlIncludes: 'a.test', prefer: 'last' })?.url()).toBe('https://a.test/2');
  expect(pickPage(pages, { urlIncludes: 'c.test' })).toBeUndefined();
});

test('按标题筛选页面', async () => {
  const pages = [fakePage('https://a.test/1', '首页'), fakePage('https://a.test/2', '存货参数')];
  const page = await pickPageByTitle(pages, { titleIncludes: '存货参数' });
  expect(page?.url()).toBe('https://a.test/2');
});
