'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, Trophy } from 'lucide-react';

interface Competition {
  id: string;
  name: string;
  country: string | null;
  logo: string | null;
  _count: { seasons: number };
}

const EMPTY = { name: '', country: '', logo: '' };

export default function CompetitionsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/competitions');
      setItems(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY);
    setEditing(null);
    setModal('create');
  }

  function openEdit(c: Competition) {
    setForm({ name: c.name, country: c.country ?? '', logo: c.logo ?? '' });
    setEditing(c);
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name, country: form.country || undefined, logo: form.logo || undefined };
      if (modal === 'create') {
        await api.post('/competitions', payload);
        toast({ title: 'Liga creada' });
      } else {
        await api.patch(`/competitions/${editing!.id}`, payload);
        toast({ title: 'Liga actualizada' });
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
      await api.delete(`/competitions/${id}`);
      toast({ title: 'Liga eliminada' });
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo eliminar', variant: 'destructive' });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Ligas / Competencias</h2>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} registradas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Liga
        </Button>
      </div>

      {loading ? (
        <p className="text-center py-16 text-gray-400">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No hay ligas. Creá una o importá desde la sección Importar.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">País</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Temporadas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.logo && <img src={c.logo} alt="" className="h-6 w-6 object-contain" />}
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.country || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {c._count.seasons}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      >
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
        <Modal
          title={modal === 'create' ? 'Nueva Liga' : 'Editar Liga'}
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Primera División"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">País</label>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Ej: Argentina"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL del logo</label>
              <Input
                value={form.logo}
                onChange={(e) => setForm({ ...form, logo: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Confirmar eliminación" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">
            ¿Eliminás esta liga? Se borrarán también sus temporadas asociadas.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteId)}>
              Eliminar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
