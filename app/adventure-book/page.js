import AdventureBookBuilder from './AdventureBookBuilder';

export const metadata = {
  title: 'Free Personalized Adventure Book | AMI',
  description: 'Create a free personalized 15-page printable Adventure Book sampler made for your child.'
};

export default function AdventureBookPage() {
  const enabled = process.env.NEXT_PUBLIC_AMI_ADVENTURE_BOOKS_ENABLED === 'true';
  return <AdventureBookBuilder enabled={enabled} />;
}
