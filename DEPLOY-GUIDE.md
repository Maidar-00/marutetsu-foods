# 🇲🇳 DEPLOY ЗААВАР — Marutetsu Foods (үнэгүй, байнгын хадгалалттай)

**Асуудлын шалтгаан:** Render үнэгүй түвшний диск нь түр зуурын — сервер дахин асах болгон
(унтахаар ч) `data/content.json` болон upload хийсэн зургууд **арчигддаг** байсан.

**Шийдэл (бүгд үнэгүй):**

| Үйлчилгээ | Юу хийх вэ | Хязгаар |
|---|---|---|
| **Netlify** | Веб хост + домейн холболт | 100GB сар бүр (хангалттай) |
| **Neon** | Мэдээллийн сан (текст, нэвтрэх, session) | 0.5GB (хангалттай) |
| **Cloudinary** | Зургийн CDN | ~25GB сар бүр (хангалттай) |

Одоо хадгалсан бүх зүйл **байнгын** — сервер дахин асч ч, deploy хийгдэч алга болохгүй.

---

## 1-р алхам. Neon (мэдээллийн сан) үүсгэх

1. https://neon.com → **Sign up** (GitHub-ээр нэвтрэж болно)
2. **Create project** дарна
   - Name: `marutetsu`
   - Region: **Singapore** (Монгол/Японд ойрхон)
3. Үүсээд **Connection string** хуулж авна — дүрс нь ийм байна:
   ```
   postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   📋 Энийг **DATABASE_URL** гэж тэмдэглэж аваарай (хаана ч хуваалцахгүй!).

## 2-р алхам. Cloudinary (зургийн сан) үүсгэх

1. https://cloudinary.com → **Start for free** (GitHub-ээр болно)
2. Нэвтрээд **Dashboard** дээрх 3 мэдээллийг хуулж авна:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
   (Dashboard → Programmable Media хэсэгт байдаг. API Secret-ийг нууц гэж үз!)

## 3-р алхам. Netlify дээр deploy хийх

1. https://netlify.com → **Sign up** → **GitHub-ээр нэвтрэнэ**
2. **Add new site → Import an existing project → GitHub**
3. Repo-оо сонгоно: `marutetsu-foods`
4. Build тохиргоо автоматаар `netlify.toml`-оос уншигдана — юу ч бичих хэрэггүй
5. Deploy-оос **өмнө** env хувьсагч тохируулна:
   **Site configuration → Environment variables → Add a variable** (4 ш):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | 1-р алхамд авсан connection string |
   | `CLOUDINARY_CLOUD_NAME` | 2-р алхамд авсан Cloud Name |
   | `CLOUDINARY_API_KEY` | 2-р алхамд авсан API Key |
   | `CLOUDINARY_API_SECRET` | 2-р алхамд авсан API Secret |
6. **Deploy site** дарна → 1-2 минутын дараа
   `https://<таны-нэр>.netlify.app` дээр сайт асна

> Netlify дээр нэрээ солих бол: Site configuration → Change site name
> (жишээ: `marutetsu-foods` → `https://marutetsu-foods.netlify.app`)

## 4-р алхам. Шалгах (заавал хийгээрэй!)

1. `https://<сайт>.netlify.app/admin` → нэвтэрнэ: `admin` / `marutetsu123`
2. **Заавал** — 「設定 / パスワード」-аар нэвтрэх нэр, нууц үгээ **солино**
3. Ямар нэг текст засаж **💾 保存** дарна → сайт дээр шууд харагдана
4. `data/content.json`-д хамаагүй — одоо бүх зүйл Neon дээр хадгалагдаж байгаа
5. Зураг upload хийж үзнэ — Cloudinary руу явна, URL нь `res.cloudinary.com/...` болно

## 5-р алхам. Домейн авах (~$10/жил)

**Санал болгох: Cloudflare Registrar** (хамгийн хямд — нэмэлт төлбөргүй, WHOIS privacy үнэгүй):

1. https://cloudflare.com → данс үүсгэж нэвтрэнэ
2. **Domain Registration → Register Domain** → хүссэн нэрээ шалгаад авна (жишээ `marutetsu-foods.com`)
3. Төлбөр төлөхөд домейн Cloudflare дансанд чинь орно

**Эсвэл Namecheap** (илүү энгийн интерфейс): https://namecheap.com

## 6-р алхам. Домейнийг Netlify-д холбох

1. Netlify → **Domain management → Add a domain** → домэйнээ бичнэ (`marutetsu-foods.com`)
2. Netlify DNS заавар өгнө. Cloudflare-с авсан бол Cloudflare **DNS** хэсэгт:
   | Type | Name | Content | Proxy |
   |---|---|---|---|
   | `CNAME` | `www` | `таны-сайт.netlify.app` | DNS only (саарал үүл) |
   | `A` | `@` | `75.2.60.5` | DNS only (саарал үүл) |
3. Netlify **HTTPS (SSL)**-ийг автоматаар өгнө (Let's Encrypt) — 5-30 минут
4. ✅ `https://marutetsu-foods.com` болон `/admin` ажиллана

## 7-р алхам. Хуучин Render-ээ устгах

Netlify амжилттай ажиллаад, домейн холбогдсоны дараа:
- https://dashboard.render.com → `marutetsu-foods` сервис → **Settings → Delete**
- `https://marutetsu-foods.onrender.com` хаагдана (мэдээлэл нь Netlify/Neon дээр тусдаа байгаа)

---

## Дараа нь засвар хийхэд

- **Вебээр дамжуулан (заавал):** `https://домейн/admin` → нэвтэрч засварлана → 保存 → байнгын
- **Кодоор засварлахад:** GitHub-д push хийхэд Netlify автоматаар дахин deploy хийнэ.
  ⚠️ Анхаар: кодын deploy `data/content.json`-ийг дахин ашиглахгүй — Neon дээрх агуулга
  хэвээрээ үлдэнэ. Тиймээс аль ч талаас нь засвар хийсэн ч алдах зүйлгүй.

## Асуудал гарвал

| Шинж тэмдэг | Шалтгаан / шийдэл |
|---|---|
| `/admin` нэвтрэхгүй | env хувьсагч буруу — Netlify → Environment variables дахин шалгаад **Retrain deploy** хийгээрей (Deploys → Trigger deploy → Clear cache and deploy site) |
| Хадгалсан ч харагдахгүй | Хөтчийн cache — Ctrl+F5 дарж refresh хийгээрэй |
| Зураг upload амжилтгүй | Cloudinary 3 env хувьсагч шалгаарай; зураг автомат 1920px-ээс багасдаг тул 6MB хязгаарт хэзээ ч хүрэхгүй |
| Neon унтсан (ховор) | Эхний хүсэлт ~1 сек хожимддог төдий — дараа нь хэвийн |
