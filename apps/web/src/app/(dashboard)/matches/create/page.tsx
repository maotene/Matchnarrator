'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  shortName?: string;
}

interface CurrentSeasonTeam {
  team: Team;
}

export default function CreateMatchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentSeasonLabel, setCurrentSeasonLabel] = useState('');
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    homeTeamId: '',
    awayTeamId: '',
    matchDate: '',
    venue: '',
  });

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await api.get('/seasons/current/teams');
        const seasonName = response.data?.season?.name;
        const competitionName = response.data?.season?.competition?.name;
        const seasonTeams: CurrentSeasonTeam[] = response.data?.teams ?? [];

        setCurrentSeasonLabel(
          seasonName ? `${competitionName ?? 'Liga'} — ${seasonName}` : '',
        );
        setTeams(seasonTeams.map((item) => item.team));
      } catch (err: any) {
        toast({
          title: 'Error',
          description: err.response?.data?.message || 'No se pudieron cargar equipos de temporada actual',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingTeams(false);
      }
    };
    fetchTeams();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.homeTeamId === formData.awayTeamId) {
      toast({
        title: 'Error',
        description: 'El equipo local y visitante deben ser diferentes',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = {
        homeTeamId: formData.homeTeamId,
        awayTeamId: formData.awayTeamId,
        matchDate: new Date(formData.matchDate).toISOString(),
      };
      if (formData.venue.trim()) {
        payload.venue = formData.venue.trim();
      }

      const response = await api.post('/matches', payload);
      toast({
        title: 'Partido creado',
        description: 'El partido fue creado exitosamente',
      });
      router.push(`/match/${response.data.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear el partido',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Partido</h1>
          <p className="text-muted-foreground">Configura los datos del partido</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del Partido</CardTitle>
          <CardDescription>
            Selecciona los equipos y la fecha. Solo equipos de temporada vigente: {currentSeasonLabel || '—'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTeams ? (
            <p className="text-center text-muted-foreground py-8">Cargando equipos...</p>
          ) : teams.length < 2 ? (
            <p className="text-center text-muted-foreground py-8">
              Se necesitan al menos 2 equipos registrados para crear un partido.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="homeTeamId">Equipo Local</Label>
                <select
                  id="homeTeamId"
                  required
                  value={formData.homeTeamId}
                  onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Seleccionar equipo local</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}{team.shortName ? ` (${team.shortName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="awayTeamId">Equipo Visitante</Label>
                <select
                  id="awayTeamId"
                  required
                  value={formData.awayTeamId}
                  onChange={(e) => setFormData({ ...formData, awayTeamId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Seleccionar equipo visitante</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}{team.shortName ? ` (${team.shortName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="matchDate">Fecha y Hora</Label>
                <Input
                  id="matchDate"
                  type="datetime-local"
                  required
                  value={formData.matchDate}
                  onChange={(e) => setFormData({ ...formData, matchDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Estadio / Cancha <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  id="venue"
                  type="text"
                  placeholder="ej. Estadio Monumental"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Creando...' : 'Crear Partido'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
