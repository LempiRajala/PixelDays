import React from 'react';
import { makeReportCategoryUserFriendly, reportCategories } from '../db/shared.ts';
import type { ReportCategories } from '../db/schema.ts';
import { t } from 'ttag';

type Props = {
  value?: ReportCategories;
  onChange: (value: ReportCategories) => void;
  allowUnset: false;
} | {
  value?: ReportCategories;
  onChange: (value: ReportCategories | undefined) => void;
  allowUnset: true; 
}

export function ReportCategorySelect({
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
          onChange(value as ReportCategories);
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
        reportCategories.map(category => (
          <option key={category} value={category}>
            {makeReportCategoryUserFriendly(category)}
          </option>
        ))
      }
    </select>
  )
}