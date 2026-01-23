import React, { type CSSProperties } from "react";

export function TelegramLink({
  style,
  username,
}: {
  style?: CSSProperties
  username: string;
}) {
  const formattedUsername =
    username.startsWith('@')
    ? username
    : '@' + username;

  return (
    <a
      target="_blank"
      style={{
        textAlign: 'start',
        width: 'fit-content',
        ...style,
      }}
      href={`https://t.me/${formattedUsername.slice(1)}`}
    >
      {formattedUsername}
    </a>
  )
}