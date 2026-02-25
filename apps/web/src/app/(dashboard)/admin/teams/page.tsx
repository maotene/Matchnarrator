'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, Users, Link2 } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  city: string | null;
  logo: string | null;
  seasons: Array<{
    season: {
      id: string;
      name: string;
      competition: { id: string; name: string };
    };
  }>;
  _count: { seasons: number };
}
interface Season { id: string; name: string; competition: { name: string }; }

const EMPTY_TEAM = { name: '', shortName: '', city: '', logo: '' };

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | 'assign' | null>(null);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState(EMPTY_TEAM);
  const [assignSeasonId, setAssignSeasonId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [tRes, sRes] = await Promise.all([api.get('/teams'), api.get('/seasons')]);
      setTeams(tRes.data);
      setSeasons(sRes.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  function openCreate() { setForm(EMPTY_TEAM); setEditing(null); setModal('create'); }
  function openEdit(t: Team) {
    setForm({ name: t.name, shortName: t.shortName ?? '', city: t.city ?? '', logo: t.logo ?? '' });
    setEditing(t);
    setModal('edit');
  }
  function openAssign(t: Team) {
    setEditing(t);
    setAssignSeasonId(seasons[0]?.id ?? '');
    setModal('assign');
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        shortName: form.shortName || undefined,
        city: form.city || undefined,
        logo: form.logo || undefined,
      };
      if (modal === 'create') {
        await api.post('/teams', payload);
        toast({ title: 'Equipo creado' });
      } else {
        await api.patch(`/teams/${editing!.id}`, payload);
        toast({ title: 'Equipo actualizado' });
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
    if (!assignSeasonId) return;
    setSaving(true);
    try {
      await api.post(`/teams/${editing!.id}/assign-season`, { seasonId: assignSeasonId });
      toast({ title: 'Equipo asignado a la temporada' });
      setModal(null);
      load();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al asignar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/teams/${id}`);
      toast({ title: 'Equipo eliminado' });
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo eliminar', variant: 'destructive' });
    }
  }

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.shortName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; teams: Team[] }>();

    for (const team of filtered) {
      if (!team.seasons || team.seasons.length === 0) {
        const key = 'sin-asignacion';
        if (!map.has(key)) {
          map.set(key, { title: 'Sin liga / temporada asignada', teams: [] });
        }
        map.get(key)!.teams.push(team);
        continue;
      }

      for (const teamSeason of team.seasons) {
        const competitionName = teamSeason.season.competition?.name ?? 'Liga';
        const seasonName = teamSeason.season?.name ?? 'Temporada';
        const key = `${competitionName}__${seasonName}`;
        if (!map.has(key)) {
          map.set(key, { title: `${competitionName} — ${seasonName}`, teams: [] });
        }
        map.get(key)!.teams.push(team);
      }
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      teams: group.teams.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [filtered]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Equipos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{teams.length} equipos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/players">Gestionar plantillas</Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Equipo
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar equipo..."
          className="max-w-xs"
        />
      </div>

      {loading ? (
        <p className="text-center py-16 text-gray-400">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{teams.length === 0 ? 'No hay equipos.' : 'Sin resultados para la búsqueda.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.title} className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <p className="font-semibold text-sm">{group.title}</p>
                <p className="text-xs text-gray-500">{group.teams.length} equipos</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Equipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Ciudad</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Temporadas</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {group.teams.map((t) => (
                    <tr key={`${group.title}-${t.id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {t.logo && <img src={t.logo} alt="" className="h-7 w-7 object-contain" />}
                          <div>
                            <span className="font-medium">{t.name}</span>
                            {t.shortName && (
                              <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 rounded">
                                {t.shortName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.city || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {t._count.seasons}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openAssign(t)}
                            title="Asignar a temporada"
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
                          >
                            <Link2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteId(t.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Nuevo Equipo' : 'Editar Equipo'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Racing Club" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Abreviatura</label>
                <Input value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="RAC" maxLength={5} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ciudad</label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Avellaneda" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL del logo</label>
              <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign to season */}
      {modal === 'assign' && (
        <Modal title={`Asignar "${editing?.name}" a una temporada`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temporada *</label>
              <select
                value={assignSeasonId}
                onChange={(e) => setAssignSeasonId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.competition.name} — {s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleAssign} disabled={saving || !assignSeasonId}>
                {saving ? 'Asignando...' : 'Asignar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Confirmar eliminación" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">¿Eliminás este equipo?</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteId)}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
