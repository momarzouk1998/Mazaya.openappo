# 🔌 Server Access & Connection Info — Mazaya Factory

> **الهدف:** ملف واحد فيه كل بيانات الاتصال اللي محتاجها عشان تتعامل مع السيرفر، قاعدة البيانات، GitHub، والـ deployment.

---

## 1. 🖥️ Server (DigitalOcean Droplet — نفس سيرفر OpenGym)

| الحاجة | القيمة |
|---|---|
| **Provider** | DigitalOcean |
| **Droplet ID** | `580266631` |
| **Region** | `fra1` (Frankfurt) |
| **OS** | Ubuntu 24.04.4 LTS |
| **Public IP** | `64.226.118.40` |
| **RAM** | ~2 GB |
| **Disk** | 48 GB |
| **DNS Domain** | `mazaya.openappo.com` → `64.226.118.40` |

### الاتصال بالسيرفر (SSH)

```bash
ssh root@64.226.118.40
```

- المستخدم: `root`
- نفس مفتاح SSH الخاص بـ OpenGym

### الفايروول (UFW)

| المنفذ | الخدمة |
|---|---|
| 22 | OpenSSH |
| 80 / 443 | Nginx (HTTP/HTTPS) |
| 3001 | Mazaya App (Docker) |
| 5432 | PostgreSQL (محلي فقط — `127.0.0.1`) |

---

## 2. 🗄️ Database (PostgreSQL)

| الحاجة | القيمة |
|---|---|
| **Type** | PostgreSQL (Native) |
| **Host** | `localhost` / `127.0.0.1` |
| **Port** | `5432` |
| **Database Name** | `mazaya` |
| **User** | `mazaya` |
| **Password** | `Mazaya2024!SecureDb` |
| **Superuser** | `postgres` |

### Connection String (للإنتاج)
```
postgresql://mazaya:Mazaya2024!SecureDb@localhost:5432/mazaya
```

### الدخول لـ psql على السيرفر
```bash
sudo -u postgres psql
CREATE DATABASE mazaya;
CREATE USER mazaya WITH ENCRYPTED PASSWORD 'Mazaya2024!SecureDb';
GRANT ALL PRIVILEGES ON DATABASE mazaya TO mazaya;
\c mazaya
# run schema SQL
```

---

## 3. 🐳 Docker (التطبيق المشتغل)

| الحاجة | القيمة |
|---|---|
| **Container Name** | `mazaya` |
| **Image** | `mazaya:latest` |
| **Port** | `3001` (محلّي) → Nginx reverse proxy |
| **Restart Policy** | `unless-stopped` |
| **Dockerfile Location** | `/opt/mazaya/Dockerfile` |

### أوامر إدارة الكونتينر
```bash
docker ps                              # شوف الكونتينرات
docker logs mazaya --tail 50 -f        # تتبع اللوج
docker restart mazaya                  # ريستارت
docker stop mazaya                     # إيقاف
docker exec -it mazaya sh              # ادخل جوّه
```

### متغيرات البيئة
```
DATABASE_URL="postgresql://mazaya:Mazaya2024!SecureDb@localhost:5432/mazaya"
NEXT_PUBLIC_APP_URL="https://mazaya.openappo.com"
NEXT_PUBLIC_APP_NAME="مصنع مزايا للأثاث"
AUTH_SECRET="mazaya-super-secret-key-2024"
NODE_ENV=production
PORT=3001
HOSTNAME=0.0.0.0
```

---

## 4. 🚀 Deployment (النشر على السيرفر)

### المجلد الرئيسي على السيرفر
```
/opt/mazaya/
```
> فيه نسخة Git + `.env` + `Dockerfile`.

### خطوات إعادة النشر
```bash
ssh root@64.226.118.40
cd /opt/mazaya
git pull origin main
docker build -t mazaya:latest .
docker stop mazaya && docker rm mazaya
docker run -d --name mazaya --restart unless-stopped \
  --network host \
  --env-file .env \
  mazaya:latest
```

---

## 5. 🐙 GitHub

| الحاجة | القيمة |
|---|---|
| **Account** | `momarzouk1998` |
| **Repository** | `Mazaya.openappo` |
| **URL** | `https://github.com/momarzouk1998/Mazaya.openappo.git` |
| **Default Branch** | `main` |

---

## 6. 🌐 Nginx & SSL

### إضافة Config لـ nginx
أنشئ `/etc/nginx/sites-available/mazaya`:
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
```

ثم:
```bash
ln -s /etc/nginx/sites-available/mazaya /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
certbot --nginx -d mazaya.openappo.com
```

---

## 7. 🌍 DNS

| النطاق الفرعي | IP | ملاحظة |
|---|---|---|
| `mazaya.openappo.com` | `64.226.118.40` | نفس سيرفر OpenGym |

> اعمل **A record** في لوحة تحكم DNS يشاور على `64.226.118.40`

---

## 8. 🔐 Admin & Secrets

| الحاجة | القيمة |
|---|---|
| **Admin Username** | `admin` |
| **Admin Email** | `abomrzk@gmail.com` |
| **AUTH_SECRET** | `mazaya-super-secret-key-2024` |

---

## 9. ⚡ Quick Commands

```bash
ssh root@64.226.118.40                # ادخل على السيرفر
docker logs mazaya --tail 50 -f       # تتبع لوج التطبيق
docker restart mazaya                 # ريستارت

cd /opt/mazaya && git pull            # حدّث الكود
docker build -t mazaya:latest . && docker stop mazaya && docker rm mazaya
docker run -d --name mazaya --restart unless-stopped --network host --env-file .env mazaya:latest

sudo -u postgres psql -d mazaya       # افتح الداتابيز
```

---

## 📝 ملاحظات

1. **نفس سيرفر OpenGym** — خلي بالك من استهلاك الرام (2 GB فقط)
2. **الـ port مختلف**: Mazaya على `3001`، OpenGym على `3000`
3. **مفيش backup تلقائي** للداتابيز — يفضّل تعمل cron job:
   ```bash
   0 3 * * * sudo -u postgres pg_dump mazaya | gzip > /root/backups/mazaya-$(date +\%Y\%m\%d).sql.gz
   ```
4. **أول نشر** محتاج: DNS record → Nginx config → Certbot SSL → تشغيل Docker

---

*آخر تحديث: 2026-06-26*
