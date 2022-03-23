# twitch-informer-bot

*Проект выполнен в рамках самостоятельного обучения Node.js, TypeScript и MongoDB.*

Приложение позволяет пользователям отслеживать интересующие их события посредствам получения сообщений. Например, реализовано получение сообщений в Telegram или Discord о начале определенного стрима или смене категории на стриме на Twitch.

## config
Конфигурация позволяет изменить перечень поддерживаемых для отслеживания событий и способов взаимодействия с пользователем.

| Свойство | Описание |
| --- | --- |
| ``` observers ``` | Массив конфигураций наблюдателей за событиями: <ul><li>```type```: конструктор наблюдателя за событиями. Наблюдатель отслеживает возникновение событий и обеспечивает вызов зарегистрированных обработчиков.</li><li>```subscriptions```: массив конструкторов отслеживаемых данным наблюдателем подписок на события.</li></ul> |
| ``` bots ``` | Массив конструкторов ботов. Боты обеспечивают обработку команд пользователя, а также отправку сообщений и уведомлений пользователю. |
| ``` commands ``` | Массив конструкторов команд. Команды - способ взаимодействия пользователя с приложением. |
| ``` commandRule ```<br>*(необязательно)* | Реализует интерпретацию аргументов в получаемых командах. |

