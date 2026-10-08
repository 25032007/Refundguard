import React from 'react';

export default function Skeleton({ width, height, className = '', style = {}, ...props }) {
  return (
    <div
      className={`rg-skeleton ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}
