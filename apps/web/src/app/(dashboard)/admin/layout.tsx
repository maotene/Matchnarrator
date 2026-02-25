'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Trophy, Calendar, Users, User, Download, LayoutDashboard, Radar } from 'lucide-react';

const NAV = [
  { href: '/admin', label: 'Panel', icon: LayoutDashboard, exact: true },
  { href: '/admin/competitions', label: 'Ligas', icon: Trophy },
  { href: '/admin/seasons', label: 'Temporadas', icon: Calendar },
  { href: '/admin/teams', label: 'Equipos', icon: Users },
  { href: '/admin/players', label: 'Jugadores', icon: User },
  { href: '/admin/current-season', label: 'Temporada actual', icon: Radar },
  { href: '/admin/import', label: 'Importar', icon: Download },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  if (!user || user.role !== 'SUPERADMIN') return null;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <nav className="w-48 shrink-0">
        <div className="bg-white border rounded-lg overflow-hidden sticky top-4">
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Administración</p>
          </div>
          <ul className="py-1">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
