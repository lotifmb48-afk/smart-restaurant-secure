# Smart Restaurant — নিরাপদ লগইন ও অর্ডার সার্ভার

এই সংস্করণে অর্ডার এবং মেনু শুধু ব্রাউজারের `localStorage`-এ থাকে না; SQLite ডেটাবেসে সার্ভার-সাইডে সংরক্ষণ হয়। অ্যাডমিন লগইন পাসওয়ার্ডের bcrypt hash ব্যবহার করে এবং session cookie `HttpOnly`/`SameSite` করা হয়েছে।

## চালাতে যা লাগবে
- Node.js 20 বা নতুন সংস্করণ
- কম্পিউটারে টার্মিনাল/Command Prompt

## প্রথমবার চালানোর নিয়ম (Windows)
1. ZIP ফাইল Extract করুন।
2. ফোল্ডারের মধ্যে Command Prompt/Terminal খুলুন।
3. `.env.example` কপি করে `.env` নামে রাখুন।
4. `.env` ফাইলে নিজের `ADMIN_USERNAME`, কমপক্ষে ১২ অক্ষরের শক্ত `ADMIN_PASSWORD`, এবং অন্তত ৩২ অক্ষরের এলোমেলো `SESSION_SECRET` দিন। উদাহরণ secret হিসেবে নিচের কমান্ড দিয়ে তৈরি করতে পারেন:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
5. চালান: `npm install`
6. চালান: `npm start`
7. ব্রাউজারে খুলুন: `http://localhost:3000`
8. ওয়েবসাইটের **Admin Login** থেকে `.env`-এ দেওয়া ইউজারনেম/পাসওয়ার্ড দিয়ে ঢুকুন।

## গুরুত্বপূর্ণ
- প্রথমবার চালু হলে ডেটাবেসে অ্যাডমিন তৈরি হয়। পরে `.env`-এ পাসওয়ার্ড বদলালেই পুরোনো ডেটাবেসের অ্যাডমিন পাসওয়ার্ড বদলাবে না। পাসওয়ার্ড ভুলে গেলে ডেটাবেসে অ্যাডমিন রিসেট করতে হবে।
- `data/restaurant.sqlite`-এ মেনু, অর্ডার ও সেশন ডেটা থাকে। নিয়মিত ব্যাকআপ রাখুন।
- অনলাইনে প্রকাশের সময় HTTPS ব্যবহার করুন এবং হোস্টিংয়ের environment variables-এ `NODE_ENV=production`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` সেট করুন। `DATABASE_FILE`-এর ফাইলটি স্থায়ী storage-এ থাকতে হবে। হোস্টিং যদি persistent disk না দেয়, SQLite ডেটা হারাতে পারে—সেক্ষেত্রে managed PostgreSQL ব্যবহার করুন।
- এটি অনলাইন পেমেন্ট gateway নয়। Cash on Delivery/ম্যানুয়াল অর্ডার রেকর্ডের ভিত্তি। bKash/Nagad/card payment নিতে হলে সংশ্লিষ্ট merchant gateway ও server-side verification যোগ করতে হবে।
- কেবল HTML ফাইল ডাবল-ক্লিক করে খুললে API কাজ করবে না; `npm start` দিয়ে সার্ভার চালাতে হবে।
- production-এ যাওয়ার আগে HTTPS, backup/restore, delivery fee, cancellation/refund policy, privacy notice এবং hosting-specific settings পরীক্ষা করুন।
