import { notFound } from 'next/navigation';
import HistoryClassroom from '@/components/History/HistoryClassroom';

// Synthetic records only. This route does not exist in a production build.
export default function PreviewPage() {
  if(process.env.NODE_ENV!=='development')notFound();
  return <HistoryClassroom user={{id:'local-preview'}} teacher previewOnly/>;
}
