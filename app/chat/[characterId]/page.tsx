import { ChatExperience } from '@/components/ChatExperience';

export default async function ChatPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  return <ChatExperience characterId={characterId} />;
}
