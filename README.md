This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

---

## Money Manager — Local-First Sync

**Architecture**: Next.js + TypeScript + Tailwind • Local JSON storage • Google Drive sync (client-only)

### Setup Google Drive Sync (Penting)

1. Buat file `.env.local` di root folder
2. Tambahkan:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

**Cara mendapatkan Client ID:**
- Buka https://console.cloud.google.com
- Enable **Google Drive API**
- Buat OAuth 2.0 Client ID (Web)
- Tambahkan `http://localhost:3000` sebagai Authorized origin

### Key Rules
- Feature-based structure
- Named exports only
- Pure functions preferred

**Core Sync Concept**:
Data lives in `money_manager_data.json` di Google Drive user.

```bash
npm run dev
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
