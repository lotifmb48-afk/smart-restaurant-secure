# Smart Restaurant — QA রিপোর্ট (v1.0.1)

## এই আপডেটে যা করা হয়েছে

1. বড় `server.js` ভেঙে ছোট মডিউল করা হয়েছে: Express setup, SQLite database, SQLite session store, security helpers, public routes এবং admin routes আলাদা।
2. Admin-এর সব write endpoint-এ `sameOrigin` এবং `requireFullAdmin` রাখা হয়েছে। Demo account read-only; demo দিয়ে menu/order পরিবর্তন করলে HTTP 403 দেওয়ার integration test যোগ হয়েছে।
3. Guest order-এর cart item একবারে parameterized query দিয়ে database থেকে resolve হয়; client পাঠানো price বিশ্বাস করা হয় না।
4. Admin order list-এর items একবারে batch query-তে আনা হয়; প্রতিটি order-এর জন্য আলাদা query আর করা হয় না।
5. Guest order, admin login, demo read-only এবং admin menu/order mutation-এর HTTP integration test যোগ করা হয়েছে।
6. `public` static folder-এর path নতুন module layout অনুযায়ী ঠিক করা হয়েছে।

## এই পরিবেশে যাচাইয়ের ফল

- সব JavaScript source ও test file-এ `node --check`: PASS
- Admin write route guard source review: PASS
- `.env` archive-এ নেই; `.env.example` placeholder-only: PASS
- ZIP integrity: release তৈরির সময় যাচাই করতে হবে
- Full `npm test`: এখানে সম্পন্ন হয়নি, কারণ npm registry থেকে dependency install timeout করেছে এবং offline cache-এ সব package নেই।
- `npm audit`: এখানে সম্পন্ন হয়নি; registry access না থাকায় dependency vulnerability status নিশ্চিত করা যাচ্ছে না।
- Live Render Admin Demo Login: এই পরিবেশ থেকে তোমার Render admin credentials/session দিয়ে যাচাই করা হয়নি।

## Upload করার আগে তোমার কম্পিউটারে চালাবে

```bash
npm ci --include=dev
npm test
npm audit
```

এই তিনটি command সফল না হওয়া পর্যন্ত audit-এ 100/100 বা vulnerability-free দাবি করা যাবে না। Render-এর Environment-এ `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DEMO_ADMIN_USERNAME`, `DEMO_ADMIN_PASSWORD` ঠিকভাবে সেট আছে কি না যাচাই করবে। Real admin এবং demo username আলাদা হতে হবে; demo password কমপক্ষে 12 অক্ষরের।
