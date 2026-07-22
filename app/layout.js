import './globals.css';

export const metadata = {
  title: 'AMI | Personalized Books Made From Their World',
  description: "Personalized storybooks, Adventure Books, and creative products made from their world.",
  icons: { icon: '/ami-icon.svg', shortcut: '/ami-icon.svg', apple: '/ami-icon.svg' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
