import React from 'react';

export default function Table({ columns, data, rowKey, onRowClick, className = '', ...props }) {
  return (
    <div className={`rg-table-container ${className}`} {...props}>
      <table className="rg-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={col.key || idx} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowKey ? row[rowKey] : rowIndex}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((col, colIndex) => (
                <td key={col.key || colIndex} data-label={col.label}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
