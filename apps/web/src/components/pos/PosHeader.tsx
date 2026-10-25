import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';

export function PosHeader() {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2">
            <UnnaSymbol className="w-8 h-8 text-unna-green" />
            <span className="text-xl font-bold text-gray-900">UNNA</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
