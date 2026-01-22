import React, { memo } from "react"
import { getFileUrl } from "../core/client-utils";
import { avatarSizeAfterUploading } from "../core/constants";
import { numberToString } from '../core/utils.js';
import type { UnmarshalledUser } from "../db/schema";
import { t } from "ttag";

interface Props extends
  Pick<UnmarshalledUser, 'avatarId' | 'bannerId' | 'username'>,
  Partial<Pick<UnmarshalledUser, 'lastSeen' | 'createdAt'>>
{
  dailyTotalPixels?: number;
  dailyRanking?: number;
  totalPixels?: number;
  ranking?: number;
}

export const UserProfileInfo = memo<Props>(({
  username,
  dailyTotalPixels,
  dailyRanking,
  totalPixels,
  ranking,
  avatarId,
  bannerId,
  createdAt,
  lastSeen,
}) => {
  const hasBanner = bannerId !== null;

  return (
    <div style={{
      display: 'grid',
      position: 'relative',
      gridTemplateColumns: avatarId ? '1fr 1fr' : '1fr',
    }}>
      { bannerId !== null &&
        <div style={{
          width: 'calc(100% + 16px)',
          height: 'calc(100% + 16px)',
          overflow: 'hidden',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          borderRadius: '8px',
          zIndex: 0,
        }}>
          <img
            src={getFileUrl(bannerId)}
            alt="banner"
            style={{
              objectFit: 'cover',
              width: '100%',
              height: '100%',
            }}
          />
        </div>
      }
      { avatarId !== null &&
        <img
          src={getFileUrl(avatarId)}
          alt="avatar"
          style={{
            width: `${avatarSizeAfterUploading}px`,
            height: `${avatarSizeAfterUploading}px`,
            borderRadius: '9999px',
            boxShadow: '0 0 5px black',
            border: '1px solid black',
            zIndex: 1,
          }}
        />
      }
      <div style={{
        alignSelf: 'center',
        textAlign: avatarId ? 'start' : 'center',
        zIndex: 1,
      }}>
        <InfoLine
          bannerStyled={hasBanner}
          label={t`Username`}
          value={username}
        />
        { createdAt &&
          <InfoLine
            bannerStyled={hasBanner}
            label={t`Registered`}
            value={createdAt}
          />
        }
        { lastSeen &&
          <InfoLine
            bannerStyled={hasBanner}
            label={t`Last login`}
            value={lastSeen}
          />
        }
        { dailyTotalPixels !== undefined &&
          <InfoLine
            bannerStyled={hasBanner}
            label={t`Today Placed Pixels`}
            value={dailyTotalPixels}
          />
        }
        { dailyRanking !== undefined &&
          <InfoLine
            bannerStyled={hasBanner}
            label={t`Daily Rank`}
            value={dailyRanking}
            zero="N/A"
            rank
          />
        }
        { totalPixels !== undefined &&
          <InfoLine
            bannerStyled={hasBanner}
            label={t`Placed Pixels`}
            value={totalPixels}
          />
        }
        { ranking !== undefined &&
          <InfoLine
            bannerStyled={hasBanner}
            label={t`Total Rank`}
            value={ranking}
            zero="N/A"
            rank
          />
        }
      </div>
    </div>
  )
});

UserProfileInfo.displayName = 'UserProfileInfo';

function InfoLine({
  label,
  value,
  rank,
  zero,
  bannerStyled,
}: {
  label?: string,
  value?: number | string | Date;
  rank?: boolean;
  zero?: string,
  bannerStyled: boolean;
}) {
  return (
    <p style={bannerStyled ? {
      background: 'white',
      boxShadow: '0 0 4px black',
      borderRadius: '8px',
      paddingLeft: '8px',
    } : {}}>
      { label &&
        <span className="stattext">{(rank) ? `${label}: #` : `${label}: `}</span>
      }
      { value !== undefined &&
        <>
          &nbsp;
          <span className="statvalue">{
            typeof value === 'number' ? numberToString(value, zero) :
            value instanceof Date ? formatDate(value) :
            value
          }</span>
        </>
      }
    </p>
  )
}

function formatDate(date: Date) {
  const iso = date.toISOString();
  return iso.substring(0, iso.indexOf('.')).replaceAll('-', '.').replaceAll('T', ' ');
}