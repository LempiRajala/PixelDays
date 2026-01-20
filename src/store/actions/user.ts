import { UserActionsType, type UserAction } from "../reducers/user";

export function setSelfAvatarId(avatarId: string | null) {
  return {
    type: UserActionsType.SET_AVATAR_ID,
    avatarId,
  } satisfies UserAction;
}

export function setSelfBannerId(bannerId: string | null) {
  return {
    type: UserActionsType.SET_BANNER_ID,
    bannerId,
  } satisfies UserAction;
}