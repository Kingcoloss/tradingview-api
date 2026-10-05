# Changelog

## 4.0.0

รุ่น TypeScript แบบหลาย runtime โดยชื่อ public API, signatures, callbacks และ errors ยังคงเดิม

### Breaking changes

- ต้องติดตั้ง `axios` และ `jszip` เป็น peer dependencies เอง และผู้ใช้ Node ต้องติดตั้ง `ws` เพิ่ม
- รองรับ Node.js 20 ขึ้นไป และยังรองรับ Bun 1.3.0 ขึ้นไป
- Deep imports เข้า `src/` ใช้ไม่ได้แล้ว ให้ import จาก package root
- `Client.end()` จะปิด transport เมื่อ state ไม่ใช่ `closed` รวมถึงระหว่าง `connecting` ซึ่งเป็นการเปลี่ยนแปลงโดยเจตนา

### TypeScript

- TypeScript consumers ได้ declarations ที่ ship มากับ package รวมถึง namespace-style types `TradingView.Client` และ `TradingView.PineIndicator`
