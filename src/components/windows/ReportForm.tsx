import React, { type PropsWithChildren, useState } from 'react';
import { t } from 'ttag';
import type { CreateReportRequest } from '../../api-contracts.ts';
import { createReport } from '../../api/reports.ts';
import { RedStar } from './red-star.tsx';
import { sleep } from '../../core/shared-utils.ts';
import { shallowEqual, useSelector } from 'react-redux';
import type { State } from '../../store/store.ts';
import { ReportCategorySelect } from '../report-category-select.tsx';

type EditableFields = 
  Omit<CreateReportRequest, 'category'>
  & Partial<Pick<CreateReportRequest, 'category'>>;

const emptyFields: EditableFields = {
  text: '',
  title: '',
}

const ReportForm = () => {
  const user = useSelector<State>(state => state.user, shallowEqual) as State['user'];
  // const { args: { userId } } = useWindow();
  const [fields, setFields] = useState<EditableFields>(emptyFields);
  const [sendInProcess, setSendInProcess] = useState(false);
  const [showSendDone, setShowSendDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSendReport =
    !!user &&
    !sendInProcess &&
    fields.category !== undefined
    && fields.title && fields.title.trim().length > 0
    && fields.text && fields.text.trim().length > 0;

  const sendReport = async () => {
    if(!canSendReport) return;

    const copy = { ...fields }
    if(copy.telegram && copy.telegram.trim().length === 0) delete copy.telegram;
    if(copy.discord && copy.discord.trim().length === 0) delete copy.discord;

    try {
      setSendInProcess(true);
      await createReport(fields as CreateReportRequest);
      setShowSendDone(true);
      sleep(5e3).then(() => setShowSendDone(false));
      setFields(emptyFields);
    } catch(e) {
      setError(
        e instanceof Error
          ? e.message
          : JSON.stringify(e)
      );
    } finally {
      setSendInProcess(false);
    }
  }

  const addCurrentLinkToText = () => {
    setFields(prev => {
      const textWithTrailingSpace = prev.text.endsWith(' ') ? prev.text : prev.text + ' ';
      return {
        ...prev,
        text: textWithTrailingSpace + location.href + ' ',
      }
    });
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <Field>
        <span>{t`Topic`}<RedStar/> </span>
        <input
          value={fields.title}
          onChange={e => setFields(prev => ({ ...prev, title: e.target.value }))}
          maxLength={64}
          autoFocus
          style={{ outline: 'none' }}
        />
      </Field>

      <Field>
        <span>{t`Category`}<RedStar/> </span>
        <ReportCategorySelect
          allowUnset={false}
          value={fields.category}
          onChange={category => setFields(prev => ({ ...prev, category }))}
        />
      </Field>

      <Field>
        <span>{t`Telegram`} </span>
        <input
          value={fields.telegram || ''}
          onChange={e => setFields(prev => ({ ...prev, telegram: e.target.value}))}
          maxLength={32}
          style={{ outline: 'none' }}
        />
      </Field>

      <Field>
        <span>{t`Discord`} </span>
        <input
          value={fields.discord || ''}
          onChange={e => setFields(prev => ({ ...prev, discord: e.target.value}))}
          maxLength={32}
          style={{ outline: 'none' }}
        />
      </Field>

      <Field>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
          <span>{t`Report description`}<RedStar/>: </span>
          <button
            style={{ cursor: 'pointer' }}
            onClick={addCurrentLinkToText}
          >
            {t`Add current position link`}
          </button>
        </div>
        <textarea
          value={fields.text}
          style={{
            resize: 'none',
            height: '150px',
            outline: 'none',
          }}
          onChange={e => setFields(prev => ({ ...prev, text: e.target.value }))}
          maxLength={2048}
        />
      </Field>

      <button
        disabled={!canSendReport}
        onClick={sendReport}
        style={{
          cursor: canSendReport ? 'pointer' : 'not-allowed',
          width: 'fit-content',
          outline: 'none',
        }}
      >
        {t`Send`}
      </button>

      <div style={{
        color: 'springgreen',
        textAlign: 'center',
        opacity: showSendDone ? '1' : '0',
        transition: 'opacity 250ms ease-out',
      }}>
        {t`Report successfully sent!`}
      </div>

      { error &&
        <div style={{ color: 'red' }}>
          {error}
        </div>
      }

      { !user &&
        <div style={{
          position: 'absolute',
          display: 'flex',
          alignContent: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'rgba(128,128,128,0.5)',
        }}>
          <span style={{
            border: '1px solid black',
            padding: '4px',
            background: 'rgb(128,128,128)',
            maxWidth: '100%',
          }}>
            {t`Only registered users can send reports`}.
          </span>
        </div>
      }
    </div>
  );
};

function Field({ children }: PropsWithChildren) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }}>
      {children}
    </div>
  )
}

export default React.memo(ReportForm);
