import React from 'react';
import { useRef, useState } from "react";
import { fileToImage, getImageFromUser } from "../../core/client-utils";
import { avatarSizeAfterUploading, maxUploadFileSize } from "../../core/constants";
import { t } from 'ttag';
import { updateAvatar } from '../../api/update-avatar';
import type { PropsWithStyle } from '../../types';
import store from '../../store/store';
import { setSelfAvatarId } from '../../store/actions/user';

export function AvatarUpdateForm({ 
  style,
}: PropsWithStyle) {
  const [file, setFile] = useState<File | null>(null);
  const [tooBigFile, setTooBigFile] = useState(false);
  const [canvasHoleRadius, setCanvasHoleRadius] = useState(128);
  const canvasContext = useRef<CanvasRenderingContext2D | null>(null);

  const clearCanvas = () => {
    canvasContext.current!.clearRect(
      0, 0,
      canvasContext.current!.canvas.width,
      canvasContext.current!.canvas.height,
    );
  }

  const onChangeFile = async () => {
    const file = await getImageFromUser();

    if(!file) {
      setFile(null);
      setTooBigFile(false);
      clearCanvas();
    } else {
      const fileTooBig = file.size > maxUploadFileSize;
      setTooBigFile(fileTooBig);
      if(fileTooBig) {
        setFile(null);
        clearCanvas();
      } else {
        setFile(file);
        const { image, revoke } = await fileToImage(file);
        canvasContext.current!.canvas.width = image.width;
        canvasContext.current!.canvas.height = image.height;
        canvasContext.current!.drawImage(image, 0, 0);
        revoke();
      }
    }
  }

  const onApplyAvatarChange = async () => {
    if(tooBigFile || !file) return;
    const { avatarId } = await updateAvatar(file);
    store.dispatch(setSelfAvatarId(avatarId));
    setFile(null);
    clearCanvas();
  }

  const onRemoveAvatar = async () => {
    await updateAvatar(null);
    store.dispatch(setSelfAvatarId(null));
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      ...style,
    }}>
      <div
        style={{
          position: 'relative',
          cursor: 'pointer',
          width: `${avatarSizeAfterUploading}px`,
          height: `${avatarSizeAfterUploading}px`,
          border: 'black 1px solid',
          marginBottom: '8px',
        }}
        onClick={onChangeFile}
      >
        { !file &&
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              background: '#e8e8e8',
              border: 'solid 1px black',
              padding: '8px',
            }}
          >
            {t`Click to upload avatar`}
          </div>
        }
        { file &&
          <canvas
            style={{
              position: 'absolute',
              inset: '0',
              width: '100%',
              height: '100%',
            }}
            ref={el => canvasContext.current = el?.getContext('2d') ?? null}
          />
        }
        { file && !tooBigFile &&
          <div
            style={{
              position: 'absolute',
              inset: '0',
              width: '100%',
              height: '100%',
              background: `radial-gradient(circle at center, transparent ${canvasHoleRadius}px, rgba(0,0,0,0.5) ${canvasHoleRadius + 1}px)`,
            }}
          />
        }
        { tooBigFile &&
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              color: 'red',
              background: '#e8e8e8',
              border: 'solid 1px black',
              padding: '8px',
            }}
          >
            {t`File must be less than`} <span style={{ whiteSpace: 'nowrap' }}>{(maxUploadFileSize / 1024 / 1024).toFixed(2)} mb.</span>
          </div>
        }
      </div>
      <div style={{
        display: 'flex',
        gap: '8px',
        flexDirection: 'row',
        alignContent: 'center',
      }}>
        <button
          style={{
            cursor: 'pointer',
          }}
          disabled={file === null}
          onClick={onApplyAvatarChange}
        >
          {t`Change avatar`}
        </button>
        <button
          style={{
            cursor: 'pointer',
          }}
          onClick={onRemoveAvatar}
        >
          {t`Remove avatar`}
        </button>
      </div>
    </div>
  )
}