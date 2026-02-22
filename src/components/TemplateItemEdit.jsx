/**
 * Item for list of Tamplates
 */

import React, {
  useRef, useState, useEffect, useMemo,
} from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import templateLoader from '../ui/templateLoader.js';
import { coordsFromString } from '../core/utils.js';
import { fileToImage, base64ToImage } from '../utils/imageFiles.ts';

const TemplateItemEdit = ({
  title: initTitle,
  canvasId: initCanvasId,
  x: initX, y: initY,
  imageId,
  stopEditing,
}) => {
  const [initCoords] = useMemo(() => [
    (Number.isNaN(parseInt(initX, 10))
      || Number.isNaN(parseInt(initY, 10))) ? null : [initX, initY],
  ], [initX, initY]);

  const [coords, setCoords] = useState(initCoords);
  const [dimensions, setDimensions] = useState(null);
  const [title, setTitle] = useState(initTitle || '');
  const [file, setFile] = useState(null);
  const [titleUnique, setTitleUnique] = useState(true);
  const templateCanvasRef = useRef();
  const fileRef = useRef();
  const [
    storeCanvasId,
    canvases,
    templateList,
  ] = useSelector((state) => [
    state.canvas.canvasId,
    state.canvas.canvases,
    state.templates.list,
  ], shallowEqual);
  const [canvasId, selectCanvas] = useState(initCanvasId ?? storeCanvasId);

  useEffect(() => {
    (async () => {
      if (!imageId || !templateCanvasRef.current) {
        return;
      }
      const templateCanvas = await templateLoader.getTemplate(imageId);
      if (!templateCanvas) {
        return;
      }

      const canvas = templateCanvasRef.current;
      canvas.width = templateCanvas.width;
      canvas.height = templateCanvas.height;
      canvas.getContext('2d').drawImage(templateCanvas, 0, 0);
      setDimensions([templateCanvas.width, templateCanvas.height]);
    })();
  }, [imageId]);

  useEffect(() => {
    if (!file || !templateCanvasRef.current) {
      return;
    }
    (async () => {
      const img = await fileToImage(file);
      const canvas = templateCanvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      setDimensions([img.width, img.height]);
    })();
  }, [file]);

  const canSubmit = (templateCanvasRef.current && (file || imageId)
    && titleUnique && coords && title && dimensions);

  return (
    <div className="tmpitm">
      <div className="tmpitm-preview">
        <div style={{ width: '100%', height: '100%' }}>
          <canvas
            className="tmpitm-img"
            ref={templateCanvasRef}
            key="editimg"
            style={{ opacity: 0.4 }}
          />
        </div>
        <div
          className="centered-on-img modallink"
          onClick={() => fileRef.current?.click()}
        >{t`Select File`}</div>
        <input
          type="file"
          key="hinpt"
          accept="image/*"
          ref={fileRef}
          style={{ display: 'none' }}
          onChange={(evt) => {
            setDimensions(null);
            setFile(evt.target.files?.[0]);
          }}
        />
      </div>
      <div className="tmpitm-desc">
        <h4><input
          value={title}
          style={{ width: '10em' }}
          type="text"
          onChange={(evt) => {
            const newTitle = evt.target.value;
            setTitleUnique(!templateList.some((z) => z.title === newTitle));
            setTitle(evt.target.value);
          }}
          placeholder={t`Template Name`}
        /></h4>
        <p>{t`Canvas`}:&nbsp;
          <span><select
            value={canvasId}
            onChange={(e) => {
              const sel = e.target;
              selectCanvas(sel.options[sel.selectedIndex].value);
            }}
          >
            {Object.keys(canvases)
              .filter((c) => !canvases[c].v && !canvases[c].ed)
              .map((canvas) => (
                <option key={canvas} value={canvas}>
                  {canvases[canvas].title}
                </option>
              ),
              )}
          </select></span>
        </p>
        <p>
          {t`Coordinates`}:&nbsp;
          <span><input
            type="text"
            defaultValue={coords && coords.join('_')}
            style={{
              display: 'inline-block',
              maxWidth: '8em',
            }}
            placeholder="X_Y or URL"
            onChange={(evt) => {
              const co = coordsFromString(evt.target.value.trim());
              if (co) {
                evt.target.value = co.join('_');
              }
              setCoords(co);
            }}
          /></span>
        </p>
        <p>
          {t`Dimensions`}:&nbsp;<span>
            {(dimensions) ? dimensions.join(' x ') : 'N/A'}
          </span>
        </p>
      </div>
      <div className="tmpitm-actions">
        {(initTitle) && (
          <button
            onClick={() => {
              stopEditing(initTitle);
              templateLoader.deleteTemplate(initTitle);
            }}
            type="button"
          >
            {t`Delete`}
          </button>
        )}
        <button
          onClick={() => stopEditing(title)}
          type="button"
        >
          {t`Cancel`}
        </button>
        <button
          disabled={!canSubmit}
          onClick={async () => {
            if (!canSubmit) {
              return;
            }
            const [x, y] = coords;
            if (!initTitle) {
              await templateLoader.addFile(file, title, canvasId, x, y);
            } else {
              if (file && imageId) {
                await templateLoader.updateFile(imageId, file);
              }
              if (initTitle
                && (initTitle !== title || initX !== x
                || initY !== y || initCanvasId !== canvasId
                )) {
                templateLoader.changeTemplate(initTitle, {
                  title, canvasId, x, y,
                });
              }
            }
            stopEditing(initTitle);
          }}
          type="button"
        >
          {t`Save`}
        </button>
      </div>
    </div>
  );
};

export default React.memo(TemplateItemEdit);
