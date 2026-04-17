import { useState } from 'react';
import type { CloudFrontStat, SortField, SortOrder } from '../../types/viewer';
import './DataTable.css';
import ExcelJS from 'exceljs';

interface DataTableProps {
  stats: CloudFrontStat[];
  totalRequests: number;
  channelName: string;
  dateInfo: string;
}

const DataTable = ({ stats, totalRequests, channelName, dateInfo }: DataTableProps) => {
  const [sortField, setSortField] = useState<SortField>('requestCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const totalBytes = stats.reduce((sum, stat) => sum + parseFloat(stat.bytesMB), 0);

  const handleExcelDownload = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = dateInfo.replace(/\d{4}년 /g, '');
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = [
      { header: '국가', key: 'country', width: 30 },
      { header: '요청 수', key: 'requestCount', width: 15 },
      { header: '요청 %', key: 'requestPercent', width: 12 },
      { header: '바이트(MB)', key: 'bytesMB', width: 20 }
    ];
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    for (let col = 1; col <= 4; col++) {
      const cell = headerRow.getCell(col);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    sortedStats.forEach(stat => {
      worksheet.addRow({ country: stat.country, requestCount: parseInt(stat.requestCount.toString()), requestPercent: stat.requestPercent + '%', bytesMB: parseFloat(stat.bytesMB).toFixed(2) });
    });
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        for (let col = 1; col <= 4; col++) {
          const cell = row.getCell(col);
          cell.border = { left: { style: 'thin' }, right: col === 4 ? { style: 'thin' } : undefined };
          if (col >= 2) cell.alignment = { horizontal: 'right' };
        }
      }
    });
    const addTotalRow = (label: string, value: string | number) => {
      const row = worksheet.addRow({ country: label, requestCount: typeof value === 'number' ? value : '', requestPercent: '', bytesMB: typeof value === 'string' ? value : '' });
      for (let col = 1; col <= 4; col++) {
        const cell = row.getCell(col);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 4) cell.alignment = { horizontal: 'right' };
      }
    };
    addTotalRow('총 요청 수', totalRequests);
    addTotalRow('총 바이트', totalBytes.toFixed(2));
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${channelName} 채널 - ${dateInfo}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const sortedStats = [...stats].sort((a, b) => {
    let aValue: number | string = 0;
    let bValue: number | string = 0;
    if (sortField === 'country') { aValue = a.country; bValue = b.country; }
    else if (sortField === 'requestCount') { aValue = a.requestCount; bValue = b.requestCount; }
    else if (sortField === 'requestPercent') { aValue = parseFloat(a.requestPercent); bValue = parseFloat(b.requestPercent); }
    else if (sortField === 'bytesMB') { aValue = parseFloat(a.bytesMB); bValue = parseFloat(b.bytesMB); }
    if (typeof aValue === 'string' && typeof bValue === 'string') return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
  });

  const getSortIcon = (field: SortField) => sortField !== field ? '⇅' : sortOrder === 'asc' ? '↑' : '↓';

  return (
    <div className="data-table-container">
      <div className="table-header">
        <h3>총 요청 수: {totalRequests.toLocaleString()}</h3>
        <h3>총 트래픽: {totalBytes.toLocaleString()}MB</h3>
      </div>
      <button onClick={handleExcelDownload} className="excel-download-button">엑셀 다운로드</button>
      <table className="data-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('country')} className="sortable">국가명 {getSortIcon('country')}</th>
            <th onClick={() => handleSort('requestCount')} className="sortable">요청 수 {getSortIcon('requestCount')}</th>
            <th onClick={() => handleSort('requestPercent')} className="sortable">요청 % {getSortIcon('requestPercent')}</th>
            <th onClick={() => handleSort('bytesMB')} className="sortable">바이트{getSortIcon('bytesMB')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedStats.map((stat, index) => (
            <tr key={index}>
              <td>{stat.country}</td>
              <td className="number">{stat.requestCount.toLocaleString()}</td>
              <td className="number">{stat.requestPercent}%</td>
              <td className="number">{parseFloat(stat.bytesMB).toLocaleString()}MB</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
