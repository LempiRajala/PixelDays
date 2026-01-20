import { api } from '../utils/utag.js'

export interface UpdateBannerResponse {
  bannerId: string | null;
}

export const updateBanner = async (banner: File | null): Promise<UpdateBannerResponse> => {
  const form = new FormData();
  if(banner) {
    form.append('file', banner);
  }

  const res = await fetch(api`/api/update-banner`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  if(!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  return await res.json();
}