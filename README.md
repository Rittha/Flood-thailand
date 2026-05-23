# Flood Dashboard Firebase Project

โปรเจกต์นี้เป็นต้นแบบระบบติดตามน้ำท่วมที่ใช้ Firebase Hosting + Cloud Functions + Firestore + Leaflet + Chart.js

## สิ่งที่ต้องแก้ก่อนใช้งานจริง
1. แก้ `public/index.html` ในส่วน Firebase Web Config
2. สร้าง `functions/.env` จาก `functions/.env.example`
3. ใส่ค่า GISTDA API key, LINE Messaging API token, TMD endpoint
4. เปิด Firebase Authentication แบบ Email/Password
5. สร้างเอกสาร role ใน Firestore collection `users`

## คำสั่งติดตั้ง
```bash
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
```

## รัน emulator
```bash
firebase emulators:start --only functions,hosting,firestore
```

## Deploy
```bash
firebase use your-firebase-project-id
firebase deploy --only hosting,functions,firestore
```

## GitHub Actions Secrets
- `PROJECT_ID`
- `FIREBASE_TOKEN`

## หมายเหตุ
- หากไม่มี TMD endpoint จริง ระบบจะยังทำงานได้ แต่ส่วนข้อมูลฝนจะว่าง
- หน้าเว็บมีปุ่ม Admin Sync สำหรับ admin ที่ล็อกอินแล้ว
