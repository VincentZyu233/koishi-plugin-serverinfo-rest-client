#import "common.typ": *
#set page(width: 620pt, height: auto, margin: 16pt, fill: page-fill)
#set text(font: text-fonts, size: 10pt, fill: theme-color("text"), lang: "zh")

#let stat-cards = ()
#for stat in payload.stats {
  stat-cards.push(block(
    fill: theme-color("panel_fill"),
    stroke: 1pt + theme-color("panel_stroke"),
    radius: 4pt,
    inset: 9pt,
    width: 100%,
  )[
    #text(size: 8pt, fill: theme-color("stats_text"))[#stat.label]
    #v(3pt)
    #text(size: 15pt, weight: "bold", fill: theme-color("section_title"))[#stat.value]
  ])
}

#block(fill: theme-color("header_fill"), stroke: 2pt + theme-color("header_stroke"), radius: 6pt, inset: 13pt, width: 100%)[
  #grid(
    columns: (1fr, auto),
    [#text(size: 20pt, weight: "bold", fill: theme-color("header_text"))[#payload.label 📈 玩家活动]],
    [#text(size: 10pt, weight: "bold", fill: theme-color("header_text"))[#payload.date_display]],
  )
]
#v(9pt)
#grid(columns: (1fr, 1fr, 1fr), gutter: 7pt, row-gutter: 7pt, ..stat-cards)
#v(9pt)
#block(fill: theme-color("panel_fill"), stroke: 1pt + theme-color("panel_stroke"), radius: 4pt, inset: 9pt, width: 100%)[
  #text(size: 11pt, weight: "bold", fill: theme-color("section_title"))[在线人数与进入次数]
  #v(6pt)
  #if payload.chart_available {
    image(payload.chart_path, width: 100%)
  } else {
    block(height: 205pt, width: 100%)[
      #align(center + horizon)[
        #text(size: 11pt, fill: theme-color("stats_text"))[#payload.chart_message]
      ]
    ]
  }
]
#v(7pt)
#align(center)[
  #text(size: 8pt, fill: theme-color("stats_text"))[
    上海时区 · #payload.coverage_text · 每 5 分钟聚合显示 · #payload.generated_at 生成
  ]
]
