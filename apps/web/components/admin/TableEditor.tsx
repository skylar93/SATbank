'use client'

interface TableData {
  headers: string[]
  rows: string[][]
}

interface TableEditorProps {
  tableData: TableData
  onTableDataChange: (newTableData: TableData) => void
  isCompact?: boolean
}

export function TableEditor({
  tableData,
  onTableDataChange,
  isCompact = false,
}: TableEditorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Table Data
      </label>
      <div className="space-y-4 p-4 border border-gray-300 rounded-md bg-gray-50">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Headers (comma separated)
          </label>
          <input
            type="text"
            value={tableData?.headers?.join(', ') || ''}
            onChange={(e) => {
              const headers = e.target.value
                .split(',')
                .map((h) => h.trim())
                .filter((h) => h)
              onTableDataChange({
                ...tableData,
                headers,
                rows: tableData?.rows || [],
              })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Header 1, Header 2, Header 3..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Table Rows
          </label>
          <div className="space-y-2">
            {tableData?.rows?.map((row, rowIndex) => (
              <div key={rowIndex} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.join(', ')}
                  onChange={(e) => {
                    const newRowData = e.target.value
                      .split(',')
                      .map((cell) => cell.trim())
                    const newRows = [...(tableData?.rows || [])]
                    newRows[rowIndex] = newRowData
                    onTableDataChange({
                      ...tableData,
                      headers: tableData?.headers || [],
                      rows: newRows,
                    })
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder={`Row ${rowIndex + 1} data (comma separated)...`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const newRows =
                      tableData?.rows?.filter((_, i) => i !== rowIndex) || []
                    onTableDataChange({
                      ...tableData,
                      headers: tableData?.headers || [],
                      rows: newRows,
                    })
                  }}
                  className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            )) || []}
            <button
              type="button"
              onClick={() => {
                const newRows = [...(tableData?.rows || []), ['']]
                onTableDataChange({
                  ...tableData,
                  headers: tableData?.headers || [],
                  rows: newRows,
                })
              }}
              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
            >
              + Add Row
            </button>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-300">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Preview
          </label>
          {tableData && (
            <div
              className={`${isCompact ? 'mt-2 mb-2' : 'mt-4 mb-4'} overflow-x-auto max-w-full`}
            >
              <table
                className={`w-full border-collapse border border-gray-300 bg-white ${isCompact ? 'text-sm' : ''}`}
              >
                <thead>
                  <tr className="bg-gray-50">
                    {tableData.headers.map((header: string, i: number) => (
                      <th
                        key={i}
                        className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-left font-semibold text-gray-900 break-words`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row: string[], i: number) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      {row.map((cell: string, j: number) => (
                        <td
                          key={j}
                          className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-gray-900 break-words`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
