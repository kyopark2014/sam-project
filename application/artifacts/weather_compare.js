const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, HeadingLevel
} = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "2E75B6" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

// 헤더 셀 생성 함수
function headerCell(text, width) {
  return new TableCell({
    borders: headerBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "1F4E79", type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 150, right: 150 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 22, font: "Arial" })]
    })]
  });
}

// 데이터 셀 생성 함수
function dataCell(text, width, bgColor = "FFFFFF", bold = false, align = AlignmentType.CENTER) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 150, right: 150 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, bold, size: 20, font: "Arial", color: "333333" })]
    })]
  });
}

// 구분선 단락
function divider(color = "2E75B6") {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
    spacing: { after: 160 },
    children: []
  });
}

// 섹션 제목
function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "1F4E79", font: "Arial" })]
  });
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20 } }
    }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
      }
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "2E75B6", space: 1 } },
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "서울 vs 제주 날씨 비교 리포트  |  기상청 날씨누리", size: 18, color: "888888", font: "Arial" })
            ]
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "2E75B6", space: 1 } },
            spacing: { before: 100 },
            children: [
              new TextRun({ text: "출처: 기상청 날씨누리 (weather.go.kr)  |  에어코리아 (airkorea.or.kr)  |  Page ", size: 16, color: "888888", font: "Arial" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888", font: "Arial" }),
            ]
          })
        ]
      })
    },
    children: [
      // ── 제목 ──
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: "서울 vs 제주 날씨 비교 리포트", bold: true, size: 40, color: "1F4E79", font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: "2026년 06월 02일 (화) 17:00 기준", size: 20, color: "666666", font: "Arial" })]
      }),
      divider("2E75B6"),

      // ── 1. 실시간 현황 ──
      sectionTitle("1. 실시간 현황"),
      new Table({
        width: { size: 9906, type: WidthType.DXA },
        columnWidths: [2500, 3703, 3703],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("항목", 2500),
              headerCell("🏙️ 서울", 3703),
              headerCell("🌴 제주", 3703),
            ]
          }),
          new TableRow({ children: [
            dataCell("현재 기온", 2500, "EBF3FB", true, AlignmentType.CENTER),
            dataCell("31.0℃ (체감 29.5℃)", 3703, "FFFFFF"),
            dataCell("21.7℃ (체감 23.7℃)", 3703, "F0F7FF"),
          ]}),
          new TableRow({ children: [
            dataCell("풍향 / 풍속", 2500, "EBF3FB", true, AlignmentType.CENTER),
            dataCell("북서 / 1.3 m/s", 3703, "FFFFFF"),
            dataCell("북동 / 4.0 m/s", 3703, "F0F7FF"),
          ]}),
          new TableRow({ children: [
            dataCell("습도", 2500, "EBF3FB", true, AlignmentType.CENTER),
            dataCell("40%", 3703, "FFFFFF"),
            dataCell("81%", 3703, "F0F7FF"),
          ]}),
          new TableRow({ children: [
            dataCell("하늘 상태", 2500, "EBF3FB", true, AlignmentType.CENTER),
            dataCell("대체로 맑음", 3703, "FFFFFF"),
            dataCell("구름 많음", 3703, "F0F7FF"),
          ]}),
        ]
      }),

      // ── 2. 일별 기온 예보 ──
      sectionTitle("2. 일별 기온 예보 (℃)"),
      new Table({
        width: { size: 9906, type: WidthType.DXA },
        columnWidths: [1600, 1300, 1300, 1300, 1300, 1300, 1806],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("지역", 1600),
              headerCell("구분", 1300),
              headerCell("오늘(02일)", 1300),
              headerCell("내일(03일)", 1300),
              headerCell("모레(04일)", 1300),
              headerCell("글피(05일)", 1300),
              headerCell("평년(오늘)", 1806),
            ]
          }),
          new TableRow({ children: [
            dataCell("서울", 1600, "EBF3FB", true),
            dataCell("최저", 1300, "EBF3FB", true),
            dataCell("12.1", 1300),
            dataCell("15", 1300),
            dataCell("16", 1300),
            dataCell("16", 1300),
            dataCell("12.5", 1806, "FFF9E6"),
          ]}),
          new TableRow({ children: [
            dataCell("", 1600, "EBF3FB"),
            dataCell("최고", 1300, "EBF3FB", true),
            dataCell("32.3", 1300),
            dataCell("32", 1300),
            dataCell("30", 1300),
            dataCell("31", 1300),
            dataCell("28.1", 1806, "FFF9E6"),
          ]}),
          new TableRow({ children: [
            dataCell("제주", 1600, "E8F4FD", true),
            dataCell("최저", 1300, "E8F4FD", true),
            dataCell("12.1", 1300, "F0F7FF"),
            dataCell("15", 1300, "F0F7FF"),
            dataCell("16", 1300, "F0F7FF"),
            dataCell("16", 1300, "F0F7FF"),
            dataCell("12.5", 1806, "FFF9E6"),
          ]}),
          new TableRow({ children: [
            dataCell("", 1600, "E8F4FD"),
            dataCell("최고", 1300, "E8F4FD", true),
            dataCell("32.3", 1300, "F0F7FF"),
            dataCell("32", 1300, "F0F7FF"),
            dataCell("30", 1300, "F0F7FF"),
            dataCell("31", 1300, "F0F7FF"),
            dataCell("28.1", 1806, "FFF9E6"),
          ]}),
        ]
      }),

      // ── 3. 대기질 ──
      sectionTitle("3. 대기질 예보"),
      new Table({
        width: { size: 9906, type: WidthType.DXA },
        columnWidths: [2500, 3703, 3703],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("항목", 2500),
              headerCell("🏙️ 서울", 3703),
              headerCell("🌴 제주", 3703),
            ]
          }),
          new TableRow({ children: [
            dataCell("미세먼지 (PM-10)", 2500, "EBF3FB", true),
            dataCell("보통", 3703),
            dataCell("좋음 ✅", 3703, "F0F7FF"),
          ]}),
          new TableRow({ children: [
            dataCell("초미세먼지 (PM-2.5)", 2500, "EBF3FB", true),
            dataCell("보통", 3703),
            dataCell("보통", 3703, "F0F7FF"),
          ]}),
        ]
      }),

      // ── 4. 단기 날씨 전망 ──
      sectionTitle("4. 단기 날씨 전망"),
      new Table({
        width: { size: 9906, type: WidthType.DXA },
        columnWidths: [1600, 4153, 4153],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("날짜", 1600),
              headerCell("🏙️ 서울", 4153),
              headerCell("🌴 제주", 4153),
            ]
          }),
          new TableRow({ children: [
            dataCell("오늘(02일)", 1600, "EBF3FB", true),
            dataCell("대체로 맑음", 4153, "FFFFFF", false, AlignmentType.LEFT),
            dataCell("구름 많음", 4153, "F0F7FF", false, AlignmentType.LEFT),
          ]}),
          new TableRow({ children: [
            dataCell("내일(03일)", 1600, "EBF3FB", true),
            dataCell("맑다가 오전부터 구름 많아짐, 오후 소나기 가능", 4153, "FFFFFF", false, AlignmentType.LEFT),
            dataCell("제주 제외 예보 적용 (맑다가 구름)", 4153, "F0F7FF", false, AlignmentType.LEFT),
          ]}),
          new TableRow({ children: [
            dataCell("모레(04일)", 1600, "EBF3FB", true),
            dataCell("전국 대체로 흐림, 소나기 가능", 4153, "FFFFFF", false, AlignmentType.LEFT),
            dataCell("새벽~낮 사이 비 예보 🌧️", 4153, "F0F7FF", false, AlignmentType.LEFT),
          ]}),
          new TableRow({ children: [
            dataCell("글피(05일)", 1600, "EBF3FB", true),
            dataCell("흐리다가 오전부터 맑아짐", 4153, "FFFFFF", false, AlignmentType.LEFT),
            dataCell("늦은 밤 다시 흐려짐", 4153, "F0F7FF", false, AlignmentType.LEFT),
          ]}),
        ]
      }),

      // ── 5. 종합 비교 요약 ──
      sectionTitle("5. 종합 비교 요약"),
      new Table({
        width: { size: 9906, type: WidthType.DXA },
        columnWidths: [2500, 3703, 3703],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("비교 항목", 2500),
              headerCell("🏙️ 서울", 3703),
              headerCell("🌴 제주", 3703),
            ]
          }),
          new TableRow({ children: [
            dataCell("기온 특성", 2500, "EBF3FB", true),
            dataCell("고온 건조 (31℃, 습도 40%)", 3703),
            dataCell("온화 다습 (21.7℃, 습도 81%)", 3703, "F0F7FF"),
          ]}),
          new TableRow({ children: [
            dataCell("바람", 2500, "EBF3FB", true),
            dataCell("약풍 (1.3 m/s)", 3703),
            dataCell("중간 바람 (4.0 m/s)", 3703, "F0F7FF"),
          ]}),
          new TableRow({ children: [
            dataCell("대기질", 2500, "EBF3FB", true),
            dataCell("보통", 3703),
            dataCell("PM-10 좋음 / PM-2.5 보통", 3703, "F0F7FF"),
          ]}),
          new TableRow({ children: [
            dataCell("주의사항", 2500, "EBF3FB", true),
            dataCell("폭염 주의, 자외선 차단 필요", 3703, "FFF3E0"),
            dataCell("강풍·비 대비 우산 준비 권장", 3703, "E8F5E9"),
          ]}),
        ]
      }),

      new Paragraph({ spacing: { before: 200 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "※ 본 자료는 기상청 날씨누리 및 에어코리아 기준입니다.", size: 16, color: "999999", font: "Arial", italics: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/Users/ksdyb/Documents/src/sam-project/application/artifacts/weather_compare.docx', buffer);
  console.log('✅ 문서 생성 완료!');
});
