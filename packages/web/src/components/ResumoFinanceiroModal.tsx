import { useState, useEffect } from 'react';

interface ResumoFinanceiroDTO {
  total_vendido_centavos: number;
  total_vendido_formatado: string;
  total_recebido_bruto_centavos: number;
  total_recebido_bruto_formatado: string;
  total_taxas_cartao_centavos: number;
  total_taxas_cartao_formatado: string;
  total_recebido_liquido_centavos: number;
  total_recebido_liquido_formatado: string;
  total_a_receber_centavos: number;
  total_a_receber_formatado: string;
  total_devolvido_centavos: number;
  total_devolvido_formatado: string;
  total_creditos_ativos_centavos: number;
  total_creditos_ativos_formatado: string;
  observacao_metrica: string;
}

interface ResumoFinanceiroModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBaseUrl?: string;
  sessionToken?: string;
  refreshKey?: number;
}

export function ResumoFinanceiroModal({
  isOpen,
  onClose,
  apiBaseUrl = '/api',
  sessionToken,
  refreshKey
}: ResumoFinanceiroModalProps) {
  const [resumo, setResumo] = useState<ResumoFinanceiroDTO | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      carregarResumo();
    }
  }, [isOpen, refreshKey]);

  const carregarResumo = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/relatorios/resumo-financeiro`, { headers });
      if (!res.ok) {
        throw new Error('Não foi possível carregar o resumo financeiro.');
      }
      const data = await res.json();
      setResumo(data);
    } catch (err: any) {
      setErro(err.message || 'Erro ao consultar resumo financeiro.');
    } finally {
      setCarregando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Painel de Resumo Financeiro"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-surface-raised rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-border-hairline">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border-hairline pb-3">
          <div>
            <span className="text-meta text-ink-secondary font-medium">Painel Gerencial (Story 5.5)</span>
            <h2 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
              <span>📊</span>
              <span>Resumo Financeiro da Operação</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar resumo financeiro"
            className="w-10 h-10 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-sunken text-title-md transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
          {carregando ? (
            <div className="p-8 text-center text-ink-secondary text-body-md animate-pulse">
              Calculando indicadores consolidados em tempo real...
            </div>
          ) : erro ? (
            <div className="p-4 bg-status-alert-bg border border-status-alert text-status-alert rounded-lg text-body-md">
              {erro}
            </div>
          ) : resumo ? (
            <>
              {/* Grid de Indicadores Principais */}
              <div className="grid grid-cols-2 gap-3">
                {/* Total Vendido */}
                <div className="bg-surface-sunken border border-border-hairline rounded-xl p-3.5 flex flex-col justify-between">
                  <span className="text-meta font-bold text-ink-secondary uppercase tracking-wider">
                    Total Vendido
                  </span>
                  <p className="text-title-lg font-extrabold text-ink-primary mt-1">
                    {resumo.total_vendido_formatado}
                  </p>
                  <span className="text-[11px] text-ink-muted mt-0.5">
                    Soma de todas as compras ativas
                  </span>
                </div>

                {/* Total a Receber */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <span className="text-meta font-bold text-amber-800 uppercase tracking-wider">
                    Total a Receber (Em Aberto)
                  </span>
                  <p className="text-title-lg font-extrabold text-amber-900 mt-1">
                    {resumo.total_a_receber_formatado}
                  </p>
                  <span className="text-[11px] text-amber-700 mt-0.5">
                    Saldo fiado / aguardando pagamento
                  </span>
                </div>

                {/* Total Recebido Líquido */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-meta font-bold text-emerald-800 uppercase tracking-wider">
                      Total Efetivamente Recebido (No Bolso)
                    </span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      Líquido
                    </span>
                  </div>
                  <p className="text-2xl font-black text-emerald-900 mt-1">
                    {resumo.total_recebido_liquido_formatado}
                  </p>
                  <div className="flex items-center justify-between text-xs text-emerald-700 mt-1 pt-1 border-t border-emerald-200/60">
                    <span>Bruto recebido: {resumo.total_recebido_bruto_formatado}</span>
                    <span>Taxas maquininha absorvidas: {resumo.total_taxas_cartao_formatado}</span>
                  </div>
                </div>

                {/* Total Devolvido a Clientes */}
                <div className="bg-surface-sunken border border-border-hairline rounded-xl p-3.5 flex flex-col justify-between">
                  <span className="text-meta font-bold text-ink-secondary uppercase tracking-wider">
                    Total Devolvido
                  </span>
                  <p className="text-title-md font-bold text-ink-primary mt-1">
                    {resumo.total_devolvido_formatado}
                  </p>
                  <span className="text-[11px] text-ink-muted mt-0.5">
                    Excedentes devolvidos em Dinheiro/Pix
                  </span>
                </div>

                {/* Créditos Ativos em Carteiras */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <span className="text-meta font-bold text-blue-800 uppercase tracking-wider">
                    Créditos Ativos em Carteiras
                  </span>
                  <p className="text-title-md font-bold text-blue-900 mt-1">
                    {resumo.total_creditos_ativos_formatado}
                  </p>
                  <span className="text-[11px] text-blue-700 mt-0.5">
                    Créditos de clientes para próximas compras
                  </span>
                </div>
              </div>

              {/* Nota Explicativa Metodológica (FR-041, NFR-010) */}
              <div className="p-3 bg-surface-sunken border border-border-hairline rounded-xl text-xs text-ink-secondary flex items-start gap-2">
                <span className="text-base">ℹ️</span>
                <div>
                  <span className="font-bold text-ink-primary block mb-0.5">
                    Transparência de Gestão Financeira:
                  </span>
                  <span>
                    As métricas separam rigorosamente o compromisso de venda do dinheiro real em caixa. Taxas de maquininha são computadas como custo de absorção e não penalizam a quitação das clientes. Não é calculado lucro presumido prematuro.
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Rodapé */}
        <div className="border-t border-border-hairline pt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch-target px-6 bg-surface-sunken hover:bg-border-hairline text-ink-primary font-semibold rounded-md transition-colors"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
}
