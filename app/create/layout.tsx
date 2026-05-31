import { CreateConfigGate } from '@/components/CreateConfigGate';
import type { ReactNode } from 'react';

export default function CreateLayout({ children }: { children: ReactNode }) {
  return <CreateConfigGate>{children}</CreateConfigGate>;
}
