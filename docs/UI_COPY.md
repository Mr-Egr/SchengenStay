# Post-release interface copy audit

Exact active EN/RU changes relative to v1.0.0. Layout, CSS, illustrations,
components and calculation contracts are unchanged. Developer terminology stays
in README and technical documentation. Legacy overridden text was aligned too.

## EN

| Key | Before | After |
| --- | --- | --- |
| app.preview | Python powered | 90/180 Calculator |
| state.unavailable.title | Start a Python calculation | Start a calculation |
| state.unavailable.body | Confirm the context and run a check. The first run downloads the pinned Python runtime; internet access is needed until its assets are cached. | Confirm the context and run a check. The first run downloads the calculator; internet access is needed until its files are cached. |
| state.error.body | No result is available. Check your connection, allow runtime downloads from jsDelivr, and retry. Your records are unchanged. | No result is available. Check your connection, allow calculator downloads from jsDelivr, and retry. Your records are unchanged. |
| state.loading.body | Python is loading or checking your dates in a background worker. You can continue editing or cancel. | The calculator is loading or checking your dates on this device. You can continue editing or cancel. |
| settings.privacyBody | Nothing is saved without your choice. Opting in stores history (including labels and notes), language and appearance in this browser. Anyone using this browser profile may see it. Clearing browser data may erase it. Scenarios, results and confirmations stay in memory. Never enter identity documents or secrets. | Nothing is saved without your choice. Opting in stores history (including labels and notes), language and appearance in this browser. Anyone using this browser profile may see it. Clearing browser data may erase it. Scenarios, results and confirmations stay in memory. Never enter identity documents or secrets. Website analytics is off. If activated, aggregate traffic statistics would be separate from your locally processed travel data. |
| settings.laterBody | Pure Python runs locally in your browser. Initial runtime loading needs internet. No accounts, cloud storage, import/export or visa assessment. | Calculations run on your device. Initial loading needs internet. No accounts, cloud storage, import/export or visa assessment. |
| run.retry | Retry Python loading | Retry loading |
| runtime.idle | Python starts on your first check | The calculator starts on your first check |
| runtime.loading | Loading Python… | Loading calculator… |
| runtime.ready | Python ready | Calculator ready |
| runtime.error | Python unavailable | Calculator unavailable |
| runtimeError.LOAD_FAILED | Python could not load. Check internet access and retry. | The calculator could not load. Check internet access and retry. |
| runtimeError.LOAD_TIMEOUT | Python loading timed out. Retry on a stable connection. | Calculator loading timed out. Retry on a stable connection. |
| runtimeError.REQUEST_TIMEOUT | The worker exceeded the time limit and was stopped. Narrow the request and retry. | The calculation exceeded the time limit and was stopped. Narrow the request and retry. |
| runtimeError.CALCULATION_FAILED | Python could not complete this request. No result is asserted. | The calculator could not complete this request. No result is asserted. |
| runtimeError.PROTOCOL_ERROR | The runtime returned an incompatible response. Reload the application. | The calculator returned an incompatible response. Reload the application. |

## RU

| Key | Before | After |
| --- | --- | --- |
| app.preview | Расчёты на Python | Расчёт 90/180 |
| state.unavailable.title | Запустите расчёт на Python | Запустите расчёт |
| state.unavailable.body | Подтвердите исходные данные и запустите проверку. При первом запуске загружается среда Python; до кеширования её файлов нужен интернет. | Подтвердите исходные данные и запустите проверку. При первом запуске загружается калькулятор; до кеширования его файлов нужен интернет. |
| state.error.body | Результат недоступен. Проверьте соединение, разрешите загрузку среды с jsDelivr и повторите попытку. Записи не изменены. | Результат недоступен. Проверьте соединение, разрешите загрузку калькулятора с jsDelivr и повторите попытку. Записи не изменены. |
| state.loading.body | Python загружается или проверяет даты в фоновом потоке. Можно продолжать редактирование или отменить расчёт. | Калькулятор загружается или проверяет даты на вашем устройстве. Можно продолжать редактирование или отменить расчёт. |
| settings.privacyBody | Без вашего выбора ничего не сохраняется. При согласии история (включая названия и заметки), язык и тема сохраняются в этом браузере. Они доступны другим пользователям профиля браузера и могут исчезнуть при очистке данных. Сценарии, результаты и подтверждения остаются в памяти. Не вводите документы и секретные данные. | Без вашего выбора ничего не сохраняется. При согласии история (включая названия и заметки), язык и тема сохраняются в этом браузере. Они доступны другим пользователям профиля браузера и могут исчезнуть при очистке данных. Сценарии, результаты и подтверждения остаются в памяти. Не вводите документы и секретные данные. Аналитика сайта отключена. При её включении общая статистика посещений будет отделена от данных поездок, обрабатываемых на вашем устройстве. |
| settings.laterBody | Python работает локально в браузере. Для первой загрузки нужен интернет. Нет аккаунтов, облачного хранения, импорта/экспорта и проверки виз. | Расчёты выполняются на вашем устройстве. Для первой загрузки нужен интернет. Нет аккаунтов, облачного хранения, импорта/экспорта и проверки виз. |
| run.retry | Повторить загрузку Python | Повторить загрузку |
| runtime.idle | Python запустится при первой проверке | Калькулятор запустится при первой проверке |
| runtime.loading | Загрузка Python… | Загрузка калькулятора… |
| runtime.ready | Python готов | Калькулятор готов |
| runtime.error | Python недоступен | Калькулятор недоступен |
| runtimeError.LOAD_FAILED | Не удалось загрузить Python. Проверьте интернет и повторите попытку. | Не удалось загрузить калькулятор. Проверьте интернет и повторите попытку. |
| runtimeError.LOAD_TIMEOUT | Время загрузки Python истекло. Повторите при стабильном соединении. | Время загрузки калькулятора истекло. Повторите при стабильном соединении. |
| runtimeError.REQUEST_TIMEOUT | Поток превысил лимит времени и остановлен. Сузьте запрос и повторите. | Расчёт превысил лимит времени и остановлен. Сузьте запрос и повторите. |
| runtimeError.CALCULATION_FAILED | Python не смог выполнить запрос. Результат не установлен. | Калькулятор не смог выполнить запрос. Результат не установлен. |
| runtimeError.PROTOCOL_ERROR | Среда вернула несовместимый ответ. Перезагрузите приложение. | Калькулятор вернул несовместимый ответ. Перезагрузите приложение. |

## Initial HTML and startup fallback (English)

- Meta description: "with Python running on your device" → "with calculations running on your device".
- No-script explanation: "Python calculations run locally in a background worker." → "Calculations run on your device."
- Startup failure: stale local-server/preview instructions → "Check your connection and reload. Your travel records have not been sent anywhere."
