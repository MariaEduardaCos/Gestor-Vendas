import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { limparTentativasDeLogin, hashPin, conferirPin } from '../src/routes/auth.js';
import { limparOperacoes } from './helpers.js';

const prisma = new PrismaClient();

async function idsDasOperacoesComUsuario(prefixo: string) {
  const ops = await prisma.operador.findMany({ where: { usuario: { startsWith: prefixo } }, select: { operacao_id: true } });
  return [...new Set(ops.map((o) => o.operacao_id))];
}

describe('PIN guardado com sal', () => {
  it('gera hashes diferentes para o mesmo PIN e confere corretamente', () => {
    const a = hashPin('4321');
    const b = hashPin('4321');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(conferirPin('4321', a)).toBe(true);
    expect(conferirPin('1234', a)).toBe(false);
  });
});

describe('Cadastro, entrada com usuário + PIN e troca de acesso', () => {
  const app = buildApp({ prisma });

  beforeEach(() => limparTentativasDeLogin());

  afterAll(async () => {
    await limparOperacoes(prisma, await idsDasOperacoesComUsuario('teste.auth'));
    await app.close();
  });

  it('cria o negócio e já devolve a sessão da revendedora', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/cadastro',
      payload: { nome_negocio: 'Revenda da Ana', nome: 'Ana', usuario: 'Teste.Auth.Ana', pin: '2580' }
    });
    expect(res.statusCode).toBe(201);
    const corpo = res.json();
    expect(corpo.session.usuario).toBe('teste.auth.ana');
    const sessao = await app.inject({ method: 'GET', url: '/api/auth/session', headers: { authorization: `Bearer ${corpo.token}` } });
    expect(sessao.json()).toMatchObject({ operador_nome: 'Ana', usuario: 'teste.auth.ana', possui_pin: true });
  });

  it('recusa usuário repetido, usuário inválido e PIN fora da regra', async () => {
    const repetido = await app.inject({
      method: 'POST',
      url: '/api/auth/cadastro',
      payload: { nome_negocio: 'Outra', nome: 'Outra Ana', usuario: 'teste.auth.ana', pin: '1111' }
    });
    expect(repetido.statusCode).toBe(409);

    const usuarioRuim = await app.inject({
      method: 'POST',
      url: '/api/auth/cadastro',
      payload: { nome_negocio: 'X', nome: 'X', usuario: 'a b', pin: '1111' }
    });
    expect(usuarioRuim.statusCode).toBe(400);

    const pinRuim = await app.inject({
      method: 'POST',
      url: '/api/auth/cadastro',
      payload: { nome_negocio: 'X', nome: 'X', usuario: 'teste.auth.pin', pin: '12a4' }
    });
    expect(pinRuim.statusCode).toBe(400);
  });

  it('entra com usuário + PIN e usa a mesma mensagem para usuário inexistente e PIN errado', async () => {
    const ok = await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'TESTE.AUTH.ANA ', pin: '2580' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().token).toBeTruthy();

    const pinErrado = await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'teste.auth.ana', pin: '0000' } });
    const inexistente = await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'teste.auth.ninguem', pin: '0000' } });
    expect(pinErrado.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(pinErrado.json().detail).toBe(inexistente.json().detail);
  });

  it('bloqueia o usuário depois de 5 PINs errados, mesmo que o sexto esteja certo', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'teste.auth.ana', pin: '9999' } });
      expect(r.statusCode).toBe(401);
    }
    const bloqueado = await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'teste.auth.ana', pin: '2580' } });
    expect(bloqueado.statusCode).toBe(429);
  });

  it('troca usuário e PIN só com o PIN atual correto', async () => {
    const token = (await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'teste.auth.ana', pin: '2580' } })).json().token;
    const auth = { authorization: `Bearer ${token}` };

    const semPinAtual = await app.inject({ method: 'PUT', url: '/api/auth/acesso', headers: auth, payload: { usuario: 'teste.auth.ana2', pin_novo: '1357' } });
    expect(semPinAtual.statusCode).toBe(401);

    const trocado = await app.inject({
      method: 'PUT',
      url: '/api/auth/acesso',
      headers: auth,
      payload: { usuario: 'teste.auth.ana2', pin_atual: '2580', pin_novo: '1357' }
    });
    expect(trocado.statusCode).toBe(200);

    const antigo = await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'teste.auth.ana', pin: '2580' } });
    expect(antigo.statusCode).toBe(401);
    const novo = await app.inject({ method: 'POST', url: '/api/auth/entrar', payload: { usuario: 'teste.auth.ana2', pin: '1357' } });
    expect(novo.statusCode).toBe(200);
  });

  it('em desenvolvimento a conta de demonstração continua disponível', async () => {
    const config = await app.inject({ method: 'GET', url: '/api/auth/config' });
    expect(config.json().modo_desenvolvimento).toBe(true);
  });
});

describe('Produção: sem atalhos de desenvolvimento', () => {
  const envOriginal = { NODE_ENV: process.env.NODE_ENV, SESSION_SECRET: process.env.SESSION_SECRET, ALLOW: process.env.ALLOW_DEV_SESSION };
  let app: ReturnType<typeof buildApp>;

  const restaurar = (chave: string, valor: string | undefined) => {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEV_SESSION;
    process.env.SESSION_SECRET = 'segredo-de-producao-com-mais-de-32-caracteres';
    app = buildApp({ prisma });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await limparOperacoes(prisma, await idsDasOperacoesComUsuario('teste.prod'));
    restaurar('NODE_ENV', envOriginal.NODE_ENV);
    restaurar('SESSION_SECRET', envOriginal.SESSION_SECRET);
    restaurar('ALLOW_DEV_SESSION', envOriginal.ALLOW);
  });

  it('a rota da conta de demonstração não existe', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/dev-session' });
    expect(res.statusCode).toBe(404);
    const config = await app.inject({ method: 'GET', url: '/api/auth/config' });
    expect(config.json().modo_desenvolvimento).toBe(false);
  });

  it('não entra por identificadores numa pessoa sem PIN', async () => {
    const cadastro = (await app.inject({
      method: 'POST',
      url: '/api/auth/cadastro',
      payload: { nome_negocio: 'Revenda Prod', nome: 'Bia', usuario: 'teste.prod.bia', pin: '2468' }
    })).json();
    const semPin = await prisma.operador.create({
      data: { id: crypto.randomUUID(), operacao_id: cadastro.session.operacao_id, nome: 'Ajudante sem PIN' }
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { operacao_id: cadastro.session.operacao_id, operador_id: semPin.id }
    });
    expect(res.statusCode).toBe(401);
  });

  it('recusa iniciar sem SESSION_SECRET', () => {
    const segredo = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      expect(() => buildApp({ prisma })).toThrow(/SESSION_SECRET/);
    } finally {
      process.env.SESSION_SECRET = segredo;
    }
  });
});

describe('Cadastro já com os produtos mais vendidos', () => {
  const app = buildApp({ prisma });
  const MARCA = 'Marca Teste Vitrine';
  const CHAVE = 'marca teste vitrine';

  beforeAll(async () => {
    await prisma.produtoReferencia.deleteMany({ where: { marca_chave: CHAVE } });
    // 70 produtos gravados fora de ordem: a conta nova deve receber os 60 primeiros da vitrine.
    for (let i = 70; i >= 1; i--) {
      await prisma.produtoReferencia.create({
        data: {
          id: `ref-vitrine-${i}`,
          marca_chave: CHAVE,
          marca_nome: MARCA,
          chave: `cod:${10000 + i}`,
          nome: `Produto ${i}`,
          codigo_revista: String(10000 + i),
          preco_sugerido_centavos: 1000 + i,
          ciclo: 'Ciclo teste',
          origem: 'OFICIAL',
          posicao: i
        }
      });
    }
  });

  afterAll(async () => {
    await limparOperacoes(prisma, await idsDasOperacoesComUsuario('teste.vitrine'));
    await prisma.produtoReferencia.deleteMany({ where: { marca_chave: CHAVE } });
    await app.close();
  });

  it('oferece a marca na configuração da tela de entrada', async () => {
    const config = (await app.inject({ method: 'GET', url: '/api/auth/config' })).json();
    expect(config.marcas_iniciais).toContainEqual({ marca: MARCA, produtos: 60 });
  });

  it('cria a marca e os 60 primeiros produtos da vitrine, ignorando marca sem catálogo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/cadastro',
      payload: { nome_negocio: 'Revenda Vitrine', nome: 'Bia', usuario: 'teste.vitrine.bia', pin: '2580', marcas_iniciais: [MARCA, 'Marca Que Nao Existe'] }
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().produtos_iniciais).toEqual({ [MARCA]: 60 });

    const [operacaoId] = await idsDasOperacoesComUsuario('teste.vitrine');
    const marcas = await prisma.marca.findMany({ where: { operacao_id: operacaoId } });
    expect(marcas.map((m) => m.nome)).toEqual([MARCA]);
    const produtos = await prisma.produto.findMany({ where: { operacao_id: operacaoId } });
    expect(produtos).toHaveLength(60);
    const codigos = produtos.map((p) => Number(p.codigo_revista));
    expect(Math.max(...codigos)).toBe(10060);
    expect(produtos.find((p) => p.codigo_revista === '10001')).toMatchObject({ nome: 'Produto 1', preco_venda_centavos: 1001 });
  });

  it('sem marcas escolhidas, cria a conta vazia como antes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/cadastro',
      payload: { nome_negocio: 'Revenda Vazia', nome: 'Cris', usuario: 'teste.vitrine.cris', pin: '2580' }
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().produtos_iniciais).toEqual({});
  });
});
