import './globals.css';

export const metadata = {
  title: 'Stories by Ami | Personalized Storybooks',
  description: "Personalized stories made from their world."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
