import { useState, useEffect } from 'react';
import type { MarcaDTO } from '../types/produto';

interface MarcasModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken?: string;
  onMarcasAtualizadas?: () => void;
}

export function MarcasModal({
  isOpen,
  onClose,
  sessionToken,
  onMarcasAtualizadas
}: MarcasModalProps) {
  const [marcas, setMarcas] = useState<MarcaDTO[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário de nova marca
  const [nome, setNome] = useState('');
  const [percentual, setPercentual] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Edição em linha
  const [marcaEditandoId, setMarcaEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [percentualEdicao, setPercentualEdicao] = useState('');

  const carregarMarcas = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const res = await fetch('/api/marcas', { headers });
      if (!res.ok) {
        throw new Error('Falha ao carregar marcas.');
      }
      const data = await res.json();
      setMarcas(data);
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar marcas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarMarcas();
      setNome('');
      setPercentual('');
      setMarcaEditandoId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCadastrarMarca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSalvando(true);
    setErro(null);

    const percentualNumero = percentual.trim() !== '' ? parseFloat(percentual.replace(',', '.')) : null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch('/api/marcas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nome: nome.trim(),
          percentual_padrao: percentualNumero
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erro ao cadastrar marca.');
      }

      setNome('');
      setPercentual('');
      await carregarMarcas();
      onMarcasAtualizadas?.();
    } catch (err: any) {
      setErro(err.message || 'Erro ao cadastrar marca.');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEdicao = async (id: string) => {
    if (!nomeEdicao.trim()) return;
    setSalvando(true);
    setErro(null);

    const percentualNumero = percentualEdicao.trim() !== '' ? parseFloat(percentualEdicao.replace(',', '.')) : null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(`/api/marcas/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          nome: nomeEdicao.trim(),
          percentual_padrao: percentualNumero
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erro ao atualizar marca.');
      }

      setMarcaEditandoId(null);
      await carregarMarcas();
      onMarcasAtualizadas?.();
    } catch (err: any) {
      setErro(err.message || 'Erro ao atualizar marca.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirMarca = async (id: string, nomeMarca: string) => {
    if (!window.confirm(`Deseja realmente excluir a marca "${nomeMarca}"?`)) return;
    setErro(null);

    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(`/api/marcas/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erro ao excluir marca.');
      }

      await carregarMarcas();
      onMarcasAtualizadas?.();
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir marca.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-raised border border-border-hairline rounded-lg w-full max-w-lg shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-border-hairline flex items-center justify-between bg-surface-sunken">
          <div>
            <h2 className="text-title-lg font-bold text-ink-primary">Marcas & Percentuais</h2>
            <p className="text-meta text-ink-secondary">
              Defina o desconto padrão das suas marcas para cálculo automático de custo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-border-hairline text-ink-secondary font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="p-3 mx-4 mt-3 bg-status-alert-bg border border-status-alert text-status-alert rounded-md text-body-md">
            ⚠️ {erro}
          </div>
        )}

        {/* Lista e Formulário com Rolagem */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* Formulário de Adicionar Marca */}
          <form onSubmit={handleCadastrarMarca} className="p-4 bg-surface-base border border-border-hairline rounded-lg flex flex-col gap-3">
            <h3 className="text-label-strong text-ink-primary font-bold">Adicionar Nova Marca</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-meta text-ink-secondary mb-1">
                  Nome da Marca <span className="text-brand-primary">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Natura, Avon, Boticário"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full min-h-[44px] px-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-body-md focus:outline-brand-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-meta text-ink-secondary mb-1">
                  Desconto / Lucro Médio (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="Ex: 30"
                  value={percentual}
                  onChange={(e) => setPercentual(e.target.value)}
                  className="w-full min-h-[44px] px-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-body-md focus:outline-brand-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={salvando || !nome.trim()}
              className="min-h-touch-target bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-ink-inverse font-semibold text-label-strong rounded-md flex items-center justify-center gap-2 mt-1 shadow-sm transition-colors"
            >
              {salvando ? 'Salvando...' : '+ Cadastrar Marca'}
            </button>
          </form>

          {/* Listagem de Marcas Existentes */}
          <div className="flex flex-col gap-2">
            <h3 className="text-label-strong text-ink-primary font-bold">
              Marcas Cadastradas ({marcas.length})
            </h3>

            {carregando ? (
              <div className="p-6 text-center text-ink-secondary">Carregando marcas...</div>
            ) : marcas.length === 0 ? (
              <div className="p-6 text-center text-ink-secondary border border-dashed border-border-hairline rounded-lg">
                Nenhuma marca cadastrada ainda. Cadastre suas marcas acima para calcular custos automáticos!
              </div>
            ) : (
              marcas.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-surface-raised border border-border-hairline rounded-lg flex items-center justify-between shadow-sm"
                >
                  {marcaEditandoId === m.id ? (
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 items-center mr-2">
                      <input
                        type="text"
                        value={nomeEdicao}
                        onChange={(e) => setNomeEdicao(e.target.value)}
                        className="flex-1 min-h-[40px] px-2 border border-border-strong rounded-md bg-surface-base text-ink-primary text-body-md"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={percentualEdicao}
                          onChange={(e) => setPercentualEdicao(e.target.value)}
                          placeholder="%"
                          className="w-20 min-h-[40px] px-2 border border-border-strong rounded-md bg-surface-base text-ink-primary text-body-md"
                        />
                        <span className="text-meta text-ink-secondary">%</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleSalvarEdicao(m.id)}
                          className="px-3 py-2 bg-brand-primary text-ink-inverse text-meta font-bold rounded-md"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarcaEditandoId(null)}
                          className="px-2 py-2 bg-surface-sunken text-ink-secondary text-meta rounded-md"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="text-body-lg font-bold text-ink-primary">{m.nome}</span>
                        <div className="text-meta text-ink-secondary">
                          {m.percentual_padrao !== null ? (
                            <span className="text-status-available font-semibold">
                              {m.percentual_padrao}% de desconto estimado
                            </span>
                          ) : (
                            <span className="text-ink-muted">Sem percentual definido</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMarcaEditandoId(m.id);
                            setNomeEdicao(m.nome);
                            setPercentualEdicao(m.percentual_padrao !== null ? String(m.percentual_padrao) : '');
                          }}
                          className="p-2 text-ink-secondary hover:text-brand-primary text-meta font-medium rounded-md hover:bg-surface-sunken"
                          title="Editar Marca"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirMarca(m.id, m.nome)}
                          className="p-2 text-status-alert hover:text-red-700 text-meta font-medium rounded-md hover:bg-status-alert-bg"
                          title="Excluir Marca"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-border-hairline bg-surface-sunken flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch-target px-6 bg-surface-raised border border-border-strong text-ink-primary font-semibold text-label-strong rounded-md shadow-sm hover:bg-surface-base"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
