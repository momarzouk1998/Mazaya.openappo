# 🚀 DEPLOY — Mazaya System

> **القاعدة الذهبية:** مفيش deploy مباشر على السيرفر.
> الكود بيرفع على GitHub الأول، وبعدها CI/CD يبني Docker image ويرفعها على GHCR، والسيرفر يحدث الخدمة أوتوماتيك.

---

## 🧠 ازاي الشغل بنفسج؟

```
جهازك (تعديل الكود)  →  GitHub (المصدر الرسمي)  →  GitHub Actions (CI/CD)
                                                       ↓
السيرفر (docker service update)  ←  GHCR (GitHub Container Registry)  ←  بناء Docker image
```

- ✅ لو السيرفر وقع، الكود آمن على GitHub + الصورة على GHCR.
- ✅ الـ build مبيستهلكش موارد السيرفر (بيحصل على GitHub).
- ✅ الـ deploy كامل أوتوماتيك — **مافيش داعي تدخل على السيرفر يدوي**.
- ✅ تاريخ كامل لكل تعديل.

---

## ✅ خطوات الـ Deploy

### الخطوة 1: تأكد إن الكود شغّال محلياً

```bash
cd "D:/OPEN APPS/DigitalOcian Projects/mazaya-system"
npm run build
```

- لو ظهر `✓ Compiled successfully` → كمّل.
- لو ظهر خطأ → **وقّف**، اصلحه، وارجع جرّب.

### الخطوة 2: ارفع الكود لـ GitHub

```bash
git status                    # شوف إيه اللي اتعدّل
git add -A                    # ضيف كل التعديلات
git commit -m "وصف مختصر"     # احفظ التعديلات
git push origin main          # ارفع لـ GitHub
```

**رسالة commit واضحة:**
- `feat:` لميزة جديدة، `fix:` لإصلاح، `style:` للشكل.
- مثال: `feat: إضافة تقرير الأرباح مع الفلترة بالشهر`

### الخطوة 3: استنى CI/CD (2-3 دقايق)

GitHub Actions بيشتغل تلقائياً:
1. يبني Docker image
2. يرفعها على `ghcr.io/momarzouk1998/mazaya.openappo:latest`
3. SSH على السيرفر → `docker service update --force furniture-xhl2yk`

**خلاص — الموقع اتحدث.** مش محتاج تفتح SSH خالص.

تقدر تتابع الشغل من هنا: https://github.com/momarzouk1998/Mazaya.openappo/actions

### الخطوة 4: تأكد إن الموقع شغّال

```bash
curl -s -o /dev/null -w "%{http_code}" https://mazaya.openappo.com/
```

- `200` = تمام ✅
- `500` = في مشكلة في الكود ❌
- `502` = الكونتينر مش شغّال أو Nginx مش لاقيه ❌

---

## ⚡ الاختصار (كوبي-بيست)

```bash
# === على جهازك — commit و push ===
cd "D:/OPEN APPS/DigitalOcian Projects/mazaya-system"
git add -A && git commit -m "وصف" && git push origin main

# استنى 2-3 دقايق — CI/CD يعمل build + deploy أوتوماتيك

# === اتأكد ===
curl -s -o /dev/null -w "%{http_code}" https://mazaya.openappo.com/
```

---

## 🛡️ إدارة الموارد (السيرفر 2GB RAM)

### تحسينات مضبوطة مسبقاً
- **Dockerfile multi-stage:** الصورة النهائية صغيرة (~180MB).
- **NODE_OPTIONS محدودة:** وقت الـ build 1280MB (على GitHub وليس السيرفر)، وقت التشغيل 512MB.
- **Swap file 2GB:** عشان لو حصل زيادة استهلاك.

### أوامر مراقبة (لو احتجت تدخل)
```bash
ssh root@64.226.118.40
docker service ps furniture-xhl2yk      # حالة الخدمة
docker service logs furniture-xhl2yk    # اللوجز
free -h                                 # استهلاك RAM
docker stats --no-stream                # استهلاك الكونتينرات
```

### تنظيف دوري
```bash
docker image prune -a                   # امسح الصور القديمة
```

---

## 🔐 المتغيرات المهمة

| الملف | الوظيفة |
|---|---|
| `/opt/mazaya/.env` | DATABASE_URL + secrets (ممنوع يرفع على GitHub) |
| `/etc/nginx/sites-available/mazaya` | Nginx config للـ subdomain |

### محتويات `.env` على السيرفر
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

## 🚨 مشاكل وحلول

### الموقع راجع 502
**السبب:** الخدمة وقعت أو لسة متبنية.
**الحل:**
```bash
ssh root@64.226.118.40
docker service ps furniture-xhl2yk
docker service logs furniture-xhl2yk --tail 20
```

### `docker service update` فشل في الـ CI/CD
**السبب:** الـ Swarm service مش موجود أو فيه مشكلة في SSH key.
**الحل:** ادخل على السيرفر واعمل:
```bash
docker service create --name furniture-xhl2yk --restart-condition any --network host --env-file /opt/mazaya/.env ghcr.io/momarzouk1998/mazaya.openappo:latest
```

### الكونتينر بيرجع 500
**السبب:** خطأ في الكود.
**الحل:**
```bash
ssh root@64.226.118.40
docker service logs furniture-xhl2yk --tail 50 | grep "Error\|⨯"
```

### السيرفر مش بيرد على SSH
**السبب:** RAM خلصت.
**الحل:** ادخل DigitalOcean Dashboard → Reboot.

---

## 🔒 قواعد مهمة

1. **مفيش deploy مباشر على السيرفر.** كل حاجة تمر عبر GitHub.
2. **مفيش تعديل على ملفات السيرفر يدوياً** (غير `.env` لو اضطررت).
3. **متشغّلش `npm run build` على السيرفر** — البناء يحصل في GitHub Actions.
4. **اعمل backup دوري:**
   ```bash
   ssh root@64.226.118.40
   docker exec mazaya-postgres pg_dump -U mazaya mazaya | gzip > /root/backup-$(date +%Y%m%d).sql.gz
   ```
5. **لو مش متأكد → اسأل** قبل ما تكسر الـ production.

---

*آخر تحديث: 2026-06-30*
