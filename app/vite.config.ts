import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DEBUG_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const DEBUG_IMAGE_OUT_DIR = path.resolve(import.meta.dirname, 'static/e2e/output');

/**
 * DEV専用のデバッグ画像受け取りエンドポイント。
 * /__debug-image に POST された JPEG を static/e2e/output/ に保存する。
 * dev server ミドルウェアとして動作し、本番ビルドには含まれない。
 */
function debugImagePlugin(): Plugin {
  let dirReady: Promise<void> | null = null;
  return {
    name: 'debug-image-endpoint',
    configureServer(server) {
      server.middlewares.use('/__debug-image', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const contentType = req.headers['content-type'] ?? '';
        if (!contentType.startsWith('image/jpeg')) {
          res.statusCode = 415;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        let aborted = false;
        req.on('data', (chunk: Buffer) => {
          if (aborted) return;
          total += chunk.length;
          if (total > DEBUG_IMAGE_MAX_BYTES) {
            aborted = true;
            req.destroy();
            res.statusCode = 413;
            res.end();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => {
          if (aborted) return;
          if (total === 0) {
            res.statusCode = 204;
            res.end();
            return;
          }
          void (async () => {
            try {
              if (!dirReady) {
                dirReady = fs.mkdir(DEBUG_IMAGE_OUT_DIR, { recursive: true }).then(
                  () => undefined,
                  (e) => {
                    dirReady = null;
                    throw e;
                  },
                );
              }
              await dirReady;
              const id = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
              await fs.writeFile(
                path.join(DEBUG_IMAGE_OUT_DIR, `${id}_overlay.jpg`),
                Buffer.concat(chunks),
              );
              res.statusCode = 204;
              res.end();
            } catch (e) {
              console.error('[debug-image] 保存失敗', e);
              res.statusCode = 500;
              res.end();
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [sveltekit(), basicSsl(), debugImagePlugin()],
  server: {
    host: true,
  },
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }],
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
        },
      },

      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
});
