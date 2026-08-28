import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '材料审核员｜上传清单和材料，自动找证据、标缺项',
  description:
    '材料审核员根据标准 Checklist 逐项核验材料，定位证据、识别缺项与冲突，让人专注于真正需要判断的事情。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
