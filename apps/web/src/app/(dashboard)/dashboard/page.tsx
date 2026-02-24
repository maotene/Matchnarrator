'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Plus, Calendar, MapPin, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await api.get('/matches');
      setMatches(response.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los partidos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SETUP':
        return 'bg-gray-100 text-gray-800';
      case 'LIVE':
        return 'bg-green-100 text-green-800';
      case 'HALFTIME':
        return 'bg-yellow-100 text-yellow-800';
      case 'FINISHED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      SETUP: 'Configuración',
      LIVE: 'En Vivo',
      HALFTIME: 'Medio Tiempo',
      FINISHED: 'Finalizado',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Partidos</h1>
          <p className="text-muted-foreground">Gestiona tus sesiones de narración</p>
        </div>
        <Button onClick={() => router.push('/matches/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Partido
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando partidos...</p>
        </div>
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No tienes partidos creados aún
            </p>
            <Button onClick={() => router.push('/matches/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Primer Partido
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <Card
              key={match.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/match/${match.id}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                      match.status
                    )}`}
                  >
                    {getStatusLabel(match.status)}
                  </span>
                </div>
                <CardTitle className="text-lg">
                  <div className="flex items-center justify-between">
                    <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span>{match.awayTeam.shortName || match.awayTeam.name}</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formatDateTime(match.matchDate)}
                </div>
                {match.venue && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4" />
                    {match.venue}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    <Clock className="inline mr-1 h-3 w-3" />
                    {match._count.events} eventos
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {match._count.roster} jugadores
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
