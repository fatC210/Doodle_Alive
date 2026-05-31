import { DrawingCanvas } from '@/components/DrawingCanvas';
import { WizardHeader } from '@/components/WizardHeader';

type CreatePageProps = {
  searchParams: Promise<{ new?: string | string[] | undefined }>;
};

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const params = await searchParams;
  const newParam = Array.isArray(params.new) ? params.new[0] : params.new;

  return (
    <div className="page-shell">
      <WizardHeader activeStep={1} />
      <DrawingCanvas freshStart={newParam === '1'} />
    </div>
  );
}
