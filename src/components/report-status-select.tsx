import React from 'react';
import { makeReportStatusUserFriendly, reportStatuses } from '../db/shared.ts';
import type { ReportStatuses } from '../db/schema.ts';
import { t } from 'ttag';

type Props = {
  value?: ReportStatuses;
  onChange: (value: ReportStatuses) => void;
  allowUnset: false;
} | {
  value?: ReportStatuses;
  onChange: (value: ReportStatuses | undefined) => void;
  allowUnset: true; 
}

export function ReportStatusSelect({
  value,
  onChange,
  allowUnset,
}: Props) {
  return (
    <select
      style={{
        cursor: 'pointer',
        width: 'fit-content',
        outline: 'none',
      }}
      value={value || 'not-selected'}
      onChange={e => {
        const value = e.target.value;
        if(value === 'not-selected') {
          if(allowUnset) {
            onChange(undefined);
          }
        } else {
          onChange(value as ReportStatuses);
        }
      }}
    >
      <option
        value="not-selected"
        disabled={!allowUnset}
      >
        {t`Not selected`}
      </option>
      {
        reportStatuses.map(status => (
          <option key={status} value={status}>
            {makeReportStatusUserFriendly(status)}
          </option>
        ))
      }
    </select>
  )
}