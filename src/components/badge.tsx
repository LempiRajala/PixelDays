import React, { PropsWithChildren } from 'react';
import type { PropsWithStyle } from '../types';

export function Badge({ children, style, backgroundColor }: PropsWithChildren & PropsWithStyle & {
  backgroundColor: string;
}) {
  return (
    <span style={{
      borderRadius: '8px',
      background: backgroundColor,
      marginLeft: '4px',
      padding: '1px 5px 1px 5px',
      // font-weight не работает на этих шрифтах походу
      textShadow: '0 0 0.5px black',
      fontSize: '13px',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </span>
  )
}