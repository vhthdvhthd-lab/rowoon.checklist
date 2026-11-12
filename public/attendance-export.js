window.createAttendanceWorkbook = async ({ template, name, monthDays, days, viewTab, holidayName }) => {
  const workbook = new window.ExcelJS.Workbook();
  await workbook.xlsx.load(await template.arrayBuffer());
  const sheet = workbook.getWorksheet('업로드');
  if (!sheet || sheet.getCell('C2').text.trim() !== '*대상자ID' ||
      sheet.getCell('D2').text.trim() !== '*출결일자') {
    throw new Error('출결 엑셀업로드 양식을 선택해 주세요.');
  }

  const ids = new Set();
  sheet.eachRow((row, number) => {
    const id = row.getCell(3).text.trim();
    if (number >= 4 && row.getCell(2).text.trim() === name.trim() && id) ids.add(id);
  });
  if (ids.size !== 1) {
    throw new Error('엑셀 양식에서 이 이용인의 대상자ID를 하나로 확인할 수 없습니다.');
  }
  const [id] = ids;
  const codes = { 등원: '01', 미지원: '01', 결석: '04', 휴원: '99' };
  const rows = [];
  for (const { dateKey, isWeekend } of monthDays) {
    const holiday = holidayName(dateKey);
    const day = days[dateKey];
    const status = viewTab === 'daily' ? day?.dailyStatus ?? day?.status : day?.status;
    const code = holiday ? '99' : codes[status];
    if (!code || (isWeekend && !holiday)) continue;
    rows.push([null, name, id, dateKey.replaceAll('-', ''), code,
      null, null, null, null, null, null, null, holiday || (status === '휴원' ? '휴원' : null)]);
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
