# Nginx Setup — OnBase HR

Настройка двух серверов: **фронт (SPA)** и **бэк (API)**, плюс безопасная раздача файлов из `server/uploads/`.

---

## 1. Топология

```
                       ┌──────────────────────────────┐
   браузер  ──443──▶   │  SRV-1  nginx (frontend)     │
   *.onbase.uz         │  - отдаёт client/dist        │
                       │  - proxy /api → SRV-2        │
                       │  - internal-локации файлов   │
                       └───────────┬──────────────────┘
                                   │ 443 (внутр. сеть / VPN)
                       ┌───────────▼──────────────────┐
                       │  SRV-2  nginx (backend)      │
                       │  - proxy → node :7000        │
                       │  - X-Accel-Redirect файлов   │
                       │  - uploads/ на диске         │
                       └──────────────────────────────┘
```

Ключевые факты проекта:

| Факт | Значение |
| --- | --- |
| Node слушает | `0.0.0.0:7000` (`server/config.js`) |
| Фронт-билд | `client/dist` (Vite) |
| Мультитенантность | по поддомену (`req.tenant.subdomain`) |
| Админка | поддомен `admin`, отдаёт сам Node из `admin/dist` (`server/app.js:36`) |
| API base URL клиента | `/api` + `withCredentials: true` (`client/src/api/instance.js`) |
| Файлы | `server/uploads/{employees,face-passes,vehicle-passes}/<tenant>/...` |

**Важно про cookie.** Клиент ходит на относительный `/api` с `withCredentials`. Значит фронт-nginx обязан проксировать `/api` на бэк — тогда cookie остаются first-party, CORS не нужен, `SameSite=Strict/Lax` работает. Отдельный домен `api.onbase.uz` = третьесторонние cookie = блокировки в Safari/Chrome. Не делай так без нужды.

---

## 2. Общая база

### 2.1 `/etc/nginx/nginx.conf` (главное)

```nginx
user  www-data;
worker_processes  auto;
worker_rlimit_nofile 65535;

events {
    worker_connections  4096;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # ── скрыть версию ──────────────────────────────
    server_tokens off;

    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    types_hash_max_size 4096;

    client_max_body_size 10m;      # multer лимит 5MB, запас x2
    client_body_timeout  30s;
    client_header_timeout 15s;
    send_timeout 30s;
    large_client_header_buffers 4 16k;

    # ── лог ────────────────────────────────────────
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" rt=$request_time urt="$upstream_response_time"';
    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    # ── gzip ───────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json
               application/javascript application/xml+rss
               image/svg+xml font/woff2;

    # ── rate limit зоны ────────────────────────────
    limit_req_zone $binary_remote_addr zone=api:10m   rate=30r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=files:10m rate=60r/s;
    limit_conn_zone $binary_remote_addr zone=perip:10m;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

### 2.2 `/etc/nginx/snippets/ssl.conf`

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;

ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;

ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;
```

### 2.3 `/etc/nginx/snippets/security-headers.conf`

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options    "nosniff" always;
add_header X-Frame-Options           "SAMEORIGIN" always;
add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
add_header Permissions-Policy        "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
```

> `add_header` **не наследуется**, если в дочернем `location` есть свой `add_header`. В каждой такой локации подключай сниппет заново.

### 2.4 `/etc/nginx/snippets/proxy.conf`

```nginx
proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header Upgrade           $http_upgrade;
proxy_set_header Connection        $connection_upgrade;

proxy_connect_timeout 10s;
proxy_send_timeout    60s;
proxy_read_timeout    60s;

proxy_buffering on;
proxy_buffers 16 16k;
proxy_busy_buffers_size 32k;

# не даём апстриму перетереть наши заголовки безопасности
proxy_hide_header X-Powered-By;
```

И в `http {}` добавь map для WebSocket:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

---

## 3. SRV-1 — фронтенд

`/etc/nginx/sites-available/onbase-front.conf`

```nginx
# ── HTTP → HTTPS ───────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name onbase.uz *.onbase.uz;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

# ── дефолтный сервер: рубим запросы по IP / чужим Host ──
server {
    listen 443 ssl default_server;
    http2 on;
    server_name _;
    ssl_certificate     /etc/letsencrypt/live/onbase.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/onbase.uz/privkey.pem;
    include snippets/ssl.conf;
    return 444;
}

# ── основной SPA ───────────────────────────────────
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name onbase.uz *.onbase.uz;   # мультитенант по поддомену

    # wildcard-сертификат (DNS-01 challenge обязателен)
    ssl_certificate     /etc/letsencrypt/live/onbase.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/onbase.uz/privkey.pem;
    include snippets/ssl.conf;
    include snippets/security-headers.conf;

    root /var/www/onbase/client/dist;
    index index.html;

    limit_conn perip 50;

    # ── статика с хэшем в имени: кэш навсегда ──────
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri =404;
    }

    location ~* \.(?:woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$ {
        expires 30d;
        add_header Cache-Control "public";
        access_log off;
        try_files $uri =404;
    }

    # ── index.html не кэшируем: иначе юзер сидит на старом билде ──
    location = /index.html {
        include snippets/security-headers.conf;
        add_header Cache-Control "no-store, must-revalidate";
    }

    # ── API → бэкенд ───────────────────────────────
    location /api/ {
        limit_req zone=api burst=60 nodelay;
        include snippets/proxy.conf;
        proxy_pass https://srv2.internal:8443;
    }

    # ── логин: жёсткий лимит от брутфорса ──────────
    location = /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        include snippets/proxy.conf;
        proxy_pass https://srv2.internal:8443;
    }

    # ── файлы (см. раздел 5) ───────────────────────
    location ~ ^/api/(employees/image|face-passes/image|vehicle-passes/image) {
        limit_req zone=files burst=120 nodelay;
        include snippets/proxy.conf;
        proxy_pass https://srv2.internal:8443;
    }

    # ── SPA fallback ───────────────────────────────
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── мусор наружу не отдаём ─────────────────────
    location ~ /\.(?!well-known) { deny all; }
    location ~* \.(env|log|sql|bak|old|conf|yml|yaml)$ { deny all; }
    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }
}
```

**Про `admin.onbase.uz`.** Админку отдаёт сам Node (`server/app.js`). Для этого поддомена весь трафик уходит на бэк:

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name admin.onbase.uz;

    ssl_certificate     /etc/letsencrypt/live/onbase.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/onbase.uz/privkey.pem;
    include snippets/ssl.conf;
    include snippets/security-headers.conf;

    location / {
        include snippets/proxy.conf;
        proxy_pass https://srv2.internal:8443;
    }
}
```

---

## 4. SRV-2 — бэкенд

`/etc/nginx/sites-available/onbase-api.conf`

```nginx
upstream onbase_node {
    server 127.0.0.1:7000 max_fails=3 fail_timeout=15s;
    keepalive 64;
    keepalive_timeout 60s;
}

server {
    listen 8443 ssl;
    http2 on;
    server_name srv2.internal;

    # ── внутренний TLS (self-signed / внутренний CA) ──
    ssl_certificate     /etc/nginx/certs/srv2.internal.crt;
    ssl_certificate_key /etc/nginx/certs/srv2.internal.key;
    include snippets/ssl.conf;

    # ── пускаем только фронт-сервер ────────────────
    allow 10.0.0.11;      # IP SRV-1
    allow 127.0.0.1;
    deny  all;

    # опционально: mTLS вместо allow/deny
    # ssl_client_certificate /etc/nginx/certs/internal-ca.crt;
    # ssl_verify_client on;

    access_log /var/log/nginx/onbase-api.access.log main;
    error_log  /var/log/nginx/onbase-api.error.log warn;

    client_max_body_size 10m;

    # ── API ────────────────────────────────────────
    location /api/ {
        include snippets/proxy.conf;
        proxy_set_header Connection "";       # keepalive к апстриму
        proxy_pass http://onbase_node;
    }

    # ── SSE / долгие отчёты: буферизацию выключить ──
    location /api/attendance/export {
        include snippets/proxy.conf;
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_pass http://onbase_node;
    }

    # ── internal-локации файлов (раздел 5) ─────────
    include /etc/nginx/snippets/onbase-internal-files.conf;

    location / { return 404; }
}
```

`proxy_set_header Connection ""` обязателен при `keepalive` в upstream — иначе `proxy.conf` протолкнёт `Connection: upgrade` и keepalive не работает.

---

## 5. Безопасная раздача файлов

### 5.1 Принцип

`uploads/` содержит **фото сотрудников и проходов** — персональные данные. Прямой `location /uploads/ { alias ...; }` = любой в интернете по угаданному пути качает фото чужого тенанта. Так делать нельзя.

Схема правильная — **X-Accel-Redirect**:

```
1. GET /api/employees/image/artsoft/3175.jpg
2. Node: проверяет JWT + права + принадлежность тенанту
3. Node: 200 + header X-Accel-Redirect: /internal/employees/artsoft/3175.jpg  (тело пустое)
4. Nginx: перехватывает, сам читает файл с диска (sendfile), отдаёт клиенту
```

Плюсы: авторизация в Node, отдача байтов в nginx (Node не блокируется), путь на диске наружу не течёт.

Проект уже это делает:

| Файл | Заголовок |
| --- | --- |
| `server/modules/employees/employees.controller.js:247` | `/internal/employees/${safeName}` |
| `server/modules/facePasses/facePasses.controller.js:181` | `/internal/face-passes/${safeName}` |
| `server/modules/vehiclePasses/vehiclePasses.controller.js:101` | `/internal/vehicle-passes/${safeName}` |

Осталось описать эти локации в nginx.

### 5.2 `/etc/nginx/snippets/onbase-internal-files.conf`

```nginx
# ═══ ВНУТРЕННИЕ ЛОКАЦИИ ══════════════════════════
# internal — доступны ТОЛЬКО через X-Accel-Redirect от апстрима.
# Прямой запрос /internal/... снаружи → 404.

location /internal/employees/ {
    internal;
    alias /var/www/onbase/server/uploads/employees/;

    # приватный кэш — прокси и CDN не должны кэшировать ПДн
    add_header Cache-Control "private, max-age=86400, no-transform" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'none'; sandbox" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    # MIME фиксируем, sniffing запрещаем
    types { }
    default_type image/jpeg;

    sendfile on;
    tcp_nopush on;
    aio threads;
}

location /internal/face-passes/ {
    internal;
    alias /var/www/onbase/server/uploads/face-passes/;
    add_header Cache-Control "private, max-age=86400, no-transform" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'none'; sandbox" always;
    types { }
    default_type image/jpeg;
    sendfile on;
}

location /internal/vehicle-passes/ {
    internal;
    alias /var/www/onbase/server/uploads/vehicle-passes/;
    add_header Cache-Control "private, max-age=86400, no-transform" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'none'; sandbox" always;
    types { }
    default_type image/jpeg;
    sendfile on;
}

# ═══ ГЛУХАЯ ЗАЩИТА ═══════════════════════════════
# на случай, если кто-то когда-нибудь добавит root на uploads
location /uploads/ { deny all; return 404; }

# ничего исполняемого из папки загрузок
location ~* ^/internal/.*\.(php|phtml|py|pl|sh|cgi|js|mjs|html?|svg)$ {
    deny all;
    return 404;
}
```

### 5.3 Подводные камни

**Слэш в `alias`.** `location /internal/employees/` и `alias .../employees/` — оба со слэшем. Уберёшь один — получишь склейку путей и потенциальный traversal.

**URL-кодирование.** Значение `X-Accel-Redirect` — это **URI**, nginx его декодирует. Если в имени файла пробел, `%`, `?` или кириллица — Node обязан кодировать:

```js
const encoded = safeName.split("/").map(encodeURIComponent).join("/");
res.setHeader("X-Accel-Redirect", `/internal/employees/${encoded}`);
```

Без этого `foo bar.jpg` превратится в 404, а `a%2f..%2f` — в дыру. Валидация `safeName` в контроллере (`employees.controller.js:230-237`) от traversal защищает, кодирование — обязательное дополнение, не замена.

**Заголовки от апстрима.** `Content-Type`, `Content-Disposition`, `Cache-Control` при X-Accel-Redirect берутся из ответа Node, если он их выставил. Хочешь скачивание вместо просмотра — ставь в Node:

```js
res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
```

**Не-картинки.** Если появятся PDF/XLSX/docs, отдавать их только как `attachment` + `default_type application/octet-stream`. Inline-рендер SVG/HTML из uploads = XSS на своём домене.

**Права на ФС.**

```bash
chown -R node:www-data /var/www/onbase/server/uploads
find /var/www/onbase/server/uploads -type d -exec chmod 750 {} \;
find /var/www/onbase/server/uploads -type f -exec chmod 640 {} \;
```

Node пишет, nginx читает, остальные — никак. Бит `x` на файлах не нужен никогда.

### 5.4 Временные ссылки (`getImageTempLink`)

Эндпоинт `/api/employees/photo/:token` (`employees.routes.js:21`) отдаёт файл по одноразовому токену на 300 сек — используется для Telegram-бота, где cookie нет. Он идёт через `res.sendFile` мимо nginx. Для продакшена переведи и его на X-Accel-Redirect, плюс закрой лимитом:

```nginx
location ~ ^/api/employees/photo/ {
    limit_req zone=files burst=20 nodelay;
    include snippets/proxy.conf;
    proxy_pass http://onbase_node;
}
```

### 5.5 Альтернатива: `secure_link` (без Node в цепочке)

Если нужно отдавать файл вообще без обращения к Node (например, картинки для Telegram-бота):

```nginx
location /files/ {
    secure_link $arg_md5,$arg_expires;
    secure_link_md5 "$secure_link_expires$uri$remote_addr SECRET_FROM_ENV";

    if ($secure_link = "")  { return 403; }   # подпись битая
    if ($secure_link = "0") { return 410; }   # срок истёк

    alias /var/www/onbase/server/uploads/;
    add_header Cache-Control "private, no-store" always;
}
```

Node генерит подпись:

```js
import crypto from "crypto";
const expires = Math.floor(Date.now() / 1000) + 300;
const raw = `${expires}/files/${relPath}${clientIp} ${process.env.SECURE_LINK_SECRET}`;
const md5 = crypto.createHash("md5").update(raw).digest("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
const url = `/files/${relPath}?md5=${md5}&expires=${expires}`;
```

Требует модуль `--with-http_secure_link_module` (есть в `nginx-full` / `nginx-extras` на Debian).

Выбор: **X-Accel-Redirect** — когда права зависят от роли/тенанта (основной случай проекта). **secure_link** — когда нужна ссылка для внешнего клиента без сессии.

---

## 6. Что делать нельзя

| Анти-паттерн | Почему плохо |
| --- | --- |
| `location /uploads/ { alias /.../uploads/; }` | все фото ПДн в открытом доступе |
| `autoindex on` на любой локации с данными | листинг директорий = карта всех файлов и тенантов |
| `alias` без замыкающего слэша | склейка путей, обход директории |
| `proxy_pass` на Node напрямую с 0.0.0.0:7000 наружу | Node без rate limit, без TLS-терминации, DoS одной slowloris |
| `if` внутри `location` для роутинга | `if is evil` — непредсказуемое поведение; используй `try_files`/`map` |
| Кэш `public` на ответах с ПДн | промежуточный прокси/CDN сохранит чужое фото |
| Отдача SVG/HTML из uploads inline | stored XSS на основном домене → угон сессии |

---

## 7. Деплой

### 7.1 Сертификаты

Мультитенантность по поддоменам → нужен wildcard, а он выдаётся только через DNS-01:

```bash
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cf.ini \
  -d onbase.uz -d '*.onbase.uz'
```

Автопродление: `systemctl enable --now certbot.timer`, хук `--deploy-hook "systemctl reload nginx"`.

### 7.2 Firewall

```bash
# SRV-1
ufw allow 80,443/tcp
# SRV-2 — 8443 только с фронта, node вообще не наружу
ufw allow from 10.0.0.11 to any port 8443 proto tcp
ufw deny 7000
ufw enable
```

Плюс в `server/server.js` смени bind на `127.0.0.1`, если nginx на той же машине — тогда порт 7000 физически недоступен извне.

### 7.3 Проверка

```bash
nginx -t                                  # синтаксис
nginx -T | grep -A5 'internal'            # internal-локации на месте
systemctl reload nginx

# прямой доступ к internal должен быть 404
curl -I https://onbase.uz/internal/employees/artsoft/3175.jpg   # → 404

# без авторизации файл не отдаётся
curl -I https://onbase.uz/api/employees/image/artsoft/3175.jpg  # → 401

# с cookie — 200 + картинка
curl -I -b "accessToken=..." https://onbase.uz/api/employees/image/artsoft/3175.jpg
```

---

## 8. Чеклист перед продом

- [ ] `nginx -t` чистый, `server_tokens off`
- [ ] `default_server` возвращает 444 на чужой Host / голый IP
- [ ] Wildcard-сертификат покрывает `*.onbase.uz`, автопродление включено
- [ ] Порт 7000 закрыт фаерволом либо bind на 127.0.0.1
- [ ] SRV-2 принимает только IP SRV-1 (`allow`/`deny` или mTLS)
- [ ] `/uploads/` наружу → 404, нет `autoindex`
- [ ] Все три `/internal/*` локации помечены `internal`
- [ ] Node кодирует имя файла в `X-Accel-Redirect` (`encodeURIComponent`)
- [ ] `Cache-Control: private` на всех ответах с фото
- [ ] Права `750`/`640` на `uploads/`, владелец `node:www-data`
- [ ] Rate limit на `/api/auth/login` (зона `login`, 5r/m)
- [ ] `index.html` отдаётся с `no-store`, `/assets/` — с `immutable`
- [ ] Заголовки безопасности продублированы во всех `location` с собственным `add_header`
