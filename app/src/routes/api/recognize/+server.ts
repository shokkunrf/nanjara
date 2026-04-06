import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recognizePais } from '$lib/server/gemini-recognizer.js';

export const POST: RequestHandler = async ({ request }) => {
  const { photos } = (await request.json()) as { photos: string[] };
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    error(400, 'photos array is required');
  }

  try {
    const paiIds = await recognizePais(photos);
    return json({ paiIds });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    error(502, message);
  }
};
