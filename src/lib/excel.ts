"use client";

export async function exportToExcel<T extends Record<string, any>>(
  rows: T[],
  filename: string,
  sheetName = "Sheet1"
) {
  if (rows.length === 0) {
    alert("لا توجد بيانات للتصدير");
    return;
  }
  
  // Dynamic import to avoid loading xlsx on every page
  const XLSX = await import('xlsx');
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function importFromExcel<T = Record<string, any>>(file: File): Promise<T[]> {
  // Dynamic import to avoid loading xlsx on every page
  const XLSX = await import('xlsx');
  
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<T>(ws, { defval: "" });
}
