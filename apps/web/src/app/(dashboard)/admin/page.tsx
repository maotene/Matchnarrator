'use client';

import Link from 'next/link';
import { Trophy, Calendar, Users, User, Download, Radar } from 'lucide-react';

const CARDS = [
  {
    href: '/admin/competitions',
    icon: Trophy,
    label: 'Ligas',
    desc: 'Crear y gestionar ligas y competencias',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    href: '/admin/seasons',
    icon: Calendar,
    label: 'Temporadas',
    desc: 'Gestionar temporadas por liga',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    href: '/admin/teams',
    icon: Users,
    label: 'Equipos',
    desc: 'Equipos y asignación a temporadas',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    href: '/admin/players',
    icon: User,
    label: 'Jugadores',
    desc: 'Catálogo de jugadores y plantillas',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    href: '/admin/current-season',
    icon: Radar,
    label: 'Temporada actual',
    desc: 'Ver equipos, tabla, fixtures y sesiones en curso',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    href: '/admin/import',
    icon: Download,
    label: 'Importar datos',
    desc: 'Importar ligas, equipos y plantillas desde API-Football',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
];

export default function AdminPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Panel de Administración</h2>
      <p className="text-sm text-gray-500 mb-6">
        Gestioná el catálogo de ligas, equipos y jugadores.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(({ href, icon: Icon, label, desc, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="block bg-white border rounded-xl p-5 hover:shadow-md transition-shadow group"
          >
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
              {label}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
