import { type HTMLAttributes } from 'react';

export function Separator({ style, ...props }: HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        margin: '0.75rem 0',
        ...style,
      }}
      {...props}
    />
  );
}
