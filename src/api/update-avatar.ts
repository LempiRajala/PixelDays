import { api } from '../utils/utag.js'

export interface UpdateAvatarResponse {
  avatarId: string | null;
}

export const updateAvatar = async (avatar: File | null): Promise<UpdateAvatarResponse> => {
  const form = new FormData();
  if(avatar) {
    form.append('file', avatar);
  }

  const res = await fetch(api`/api/update-avatar`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  if(!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  return await res.json();
}