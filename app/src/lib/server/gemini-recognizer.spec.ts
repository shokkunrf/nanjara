import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('$app/server', () => ({
  read: () => new Response(new ArrayBuffer(8)),
}));

vi.mock('$env/static/private', () => ({
  GEMINI_API_KEY: 'test-key',
  GEMINI_MODEL: 'test-model',
}));

vi.mock('$lib/server/assets/pai-catalog-1.png', () => ({ default: 'cat1' }));
vi.mock('$lib/server/assets/pai-catalog-2.png', () => ({ default: 'cat2' }));
vi.mock('$lib/server/assets/pai-catalog-3.png', () => ({ default: 'cat3' }));
vi.mock('$lib/server/assets/pai-catalog-4.png', () => ({ default: 'cat4' }));

function geminiResponse(numbers: string[]) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(numbers) }] } }],
      }),
  };
}

describe('gemini-recognizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('Gemini APIレスポンスの番号をパイIDに変換する', async () => {
    mockFetch.mockResolvedValue(geminiResponse(['003', '008']));

    const { recognizePais } = await import('./gemini-recognizer.js');
    const result = await recognizePais(['base64photo']);

    expect(result).toEqual(['003_livelive_honoka.png', '008_livelive_maki.png']);
  });

  it('Gemini APIにカタログ画像と写真を送信する', async () => {
    mockFetch.mockResolvedValue(geminiResponse(['003']));

    const { recognizePais } = await import('./gemini-recognizer.js');
    await recognizePais(['photo1', 'photo2']);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('test-model');
    expect(url).toContain('key=test-key');

    const body = JSON.parse(options.body);
    const parts = body.contents[0].parts;
    // 1 text + 4 catalogs + 2 photos = 7
    expect(parts).toHaveLength(7);
    expect(parts[0].text).toContain('カタログ');
    expect(parts[5].inline_data.mime_type).toBe('image/jpeg');
    expect(parts[6].inline_data.mime_type).toBe('image/jpeg');
  });

  it('ゼロパディングなしの番号も正しく変換する', async () => {
    mockFetch.mockResolvedValue(geminiResponse(['3', '8']));

    const { recognizePais } = await import('./gemini-recognizer.js');
    const result = await recognizePais(['base64photo']);

    expect(result).toEqual(['003_livelive_honoka.png', '008_livelive_maki.png']);
  });

  it('存在しない番号は結果から除外される', async () => {
    mockFetch.mockResolvedValue(geminiResponse(['003', '999']));

    const { recognizePais } = await import('./gemini-recognizer.js');
    const result = await recognizePais(['base64photo']);

    expect(result).toEqual(['003_livelive_honoka.png']);
  });

  it('Gemini APIがエラーを返した場合エラーをスローする', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const { recognizePais } = await import('./gemini-recognizer.js');

    await expect(recognizePais(['photo'])).rejects.toThrow('Gemini API error 500');
  });

  it('Gemini APIが不正なJSONを返した場合エラーをスローする', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'not json' }] } }],
        }),
    });

    const { recognizePais } = await import('./gemini-recognizer.js');

    await expect(recognizePais(['photo'])).rejects.toThrow('Invalid JSON from Gemini');
  });

  it('Gemini APIレスポンスにテキストがない場合エラーをスローする', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [] } }],
        }),
    });

    const { recognizePais } = await import('./gemini-recognizer.js');

    await expect(recognizePais(['photo'])).rejects.toThrow('No text in Gemini response');
  });

  it('thinkingパートを除外してテキストを取得する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ thought: true, text: 'thinking...' }, { text: '["003"]' }],
              },
            },
          ],
        }),
    });

    const { recognizePais } = await import('./gemini-recognizer.js');
    const result = await recognizePais(['photo']);

    expect(result).toEqual(['003_livelive_honoka.png']);
  });
});
