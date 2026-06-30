# 🔌 Server Access & Connection Info — Mazaya

> **الهدف:** ملف واحد فيه كل بيانات الاتصال اللي محتاجها عشان تتعامل مع
> السيرفر وقاعدة البيانات الخاصة بـ Mazaya.
> مجرد ما تقرأه تعرف تتصل بكل حاجة.

---

## 1. 🖥️ Server (DigitalOcean Droplet)

| الحاجة | القيمة |
|---|---|
| **Provider** | DigitalOcean |
| **Droplet ID** | `580266631` |
| **Region** | `fra1` (Frankfurt) |
| **OS** | Ubuntu 24.04.4 LTS (Noble Numbat) |
| **Public IP** | `64.226.118.40` |
| **RAM** | ~2 GB |
| **Disk** | 48 GB (5.7 GB مستخدم) |
| **DNS Domain** | `mazaya.openappo.com` → `64.226.118.40` |

> ⚠️ **ملاحظة:** نفس الدروبلت بيشتغل عليه مشروع OpenGym كمان. الرام مشتركة!

### الاتصال بالسيرفر (SSH)

```bash
ssh root@64.226.118.40
```

- المستخدم: `root` (عندك صلاحية كاملة)
- مفتاح SSH المسجّل على السيرفر (في `~/.ssh/authorized_keys`):
  ```
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFvmWjlsEg/mtk0tNnYqYsTp+XD/K420FALdVbX+iYFH digitalocean
  ```
- الـ SSH key المحلي عندك (يفتح السيرفر): في `C:\Users\dell\.ssh\`

### الفايروول (UFW)

| المنفذ | الخدمة |
|---|---|
| 22 | OpenSSH |
| 80 / 443 | Nginx (HTTP/HTTPS) |
| 5432 | PostgreSQL (محلي فقط — `127.0.0.1`) |

---

## 2. 🗄️ Database (PostgreSQL)

| الحاجة | القيمة |
|---|---|
| **Type** | Docker container (`mazaya-postgres`) |
| **Container Name** | `mazaya-postgres` |
| **Host** | `localhost` (عبر `--network host`) |
| **Port** | `5432` |
| **Database Name** | `mazaya` |
| **User** | `mazaya` |
| **Password** | `Mazaya2024!SecureDb` |

### Connection String (للإنتاج)
```
postgresql://mazaya:Mazaya2024!SecureDb@localhost:5432/mazaya
```
> الكونتينر بيشتغل بـ `--network host` عشان يوصل PostgreSQL على localhost.

### الدخول لـ psql
```bash
# من جوّه الـ container
docker exec -it mazaya-postgres psql -U mazaya -d mazaya

# شوف الجداول
\dt

# شوف الـ schema
\dn
```

### ملفات الـ SQL
الـ schema والـ seed data موجودين في المشروع:
- `sql/create_schema.sql` — إنشاء الجداول (production)
- `sql/seed_data.sql` — بيانات ابتدائية

---

## 3. 🐳 Docker (التطبيق المشتغل)

| الحاجة | القيمة |
|---|---|
| **Service Name** | `furniture-xhl2yk` (Docker Swarm) |
| **Image** | `ghcr.io/momarzouk1998/mazaya.openappo:latest` |
| **Network** | `host` (يشارك network السيرفر) |
| **Port** | `3001` (محلّي) → Nginx بيعمل reverse proxy عليه |
| **Restart Policy** | Docker Swarm (`--restart-condition any`) |
| **PostgreSQL** | `mazaya-postgres` container (localhost:5432) |
| **Config** | `/opt/mazaya/.env` |

### أوامر إدارة الخدمة
```bash
# شوف حالة الـ service
docker service ps furniture-xhl2yk

# شوف الكونتينرات الشغّالة
docker ps --filter name=furniture-xhl2yk

# شوف اللوجز (حدّد الـ container ID الأول)
docker service logs furniture-xhl2yk --tail 50

# ريستارت الخدمة (يسحب أحدث إيميج)
docker service update --force furniture-xhl2yk

# شوف استهلاك الرام/CPU
ID=$(docker ps --filter name=furniture-xhl2yk -q | head -1)
docker stats "$ID" --no-stream
```

### متغيرات البيئة
```
DATABASE_URL=postgresql://mazaya:Mazaya2024!SecureDb@localhost:5432/mazaya
NEXT_PUBLIC_APP_URL=https://mazaya.openappo.com
NEXT_PUBLIC_APP_NAME=مصنع مزايا للأثاث
AUTH_SECRET=mazaya-super-secret-key-2024
NODE_ENV=production
PORT=3001
HOSTNAME=0.0.0.0
```

---

## 4. 🚀 Deployment (CI/CD)

### طريقة النشر — أوتوماتيكية عبر GitHub Actions

```
git push origin main  →  GitHub Actions يبني  →  يرفع لـ GHCR  →  SSH للسيرفر  →  docker service update
```

الملف: `.github/workflows/build-and-push.yml`

### خطوات الـ Deploy (شوف `DEPLOY.md` للتفاصيل الكاملة)

```bash
# 1. من جهازك — ارفع الكود
cd "D:/OPEN APPS/DigitalOcian Projects/mazaya-system"
git add -A && git commit -m "feat: وصف التعديل" && git push origin main

# 2. استنى الـ CI/CD (2-3 دقايق) — يتم deploy أوتوماتيك

# 3. اتأكد
curl -s -o /dev/null -w "%{http_code}" https://mazaya.openappo.com/
```

---

## 5. 🐙 GitHub

| الحاجة | القيمة |
|---|---|
| **Account** | `momarzouk1998` |
| **Email** | `mo.marzouk1998@gmail.com` |
| **Repository** | `Mazaya.openappo` |
| **HTTPS URL** | `https://github.com/momarzouk1998/Mazaya.openappo.git` |
| **SSH URL** | `git@github.com-momarzouk:momarzouk1998/Mazaya.openappo.git` |
| **Default Branch** | `main` |

### إعداد SSH لـ GitHub (على جهازك المحلي)

في `C:\Users\dell\.ssh\config`:
```
Host github.com-momarzouk
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_momarzouk
```

---

## 6. 🌐 Nginx & SSL

| الحاجة | القيمة |
|---|---|
| **Nginx Site Config** | `/etc/nginx/sites-available/mazaya` |
| **Enabled** | `/etc/nginx/sites-enabled/mazaya` |
| **SSL** | Let's Encrypt (Certbot) — لازم يتعمل |
| **Domain** | `mazaya.openappo.com` |

### إعداد Nginx لمازايا (لو مش موجود)

```nginx
server {
    server_name mazaya.openappo.com;
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/mazaya.openappo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mazaya.openappo.com/privkey.pem;
}

server {
    if ($host = mazaya.openappo.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name mazaya.openappo.com;
    return 404;
}
```

### خطوات إعداد DNS + Nginx + SSL (لمرة وحدة)

1. **DNS:** في لوحة تحكم openappo.com، اعمل **A record** جديد:
   - Name: `mazaya`
   - Value: `64.226.118.40`

2. **Nginx config:**
   ```bash
   # انسخ الكونفيج
   nano /etc/nginx/sites-available/mazaya
   # (الصق الكونفيج اللي فوق)
   ln -s /etc/nginx/sites-available/mazaya /etc/nginx/sites-enabled/mazaya
   nginx -t && systemctl reload nginx
   ```

3. **SSL Certificate:**
   ```bash
   certbot --nginx -d mazaya.openappo.com
   ```

---

## 7. 🌍 DNS (openappo.com)

| النطاق الفرعي | IP | المشروع |
|---|---|---|
| `opengym.openappo.com` | `64.226.118.40` | OpenGym (GYM Management) |
| `mazaya.openappo.com` | `64.226.118.40` | Mazaya Furniture |
| `openappo.com` | `2.57.91.91` | سيرفر تاني (Hostinger) |

---

## 8. 🔐 Secrets & Credentials

| الحاجة | القيمة |
|---|---|
| **Database User** | `mazaya` |
| **Database Password** | `mazaya_pass_123` |
| **JWT Secret** | في `.env` على السيرفر (متغير `JWT_SECRET`) |
| **GitHub Secrets** | `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` |

> ⚠️ **أمان:** لو مش بيستخدم HTTPS بعد، غيّر الـ DB password فوراً واعمل SSL للـ PostgreSQL أو起码 استخدم SSL connection string.

---

## 9. ⚡ Quick Commands Cheat Sheet

```bash
# === السيرفر ===
ssh root@64.226.118.40

# === Mazaya Service ===
docker service ps furniture-xhl2yk              # حالة الخدمة
docker logs $(docker ps --filter name=furniture-xhl2yk -q | head -1) --tail 50 -f  # اللوجز
docker service update --force furniture-xhl2yk  # ريستارت

# === PostgreSQL ===
docker ps --filter name=mazaya-postgres         # تأكد إنه شغّال
docker exec -it mazaya-postgres psql -U mazaya -d mazaya_factory  # ادخل الداتابيز

# === النظام ===
free -h                                         # استهلاك الرام
docker stats --no-stream                        # استهلاك الكونتينرات
df -h                                           # مساحة القرص

# === Git ===
cd "D:/OPEN APPS/DigitalOcian Projects/mazaya-system"
git pull origin main
git push origin main
```

---

## 📝 ملاحظات مهمة

1. **مفيش backup تلقائي** لقاعدة البيانات — يفضّل تعمل cron job:
   ```bash
   # على السيرفر — اعمل backup يومي الساعة 3 الفجر
   0 3 * * * docker exec mazaya-postgres pg_dump -U mazaya mazaya | gzip > /root/backups/mazaya-$(date +\%Y\%m\%d).sql.gz
   ```
2. **الرام صغيرة** (2 GB) ومشتركة مع OpenGym — راقب الاستهلاك لو حصلت مشاكل.
3. **GitHub Actions بيتبني على GitHub runners** (مش على السيرفر) — ده بيوفر في استهلاك الرام.
4. **الـ Dockerfile محسّن** بـ `NODE_OPTIONS` عشان يحدد أقصى رام لكل مرحلة.
5. **DNS لازم يتعمل أولًا** قبل Nginx + Certbot، وإلا Certbot هيُفشل.

---

*آخر تحديث: 2026-06-28*
