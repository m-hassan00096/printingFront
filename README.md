# طَبعة | Tabaa Frontend

واجهة نظام إدارة طلبات الطباعة والإنتاج والتسليمات والتحصيلات. مبنية باستخدام React وTypeScript، ومهيأة للتكامل مع Laravel API عبر Sanctum SPA authentication.

## التقنية

- React + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui
- TanStack Query لإدارة بيانات الخادم
- Zustand لحالة الواجهة المشتركة فقط
- React Router للتنقل
- Axios للاتصال بالـ API
- React Hook Form + Zod للنماذج والتحقق من البيانات
- Lucide للأيقونات وCairo للواجهة العربية

## التشغيل المحلي

~~~bash
npm install
cp .env.example .env
npm run dev
~~~

على Windows يمكن نسخ ملف .env.example يدويًا إلى ملف باسم .env.

## الأوامر

~~~bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run format
~~~

## المعمارية

- app: تشغيل التطبيق، المسارات، الـ providers والـ layouts.
- features: ميزات مستقلة، لكل منها API hooks ومكونات وصفحات وأنواع خاصة بها.
- shared: أدوات ومكونات وخدمات مشتركة فعلًا بين الميزات.
- docs: قرارات المعمارية وعقد الـ API ومعايير UI/UX.

## مبادئ أساسية

1. بيانات الخادم داخل TanStack Query، وليست نسخة مكررة داخل Zustand.
2. لا نخزن Bearer Tokens في Local Storage أو Session Storage؛ المصادقة للويب تعتمد على Sanctum session cookies وCSRF.
3. كل Feature مسؤولة عن منطقها، ولا تستورد تفاصيل داخلية من Feature أخرى.
4. حالات التحميل والفراغ والأخطاء والصلاحيات جزء من التصميم وليست حالات ثانوية.
5. الواجهة عربية RTL أولًا، مع تصميم هادئ ومتسق وقابل للوصول.

اقرأ دليل [المعمارية](docs/frontend-architecture.md) و[معايير UI/UX](docs/ui-ux-guidelines.md) قبل إضافة أي شاشة أعمال.
