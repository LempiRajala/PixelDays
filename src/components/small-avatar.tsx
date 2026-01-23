import React, { type CSSProperties } from "react";
import type { User } from "../db/schema";
import { getFileUrl } from "../core/client-utils";
import { CgProfile } from "react-icons/cg";

const avatarStyle: CSSProperties = {
  gridColumnStart: 1,
  width: '32px',
  height: '32px',
  borderRadius: '9999px',
  overflow: 'hidden',
}

export function SmallAvatar({
  avatarId,
}: {
  avatarId: User['avatarId'];
}) {
  return (
    <div style={avatarStyle}>
      { avatarId &&
        <img
          alt={`${name} avatar`}
          src={getFileUrl(avatarId)}
          width={32}
          height={32}
        />
      }
      { avatarId === null &&
        <CgProfile
          size={32}
        />
      }
    </div>
  )
}