import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recognizePais } from '$lib/server/gemini-recognizer.js';

export const POST: RequestHandler = async ({ request }) => {
  const formData = await request.formData();
  const photo = formData.get('photo');
  if (!photo || !(photo instanceof File)) {
    error(400, 'photo file is required');
  }

  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const paiIds = await recognizePais(buffer);
    return json({ paiIds });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    error(502, message);
  }
};
