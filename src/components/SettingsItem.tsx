import React, { type PropsWithChildren } from 'react';
import ToggleButton, { type ToggleProps } from 'react-toggle';

const SettingsItem = React.memo(({
  title,
  keyBind,
  value,
  onToggle,
  children,
  deactivated,
}: PropsWithChildren & {
  title: string;
  keyBind?: string;
  value: ToggleProps['checked'];
  onToggle: ToggleProps['onChange'];
  deactivated?: ToggleProps['disabled'];
}) => (
  <div className="setitem">
    <div className="setrow">
      <h3 className="settitle">
        {title} {keyBind && <kbd>{keyBind}</kbd>}
      </h3>
      <ToggleButton
        checked={value}
        onChange={onToggle}
        disabled={deactivated}
      />
    </div>
    <div className="modaldesc">{children}</div>
    <div className="modaldivider" />
  </div>
), (prevProps, nextProps) => prevProps.value === nextProps.value);

export default SettingsItem;
