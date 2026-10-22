export const contextMessages = { en: {}, ru: {} };
const copy = {
  'legal.title': ['Scope and visa context', 'Область расчёта и визовые обстоятельства'],
  'legal.question': ['Do any of these circumstances affect the request? (optional)', 'Есть ли такие обстоятельства? (необязательно)'],
  'legal.ARITHMETIC_ONLY': ['Standard short stays — arithmetic only', 'Обычные краткосрочные пребывания — только подсчёт дней'],
  'legal.UNKNOWN': ['I am unsure which stays count', 'Я не уверен(а), какие пребывания учитывать'],
  'legal.SHORT_STAY_VISA': ['I need a C-visa conditions assessment', 'Мне нужна проверка условий визы C'],
  'legal.LONG_STAY_VISA': ['Long-stay visa (D) affects my dates', 'На даты влияет долгосрочная виза D'],
  'legal.RESIDENCE_PERMIT': ['Residence permit affects my dates', 'На даты влияет ВНЖ'],
  'legal.PENDING_APPLICATION': ['Pending application, receipt or stamp', 'Заявление на рассмотрении, справка или штамп'],
  'legal.NATIONAL_EXTENSION': ['National extension or other national permission', 'Национальное продление или разрешение'],
  'legal.BILATERAL_ARRANGEMENT': ['Bilateral arrangement or special exemption', 'Двустороннее соглашение или особое исключение'],
  'legal.MIXED_HISTORY': ['Mixed short-stay and other legal grounds', 'Смешанная история с разными основаниями'],
  'legal.OTHER': ['Another special legal situation', 'Другие особые правовые обстоятельства'],
  'legal.hint': ['Arithmetic-only mode covers confirmed countable short stays, including visa-free or C-visa travel. It cannot establish visa compliance: a visa may grant fewer than 90 days. Select uncertain or special context if it affects which dates count.', 'Режим арифметики подходит для подтверждённых учитываемых краткосрочных дней, в том числе безвизовых поездок и визы C. Он не проверяет соблюдение визовых условий: виза может разрешать менее 90 дней. Если учёт дат неясен или зависит от особых оснований, выберите их.'],
  'legal.datesEnabled': ['Check the order of two visa dates (optional)', 'Проверить порядок двух визовых дат (необязательно)'],
  'legal.datesHint': ['Only date format and chronological order are checked. This does not validate a visa, match trips to it, count used entries or authorised days, or grant travel permission. These details stay in memory and are not saved.', 'Проверяются только формат и порядок дат. Это не проверка визы, соответствия поездок, использованных въездов или разрешённых дней и не разрешение на поездку. Эти сведения остаются в памяти и не сохраняются.'],
  'legal.valid_from': ['Visa “from” date', 'Виза: «действует с»'],
  'legal.valid_until': ['Visa “until” date', 'Виза: «действует до»'],
  'legal.resultTitle': ['Scope review — not travel authorisation', 'Область проверки — не разрешение на поездку'],
  'legal.dateCheckTitle': ['Visa date-entry consistency only', 'Только согласованность введённых визовых дат'],
  'legal.guideTitle': ['Which days belong in this calculator?', 'Какие дни подходят для этого калькулятора?'],
  'legal.guideBody': ['Supply only already-identified countable short stays and confirm complete history. Do not automatically exclude all travel because you hold a permit or D visa. Mixed or uncertain periods need review by the relevant authority. Visa validity dates, duration, entry limits and territories are separate requirements; this app does not assess them. A pending application, receipt or stamp is not interpreted here as permission to stay or re-enter.', 'Вносите только уже определённые учитываемые краткосрочные пребывания и подтверждайте полноту истории. Не исключайте автоматически все поездки из-за ВНЖ или визы D. Смешанные и неясные периоды нужно уточнять у компетентного органа. Срок визы, разрешённые дни, число въездов и территория — отдельные условия; приложение их не оценивает. Заявление, справка или штамп здесь не трактуются как право пребывания или повторного въезда.'],
  'legal.stickerSource': ['Official explanation of visa sticker fields', 'Официальное объяснение полей визовой наклейки'],
  'legal.reconfirm': ['History changed. Confirm completeness and which days count again before calculating.', 'История изменена. Перед расчётом снова подтвердите её полноту и учитываемые дни.'],
};
const reasons = {
  ARITHMETIC_ONLY: ['Only the declared standard 90/180 arithmetic was requested. Visa and residence rights were not assessed.', 'Запрошена только арифметика общего правила 90/180. Визовые и резидентские права не оценивались.'],
  LEGAL_CONTEXT_UNKNOWN: ['Countability is uncertain. Clarify which periods are standard countable short stays before calculating.', 'Учёт дней неясен. До расчёта уточните, какие периоды являются учитываемыми краткосрочными пребываниями.'],
  VISA_CONDITIONS_NOT_ASSESSED: ['C-visa conditions are outside this calculation. Validity dates, authorised duration, entries and territory must be checked separately; a 90/180 result cannot settle them.', 'Условия визы C вне области расчёта. Срок действия, разрешённые дни, въезды и территорию нужно проверять отдельно; результата 90/180 недостаточно.'],
  LONG_STAY_CONTEXT: ['D-visa periods need legal and territorial classification. No days have been automatically counted or excluded.', 'Периоды по визе D требуют правовой и территориальной оценки. Дни не учитывались и не исключались автоматически.'],
  RESIDENCE_CONTEXT: ['Residence-permit periods need legal and territorial classification. Holding a permit does not tell this calculator which travel days to omit.', 'Периоды по ВНЖ требуют правовой и территориальной оценки. Наличие ВНЖ не определяет для калькулятора, какие дни поездок исключать.'],
  PENDING_CONTEXT: ['The effect of a pending application, receipt or stamp is not assessed. Ask the relevant authority about stay and re-entry rights.', 'Последствия подачи заявления, справки или штампа не оцениваются. Уточните право пребывания и повторного въезда у компетентного органа.'],
  EXTENSION_CONTEXT: ['National extensions and national permissions are not modelled. No extra days or entry rights are inferred.', 'Национальные продления и разрешения не моделируются. Дополнительные дни и права въезда не предполагаются.'],
  BILATERAL_CONTEXT: ['Bilateral arrangements and special exemptions are not modelled. The ordinary day count cannot resolve this request.', 'Двусторонние соглашения и особые исключения не моделируются. Обычный подсчёт дней не решает такой запрос.'],
  MIXED_CONTEXT: ['Mixed legal grounds cannot be classified reliably here. No portion of the history has been silently omitted or treated as exempt.', 'Смешанные правовые основания здесь нельзя надёжно классифицировать. Никакая часть истории не исключалась и не считалась освобождённой автоматически.'],
  OTHER_CONTEXT: ['This special legal situation needs review outside the calculator. No travel permission is determined.', 'Особая правовая ситуация требует проверки вне калькулятора. Право на поездку не определяется.'],
  INVALID_LEGAL_CONTEXT: ['Correct inconsistent context details or unsupported input fields before continuing.', 'Исправьте противоречивые сведения или неподдерживаемые поля перед продолжением.'],
  VISA_DATES_INCOMPLETE: ['Both visa dates are needed to check their order; a missing date is not an unlimited validity period.', 'Для проверки порядка нужны обе даты визы; отсутствие даты не означает неограниченный срок действия.'],
  VISA_DATE_ORDER_ONLY: ['The supplied dates are real calendar dates in chronological order. Nothing about visa validity or travel permission has been established.', 'Введены существующие даты в хронологическом порядке. Действительность визы и право на поездку не установлены.'],
};
for (const [key, values] of Object.entries(copy)) {
  contextMessages.en[key] = values[0]; contextMessages.ru[key] = values[1];
}
for (const [key, values] of Object.entries(reasons)) {
  contextMessages.en[`reason.${key}`] = values[0]; contextMessages.ru[`reason.${key}`] = values[1];
}
for (const [kind, code] of Object.entries({ UNKNOWN: 'LEGAL_CONTEXT_UNKNOWN', SHORT_STAY_VISA: 'VISA_CONDITIONS_NOT_ASSESSED', LONG_STAY_VISA: 'LONG_STAY_CONTEXT', RESIDENCE_PERMIT: 'RESIDENCE_CONTEXT', PENDING_APPLICATION: 'PENDING_CONTEXT', NATIONAL_EXTENSION: 'EXTENSION_CONTEXT', BILATERAL_ARRANGEMENT: 'BILATERAL_CONTEXT', MIXED_HISTORY: 'MIXED_CONTEXT', OTHER: 'OTHER_CONTEXT' })) {
  contextMessages.en[`legal.note.${kind}`] = reasons[code][0]; contextMessages.ru[`legal.note.${kind}`] = reasons[code][1];
}
