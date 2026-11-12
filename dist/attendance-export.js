window.createAttendanceWorkbook = async ({ template, participants, monthDays, viewTab, holidayName }) => {
  const workbook = new window.ExcelJS.Workbook();
  await workbook.xlsx.load(await template.arrayBuffer());
  const sheet = workbook.getWorksheet('업로드');
  if (!sheet || sheet.getCell('C2').text.trim() !== '*대상자ID' ||
      sheet.getCell('D2').text.trim() !== '*출결일자') {
    throw new Error('출결 엑셀업로드 양식을 선택해 주세요.');
  }

  const idsByName = new Map();
  sheet.eachRow((row, number) => {
    if (number < 4) return;
    const name = row.getCell(2).text.trim();
    const id = row.getCell(3).text.trim();
    if (!name || !id) return;
    if (!idsByName.has(name)) idsByName.set(name, new Set());
    idsByName.get(name).add(id);
  });
  const names = new Map();
  for (const { name } of participants) {
    const key = name.trim();
    names.set(key, (names.get(key) || 0) + 1);
  }
  const codes = { 등원: '01', 미지원: '01', 결석: '04', 휴원: '99' };
  const rows = [];
  const unmatched = [];
  for (const { name, days } of participants) {
    const records = [];
    for (const { dateKey, isWeekend } of monthDays) {
      const holiday = holidayName(dateKey);
      const day = days[dateKey];
      const status = viewTab === 'daily' ? day?.dailyStatus ?? day?.status : day?.status;
      const code = holiday ? '99' : codes[status];
      if (!code || (isWeekend && !holiday)) continue;
      records.push({ dateKey, code, reason: holiday || (status === '휴원' ? '휴원' : null) });
    }
    if (!records.length) continue;

    const key = name.trim();
    const ids = idsByName.get(key);
    if (names.get(key) !== 1 || ids?.size !== 1) {
      unmatched.push(name);
      continue;
    }
    const [id] = ids;
    for (const { dateKey, code, reason } of records) {
      rows.push([null, name, id, dateKey.replaceAll('-', ''), code,
        null, null, null, null, null, null, null, reason]);
    }
  }
  if (unmatched.length) {
    throw new Error(`엑셀 양식에서 대상자ID를 확인해 주세요. ${unmatched.join(', ')}`);
  }
  if (!rows.length) throw new Error('내려받을 출결 기록이 없습니다.');

  // Rebuild the upload sheet so source workbook metadata is not copied.
  const output = new window.ExcelJS.Workbook();
  const upload = output.addWorksheet('업로드');
  const columnCount = 13;
  for (let column = 1; column <= columnCount; column++) {
    const width = sheet.getColumn(column).width;
    if (Number.isFinite(width) && width > 0) upload.getColumn(column).width = width;
  }
  for (let number = 1; number <= 3; number++) {
    const source = sheet.getRow(number);
    const target = upload.getRow(number);
    target.values = Array.from({ length: columnCount }, (_, index) => source.getCell(index + 1).text || null);
    if (Number.isFinite(source.height) && source.height > 0) target.height = source.height;
  }
  upload.mergeCells('A1:M1');
  upload.getCell('A1').font = { bold: true };
  upload.getRow(2).font = { bold: true };
  upload.getRow(2).alignment = { vertical: 'middle', wrapText: true };
  upload.addRows(rows);
  return output.xlsx.writeBuffer();
};
