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

  const styles = Array.from({ length: 13 }, (_, i) => sheet.getRow(4).getCell(i + 1).style);
  sheet.eachRow((row, number) => {
    if (number >= 4) row.values = [];
  });
  rows.forEach((values, index) => {
    const row = sheet.getRow(index + 4);
    row.values = values;
    styles.forEach((style, i) => { row.getCell(i + 1).style = style; });
  });
  return workbook.xlsx.writeBuffer();
};
