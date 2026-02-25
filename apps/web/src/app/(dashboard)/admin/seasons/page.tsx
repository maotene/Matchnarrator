'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';

interface Competition { id: string; name: string; country: string | null; }
interface Season {
  id: string;
  name: string;
  competitionId: string;
  competition: Competition;
  startDate: string | null;
  endDate: string | null;
  _count: { teams: number };
}

const EMPTY = { name: '', competitionId: '', startDate: '', endDate: '' };

export default function SeasonsPage() {
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [filterComp, setFilterComp] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Season | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        api.get('/seasons' + (filterComp ? `?competitionId=${filterComp}` : '')),
        api.get('/competitions'),
      ]);
      setSeasons(sRes.data);
      setCompetitions(cRes.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterComp]);

  function openCreate() {
    setForm({ ...EMPTY, competitionId: filterComp || (competitions[0]?.id ?? '') });
    setEditing(null);
    setModal('create');
  }

  function openEdit(s: Season) {
    setForm({
      name: s.name,
      competitionId: s.competitionId,
      startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      endDate: s.endDate ? s.endDate.slice(0, 10) : '',
    });
    setEditing(s);
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim() || !form.competitionId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        competitionId: form.competitionId,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (modal === 'create') {
        await api.post('/seasons', payload);
        toast({ title: 'Temporada creada' });
      } else {
        await api.patch(`/seasons/${editing!.id}`, payload);
        toast({ title: 'Temporada actualizada' });
      }
      setModal(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/seasons/${id}`);
      toast({ title: 'Temporada eliminada' });
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo eliminar', variant: 'destructive' });
    }
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-AR', { year: 'numeric', month: 'short' }) : '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Temporadas</h2>
          <p className="text-sm text-gray-500 mt-0.5">{seasons.length} temporadas</p>
        </div>
        <Button onClick={openCreate} disabled={competitions.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Temporada
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterComp}
          onChange={(e) => setFilterComp(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las ligas</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-center py-16 text-gray-400">Cargando...</p>
      ) : seasons.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No hay temporadas.{competitions.length === 0 && ' Primero creá una liga.'}</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Temporada</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Liga</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Equipos</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Período</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {seasons.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.competition.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {s._count.teams}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(s.startDate)} → {fmt(s.endDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
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

      {/* Create / Edit modal */}
      {modal && (
        <Modal title={modal === 'create' ? 'Nueva Temporada' : 'Editar Temporada'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Liga *</label>
              <select
                value={form.competitionId}
                onChange={(e) => setForm({ ...form, competitionId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar liga...</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.country ? `(${c.country})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: 2024 / Apertura 2024"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Inicio</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fin</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim() || !form.competitionId}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Confirmar eliminación" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">¿Eliminás esta temporada? Se borrarán los equipos y jugadores asociados.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteId)}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
