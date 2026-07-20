import './globals.css';

export const metadata = {
  title: 'AMI | Personalized Storybooks',
  description: "Personalized stories made from their world."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
