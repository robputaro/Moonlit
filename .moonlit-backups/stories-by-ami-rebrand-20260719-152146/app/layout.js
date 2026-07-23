import './globals.css';

export const metadata = {
  title: 'Moonlit | Personalized Storybooks',
  description: "Turn your child's world into tonight's bedtime story."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
