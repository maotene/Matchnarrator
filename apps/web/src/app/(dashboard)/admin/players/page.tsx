'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, User, Link2 } from 'lucide-react';

const POSITIONS = [
  { value: '', label: 'Sin posición' },
  { value: 'GK', label: 'Arquero (GK)' },
  { value: 'DF', label: 'Defensor (DF)' },
  { value: 'MF', label: 'Mediocampista (MF)' },
  { value: 'FW', label: 'Delantero (FW)' },
];

const POS_LABEL: Record<string, string> = { GK: 'PO', DF: 'DEF', MF: 'MED', FW: 'DEL' };

interface Season {
  id: string;
  name: string;
  competition: { name: string };
  teams: Array<{ id: string; team: { name: string } }>;
}

interface SeasonOption {
  id: string;
  name: string;
  competition: { name: string };
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  nationality: string | null;
  seasons: Array<{
    teamSeason: {
      id: string;
      team: { name: string };
      season: { name: string; competition: { name: string } };
    };
    jerseyNumber: number | null;
  }>;
}

const EMPTY_PLAYER = { firstName: '', lastName: '', position: '', nationality: '', photo: '', birthDate: '' };
const BULK_TEMPLATE = {
  clearExistingForTeams: false,
  teams: [
    {
      teamName: 'Barcelona SC',
      players: [
        { name: 'Javier Burrai', jerseyNumber: 1, position: 'GK' },
        { name: 'Jugador Ejemplo', jerseyNumber: 9, position: 'FW' },
      ],
    },
    {
      teamName: 'LDU Quito',
      players: [
        { name: 'Alexander Dominguez', jerseyNumber: 22, position: 'GK' },
      ],
    },
  ],
};

export default function PlayersPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | 'assign' | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState(EMPTY_PLAYER);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Assign wizard state
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonOptions, setSeasonOptions] = useState<SeasonOption[]>([]);
  const [assignSeasonId, setAssignSeasonId] = useState('');
  const [assignTeamSeasonId, setAssignTeamSeasonId] = useState('');
  const [assignJersey, setAssignJersey] = useState('');
  const [bulkSeasonId, setBulkSeasonId] = useState('');
  const [bulkSeasonTeams, setBulkSeasonTeams] = useState<Array<{ id: string; team: { name: string } }>>([]);
  const [bulkJson, setBulkJson] = useState('');
  const [bulkLoadingTeams, setBulkLoadingTeams] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);

  const load = async () => {
    try {
      const [playersRes, seasonsRes] = await Promise.all([api.get('/players'), api.get('/seasons')]);
      setPlayers(playersRes.data);
      setSeasonOptions(seasonsRes.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function openAssign(p: Player) {
    setEditing(p);
    setAssignSeasonId('');
    setAssignTeamSeasonId('');
    setAssignJersey('');
    const res = await api.get('/seasons');
    setSeasons(res.data);
    // Load teams for each season
    const detailedSeasons = await Promise.all(
      res.data.map((s: any) => api.get(`/seasons/${s.id}`).then((r) => r.data))
    );
    setSeasons(detailedSeasons);
    setModal('assign');
  }

  async function loadBulkSeasonTeams(seasonId: string) {
    if (!seasonId) {
      setBulkSeasonTeams([]);
      return;
    }
    setBulkLoadingTeams(true);
    try {
      const res = await api.get(`/seasons/${seasonId}`);
      setBulkSeasonTeams(res.data?.teams ?? []);
    } catch (err: any) {
      setBulkSeasonTeams([]);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudieron cargar equipos de la temporada',
        variant: 'destructive',
      });
    } finally {
      setBulkLoadingTeams(false);
    }
  }

  async function handleBulkImport() {
    if (!bulkSeasonId) {
      toast({ title: 'Falta temporada', description: 'Selecciona una temporada', variant: 'destructive' });
      return;
    }
    if (!bulkJson.trim()) {
      toast({ title: 'Falta JSON', description: 'Pega el JSON de plantillas', variant: 'destructive' });
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(bulkJson);
    } catch {
      toast({ title: 'JSON inválido', description: 'Revisa formato del JSON', variant: 'destructive' });
      return;
    }

    setBulkImporting(true);
    try {
      const payload = {
        seasonId: bulkSeasonId,
        clearExistingForTeams: Boolean(parsed.clearExistingForTeams),
        teams: parsed.teams ?? [],
      };
      const res = await api.post('/players/bulk-import', payload);
      const summary = res.data?.summary ?? {};
      toast({
        title: 'Importación masiva completada',
        description: `${summary.teamsProcessed ?? 0} equipos, ${summary.assignmentsCreated ?? 0} altas, ${summary.assignmentsUpdated ?? 0} actualizaciones.`,
      });
      load();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo importar plantillas masivamente',
        variant: 'destructive',
      });
    } finally {
      setBulkImporting(false);
    }
  }

  function openEdit(p: Player) {
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position ?? '',
      nationality: p.nationality ?? '',
      photo: '',
      birthDate: '',
    });
    setEditing(p);
    setModal('edit');
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        position: form.position || undefined,
        nationality: form.nationality || undefined,
        photo: form.photo || undefined,
        birthDate: form.birthDate || undefined,
      };
      if (modal === 'create') {
        await api.post('/players', payload);
        toast({ title: 'Jugador creado' });
      } else {
        await api.patch(`/players/${editing!.id}`, payload);
        toast({ title: 'Jugador actualizado' });
      }
      setModal(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!assignTeamSeasonId) return;
    setSaving(true);
    try {
      await api.post(`/players/${editing!.id}/assign-team`, {
        teamSeasonId: assignTeamSeasonId,
        jerseyNumber: assignJersey ? parseInt(assignJersey) : undefined,
      });
      toast({ title: 'Jugador asignado a la plantilla' });
      setModal(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al asignar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/players/${id}`);
      toast({ title: 'Jugador eliminado' });
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo eliminar', variant: 'destructive' });
    }
  }

  const selectedSeason = seasons.find((s) => s.id === assignSeasonId);

  const filtered = players.filter(
    (p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      `${p.lastName} ${p.firstName}`.toLowerCase().includes(search.toLowerCase())
  );

  const PlayerForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Lionel" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Apellido *</label>
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Messi" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Posición</label>
          <select
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nacionalidad</label>
          <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Argentina" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Fecha de nacimiento</label>
          <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">URL foto</label>
          <Input value={form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value })} placeholder="https://..." />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving || !form.firstName.trim() || !form.lastName.trim()}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Jugadores</h2>
          <p className="text-sm text-gray-500 mt-0.5">{players.length} jugadores</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_PLAYER); setEditing(null); setModal('create'); }}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Jugador
        </Button>
      </div>

      <div className="mb-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="max-w-xs" />
      </div>

      <div className="mb-6 border rounded-xl p-4 bg-white space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">Importación masiva de plantillas</h3>
            <p className="text-xs text-gray-500">Carga por temporada y múltiples equipos en un solo paso.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setBulkJson(JSON.stringify(BULK_TEMPLATE, null, 2))}>
            Cargar plantilla JSON
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Temporada *</label>
            <select
              value={bulkSeasonId}
              onChange={(e) => {
                setBulkSeasonId(e.target.value);
                loadBulkSeasonTeams(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar temporada...</option>
              {seasonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.competition?.name} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-500 flex items-end">
            {bulkLoadingTeams ? 'Cargando equipos...' : `${bulkSeasonTeams.length} equipos en temporada seleccionada`}
          </div>
        </div>

        <textarea
          value={bulkJson}
          onChange={(e) => setBulkJson(e.target.value)}
          placeholder='{"clearExistingForTeams":false,"teams":[{"teamName":"Barcelona SC","players":[{"name":"Jugador","jerseyNumber":10,"position":"FW"}]}]}'
          className="w-full min-h-[200px] border rounded-lg p-3 text-xs font-mono"
        />

        <div className="flex justify-end">
          <Button onClick={handleBulkImport} disabled={bulkImporting || !bulkSeasonId || !bulkJson.trim()}>
            {bulkImporting ? 'Importando...' : 'Importar plantillas masivo'}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-16 text-gray-400">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{players.length === 0 ? 'No hay jugadores.' : 'Sin resultados.'}</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Jugador</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Pos</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Plantillas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.lastName}, {p.firstName}</div>
                    {p.nationality && <div className="text-xs text-gray-400">{p.nationality}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.position ? (
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded">
                        {POS_LABEL[p.position] || p.position}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.seasons.slice(0, 3).map((s, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {s.teamSeason.team.name.split(' ')[0]} {s.teamSeason.season.name}
                          {s.jerseyNumber != null && ` #${s.jerseyNumber}`}
                        </span>
                      ))}
                      {p.seasons.length > 3 && (
                        <span className="text-xs text-gray-400">+{p.seasons.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openAssign(p)} title="Asignar a plantilla" className="p-1.5 text-gray-400 hover:text-green-600 rounded">
                        <Link2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Nuevo Jugador' : 'Editar Jugador'} onClose={() => setModal(null)}>
          {PlayerForm}
        </Modal>
      )}

      {modal === 'assign' && (
        <Modal title={`Asignar "${editing?.lastName}, ${editing?.firstName}" a plantilla`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temporada *</label>
              <select
                value={assignSeasonId}
                onChange={(e) => { setAssignSeasonId(e.target.value); setAssignTeamSeasonId(''); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar temporada...</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.competition?.name} — {s.name}</option>
                ))}
              </select>
            </div>
            {assignSeasonId && selectedSeason && (
              <div>
                <label className="block text-sm font-medium mb-1">Equipo *</label>
                <select
                  value={assignTeamSeasonId}
                  onChange={(e) => setAssignTeamSeasonId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar equipo...</option>
                  {(selectedSeason.teams || []).map((ts) => (
                    <option key={ts.id} value={ts.id}>{ts.team.name}</option>
                  ))}
                </select>
              </div>
            )}
            {assignTeamSeasonId && (
              <div>
                <label className="block text-sm font-medium mb-1">Número de camiseta</label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={assignJersey}
                  onChange={(e) => setAssignJersey(e.target.value)}
                  placeholder="Ej: 10"
                  className="w-32"
                />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleAssign} disabled={saving || !assignTeamSeasonId}>
                {saving ? 'Asignando...' : 'Asignar a plantilla'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Confirmar eliminación" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">¿Eliminás este jugador del catálogo?</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteId)}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
