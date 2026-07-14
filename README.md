# АВ · Динамическое ценообразование

Демонстрационный веб-сервис системы динамического ценообразования для продуктовой
сети «Азбука Вкуса» — по ВКР («Разработка и обоснование внедрения системы динамического ценообразования в продуктовой сети на основе потребительского спроса»). Сервис показывает полный пользовательский маршрут
категорийного аналитика: вход → выбор категории → выбор артикулов и даты →
расчёт → экран рекомендаций с графиками, обоснованием и утверждением.

Данные — системные ( ~130 дней истории продаж по
65 SKU и 5 магазинам). ML-модуль:
**расчёт рекомендованной цены выполняется настоящим алгоритмом из ВКР** —
ценовой коридор из минимальной маржи и шага изменения (±7% / −12%), правило
уценки скоропортящихся товаров, промоблокировка, округления до 90 ₽, перевод
в ручную проверку при MAPE > 20%.

## Стек (по таблице 3.4 ВКР)

| Компонент | Технология |
|---|---|
| API | Python 3.11, FastAPI, Pydantic, SQLAlchemy |
| Хранилище | PostgreSQL 16 |
| Кэш рекомендаций | Redis 7 |
| Интерфейс | React 18 + TypeScript, Vite, Tailwind CSS, Recharts |
| Развёртывание | Docker Compose (db, redis, api, frontend/nginx) |

## Запуск

```bash
docker compose up -d --build
```

Приложение: **http://localhost:8080**
Swagger (OpenAPI): http://localhost:8080/api/docs — проксируется c бэкенда FastAPI.

Данные вытягиваются автоматически при первом запуске (~10 секунд).

### Демо-доступ

| Логин | Пароль | Роль |
|---|---|---|
| `analyst` | `azbuka2026` | Категорийный аналитик |
| `manager` | `azbuka2026` | Руководитель категории |
| `admin` | `azbuka2026` | Администратор |

## Экраны

1. **Вход** — JWT-авторизация.
2. **Рабочий стол** — KPI и категории с сигналами: сколько SKU требуют
   пересмотра, риск списаний, MAPE по категории.
3. **Выбор артикулов** — магазин, целевая дата, фильтры (риск списаний, промо,
   ручная проверка), тренд спроса и запас в днях по каждой позиции.
4. **Расчёт** — этапы пайплайна: загрузка данных → признаки → прогноз
   (CatBoost) → ценовая политика.
5. **Рекомендации** — список с новой ценой и причиной + карточка SKU: продажи
   за 8 недель с прогнозом и промо-днями, ценовой коридор, факторы решения,
   ожидаемый эффект (выручка/маржа), сработавшие ограничения, статусная модель
   draft → review_required → approved/rejected, отклонение с причиной из
   справочника. Все решения пишутся в журнал `approval_log`.

## Локальная разработка

```bash
# зависимости: db+redis из compose
docker compose up -d db redis

# бэкенд (Python 3.11)
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql+psycopg2://pricing:pricing@localhost:5432/pricing \
  uvicorn app.main:app --reload

# фронтенд (dev-сервер проксирует /api на :8000)
cd frontend
npm install
npm run dev
```

Тесты ценового модуля (по 3.11):

```bash
docker run --rm ilya-api python -m pytest tests/ -q
```

## CI/CD

Ручной деплой выполняет GitHub Action `Deploy`: он не собирает образы, а только
загружает на сервер `docker-compose.prod.yml` и `Caddyfile`, затем запускает
`docker compose pull && docker compose up -d` для образов с тегом `latest`.
Продакшен доступен по адресу https://v3180765.hosted-by-vdsina.ru, TLS-сертификат
автоматически выпускает и продлевает Caddy через Let's Encrypt.

Нужные GitHub Secrets:

| Secret | Значение |
|---|---|
| `SERVER_HOST` | IP или домен сервера |
| `SERVER_USER` | SSH-пользователь |
| `SERVER_PASSWORD` | SSH-пароль |
| `DOMAIN` | Домен продакшена, по умолчанию `v3180765.hosted-by-vdsina.ru` |
| `GHCR_TOKEN` | PAT с `read:packages`, если GHCR-образы приватные |
| `GHCR_USERNAME` | GitHub-пользователь для `GHCR_TOKEN` |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL, опционально |
| `JWT_SECRET` | Секрет JWT, опционально |

Если `POSTGRES_PASSWORD` или `JWT_SECRET` не заданы, workflow сгенерирует их на
сервере при первом деплое и сохранит в `/opt/azbuka-vkusa/.env`.

Перед деплоем нужно вручную собрать и запушить все образы:

```bash
docker login ghcr.io
REGISTRY=ghcr.io/ilyarychkov/azbuka-vkusa TAG=latest ./scripts/build-and-push.sh
```

Production compose-файл лежит в корне: `docker-compose.prod.yml`, reverse proxy
настраивается через `Caddyfile`.

Первично подготовить новый Ubuntu/Debian сервер и сразу поднять решение можно
скриптом:

```bash
SERVER_HOST=91.184.244.200 \
SERVER_USER=root \
SERVER_PASSWORD='ssh-password' \
DOMAIN=v3180765.hosted-by-vdsina.ru \
GHCR_USERNAME=github-user \
GHCR_TOKEN='github-token-with-read-packages' \
./scripts/bootstrap-server.sh
```

Если подключение идёт по SSH-ключу, `SERVER_PASSWORD` можно не задавать. Для
password-based SSH локально должен быть установлен `sshpass`.

## Структура

```
backend/
  app/            # FastAPI: роутеры, ценовая логика (pricing.py), мок-прогноз (analytics.py)
  seed/           # детерминированный генератор демо-данных (catalog.py + generate.py)
  tests/          # тесты ценового коридора, округления, промоблокировки
frontend/
  src/pages/      # 5 экранов: Login, Dashboard, Category, Calculation, Results
  src/components/ # график спроса, ценовой коридор, факторы, статусы
docker-compose.yml
docker-compose.prod.yml
Caddyfile
scripts/bootstrap-server.sh
```
