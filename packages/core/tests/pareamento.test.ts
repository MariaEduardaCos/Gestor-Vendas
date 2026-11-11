import { describe, it, expect } from 'vitest';
import {
  PAREAMENTO_TTL_PADRAO_MS,
  validarSessaoExpirada,
  calcularTempoRestanteMs,
  serializarMensagem,
  deserializarMensagem,
  type PareamentoMensagem
} from '../src/index.js';

describe('Story 1.6: Pareamento Efêmero - Protocolo e TTL (Core)', () => {
  it('deve ter 600.000 ms (10 minutos) como TTL padrão estrito (AD-6, FR-014)', () => {
    expect(PAREAMENTO_TTL_PADRAO_MS).toBe(10 * 60 * 1000);
    expect(PAREAMENTO_TTL_PADRAO_MS).toBe(600_000);
  });

  describe('validarSessaoExpirada e calcularTempoRestanteMs', () => {
    it('deve identificar que uma sessão recente não está expirada e calcular o tempo restante', () => {
      const criadoEm = 1_000_000;
      const agora = 1_000_000 + 300_000; // 5 minutos decorridos

      expect(validarSessaoExpirada(criadoEm, 600_000, agora)).toBe(false);
      expect(calcularTempoRestanteMs(criadoEm, 600_000, agora)).toBe(300_000);
    });

    it('deve identificar expiração exata e após os 10 minutos (600.000 ms)', () => {
      const criadoEm = 1_000_000;

      // 599.999 ms decorridos: ainda ativo
      expect(validarSessaoExpirada(criadoEm, 600_000, 1_599_999)).toBe(false);
      expect(calcularTempoRestanteMs(criadoEm, 600_000, 1_599_999)).toBe(1);

      // 600.000 ms decorridos: expirado
      expect(validarSessaoExpirada(criadoEm, 600_000, 1_600_000)).toBe(true);
      expect(calcularTempoRestanteMs(criadoEm, 600_000, 1_600_000)).toBe(0);

      // Mais de 10 minutos decorridos
      expect(validarSessaoExpirada(criadoEm, 600_000, 1_700_000)).toBe(true);
      expect(calcularTempoRestanteMs(criadoEm, 600_000, 1_700_000)).toBe(0);
    });

    it('deve aceitar datas em formato ISO string e objeto Date', () => {
      const baseDate = new Date('2026-11-11T12:00:00.000Z');
      const agoraDepoisDe9Min = new Date('2026-11-11T12:09:00.000Z').getTime();
      const agoraDepoisDe11Min = new Date('2026-11-11T12:11:00.000Z').getTime();

      expect(validarSessaoExpirada(baseDate.toISOString(), 600_000, agoraDepoisDe9Min)).toBe(false);
      expect(validarSessaoExpirada(baseDate, 600_000, agoraDepoisDe11Min)).toBe(true);
    });
  });

  describe('Protocolo de Mensagens (serializarMensagem e deserializarMensagem)', () => {
    it('deve serializar e desserializar mensagem do tipo SCAN', () => {
      const msg: PareamentoMensagem = {
        tipo: 'SCAN',
        codigo: '7891234567890',
        timestamp: '2026-11-11T12:00:00.000Z'
      };

      const raw = serializarMensagem(msg);
      expect(typeof raw).toBe('string');

      const parsed = deserializarMensagem(raw);
      expect(parsed).toEqual(msg);
    });

    it('deve normalizar mensagens no formato alternativo { event: "SCAN", code: "..." }', () => {
      const raw = JSON.stringify({
        event: 'SCAN',
        code: '  7899999999999  '
      });

      const parsed = deserializarMensagem(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.tipo).toBe('SCAN');
      if (parsed && parsed.tipo === 'SCAN') {
        expect(parsed.codigo).toBe('7899999999999');
        expect(parsed.timestamp).toBeDefined();
      }
    });

    it('deve desserializar mensagens de STATUS, PING, PONG e ERRO', () => {
      const statusMsg = JSON.stringify({
        tipo: 'STATUS',
        status: 'CONECTADO',
        detalhe: 'Celular conectado com sucesso',
        tempoRestanteMs: 500000
      });
      const parsedStatus = deserializarMensagem(statusMsg);
      expect(parsedStatus).toEqual({
        tipo: 'STATUS',
        status: 'CONECTADO',
        detalhe: 'Celular conectado com sucesso',
        tempoRestanteMs: 500000
      });

      expect(deserializarMensagem(JSON.stringify({ tipo: 'PING' }))).toEqual({ tipo: 'PING' });
      expect(deserializarMensagem(JSON.stringify({ tipo: 'PONG' }))).toEqual({ tipo: 'PONG' });
      expect(
        deserializarMensagem(JSON.stringify({ tipo: 'ERRO', motivo: 'Sessão expirada', codigo: 'EXPIRADO' }))
      ).toEqual({
        tipo: 'ERRO',
        motivo: 'Sessão expirada',
        codigo: 'EXPIRADO'
      });
    });

    it('deve retornar null para mensagens inválidas ou malformadas', () => {
      expect(deserializarMensagem('não é json')).toBeNull();
      expect(deserializarMensagem(JSON.stringify({ tipo: 'SCAN', codigo: '   ' }))).toBeNull();
      expect(deserializarMensagem(JSON.stringify({ tipo: 'DESCONHECIDO' }))).toBeNull();
      expect(deserializarMensagem(JSON.stringify(123))).toBeNull();
    });
  });
});
