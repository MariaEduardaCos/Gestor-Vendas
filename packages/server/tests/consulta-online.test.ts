import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { limparOperacoes } from './helpers.js';
import { gerarUuidV7, interpretarTextoCatalogo } from '@consultorasync/core';
import { carregarCatalogoOficial } from '../src/services/catalogo-oficial.js';
import { consultarCodigoOnline, FontesIndisponiveis, type Buscador } from '../src/services/consulta-online.js';

const CODIGO = '7908132258012'; // dígito verificador válido
const OUTRO = '7896000000019';

describe('Pesquisa online por código de barras e carga oficial da campanha', () => {
  const prisma = new PrismaClient();
  const chamadas: string[] = [];
  let respostas: Record<string, { status: number; corpo?: unknown } | 'erro'> = {};
  const buscador: Buscador = async (url) => {
    chamadas.push(url);
    const r = Object.entries(respostas).find(([parte]) => url.includes(parte))?.[1] ?? { status: 404 };
    if (r === 'erro') throw new Error('rede fora');
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.corpo };
  };
  const app = buildApp({ prisma, buscadorOnline: buscador });
  const operacao = gerarUuidV7();
  const operador = gerarUuidV7();
  const MARCA = 'Marca Oficial Teste';
  let token: string;
  const auth = () => ({ authorization: `Bearer ${token}` });
  const env = { COSMOS_TOKEN: 't1', SI5_TOKEN: 't2' };

  beforeAll(async () => {
    await prisma.operacao.create({ data: { id: operacao, nome: 'Op Online' } });
    await prisma.operador.create({ data: { id: operador, operacao_id: operacao, nome: 'Revendedora' } });
    token = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacao, operador_id: operador } })).json().token;
  });

  beforeEach(async () => {
    chamadas.length = 0;
    respostas = {};
    await prisma.consultaCodigoOnline.deleteMany({ where: { codigo_barras: { in: [CODIGO, OUTRO] } } });
  });

  afterAll(async () => {
    await limparOperacoes(prisma, [operacao]);
    await prisma.consultaCodigoOnline.deleteMany({ where: { codigo_barras: { in: [CODIGO, OUTRO] } } });
    await prisma.produtoReferencia.deleteMany({ where: { marca_chave: 'marca oficial teste' } });
    await prisma.$disconnect();
  });

  it('Cosmos traz nome, marca, preço médio e foto; a segunda consulta vem do que ficou guardado', async () => {
    respostas = {
      'cosmos.bluesoft': { status: 200, corpo: { description: 'EKOS MARACUJA 200ML', avg_price: 49.9, thumbnail: 'https://cdn.exemplo.com/f.jpg', brand: { name: 'NATURA' } } }
    };
    const r1 = await consultarCodigoOnline(prisma, CODIGO, { buscador, env });
    expect(r1).toEqual({
      encontrado: true,
      do_cache: false,
      produto: { nome: 'EKOS MARACUJA 200ML', marca_nome: 'NATURA', preco_medio_centavos: 4990, imagem_url: 'https://cdn.exemplo.com/f.jpg', fonte: 'Cosmos Bluesoft' }
    });
    expect(chamadas).toHaveLength(1);
    const r2 = await consultarCodigoOnline(prisma, CODIGO, { buscador, env });
    expect(r2.do_cache).toBe(true);
    expect(r2.produto?.preco_medio_centavos).toBe(4990);
    expect(chamadas).toHaveLength(1);
  });

  it('passa para a fonte seguinte quando a primeira não conhece ou está fora do ar; recusa foto sem https', async () => {
    respostas = {
      'cosmos.bluesoft': 'erro',
      'si5.com.br': { status: 404 },
      openbeautyfacts: { status: 200, corpo: { status: 1, product: { product_name: 'Ekos Maracujá', brands: 'Ekos, Natura', image_url: 'http://sem-https.exemplo/f.jpg' } } }
    };
    const r = await consultarCodigoOnline(prisma, CODIGO, { buscador, env });
    expect(r.produto).toEqual({ nome: 'Ekos Maracujá', marca_nome: 'Natura', preco_medio_centavos: null, imagem_url: null, fonte: 'Open Beauty Facts' });
    expect(chamadas).toHaveLength(3);
  });

  it('nenhuma fonte conhece: guarda "não encontrado"; todas fora do ar: avisa e não guarda', async () => {
    const r = await consultarCodigoOnline(prisma, CODIGO, { buscador, env });
    expect(r).toEqual({ encontrado: false, produto: null, do_cache: false });
    expect((await consultarCodigoOnline(prisma, CODIGO, { buscador, env })).do_cache).toBe(true);

    respostas = { 'cosmos.bluesoft': 'erro', 'si5.com.br': { status: 429 }, openbeautyfacts: 'erro' };
    await expect(consultarCodigoOnline(prisma, OUTRO, { buscador, env })).rejects.toBeInstanceOf(FontesIndisponiveis);
    expect(await prisma.consultaCodigoOnline.findUnique({ where: { codigo_barras: OUTRO } })).toBeNull();
    await expect(consultarCodigoOnline(prisma, OUTRO, { buscador, env: { CONSULTA_ONLINE: '0' } })).rejects.toBeInstanceOf(FontesIndisponiveis);
  });

  it('rota: exige sessão, recusa código da revista e dígito errado, devolve os dados e aceita a foto no cadastro', async () => {
    expect((await app.inject({ method: 'GET', url: `/api/produtos/consulta-online/${CODIGO}` })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/produtos/consulta-online/71612', headers: auth() })).statusCode).toBe(400);
    const errado = await app.inject({ method: 'GET', url: '/api/produtos/consulta-online/7908132258013', headers: auth() });
    expect(errado.statusCode).toBe(400);
    expect(errado.json().detail).toMatch(/número errado/);
    expect(chamadas).toHaveLength(0);

    respostas = { openbeautyfacts: { status: 200, corpo: { status: 1, product: { product_name_pt: 'Ekos Maracujá', brands: 'Natura', image_url: 'https://img.exemplo/f.jpg' } } } };
    const res = await app.inject({ method: 'GET', url: `/api/produtos/consulta-online/790%208132-258012`, headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ codigo_barras: CODIGO, encontrado: true, nome: 'Ekos Maracujá', imagem_url: 'https://img.exemplo/f.jpg', preco_medio_centavos: null });

    const criado = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: auth(),
      payload: { nome: 'Ekos Maracujá', codigo_barras: CODIGO, preco_venda_centavos: 4990, imagem_url: 'https://img.exemplo/f.jpg' }
    });
    expect(criado.json().imagem_url).toBe('https://img.exemplo/f.jpg');
    const semHttps = await app.inject({ method: 'PUT', url: `/api/produtos/${criado.json().id}`, headers: auth(), payload: { imagem_url: 'javascript:alert(1)' } });
    expect(semHttps.json().imagem_url).toBeNull();
  });

  it('carga oficial da campanha: vale para todas, só a campanha atual aparece e a comunidade não sobrescreve', async () => {
    const lista = (t: string) => interpretarTextoCatalogo(t).linhas;
    await carregarCatalogoOficial(prisma, MARCA, 'Ciclo 16', lista('11111;Sabonete Antigo;;9,90\n22222;Perfume;100ml;189,90'));
    const carga = await carregarCatalogoOficial(prisma, MARCA, 'Ciclo 17', lista('22222;Perfume;100ml;199,90\n33333;Batom;Rosa;29,90'));
    expect(carga).toMatchObject({ criados: 1, atualizados: 1, total: 2 });

    const marcaId = (await app.inject({ method: 'POST', url: '/api/marcas', headers: auth(), payload: { nome: MARCA, percentual_padrao: 30 } })).json().id;
    const marcas = (await app.inject({ method: 'GET', url: '/api/marcas', headers: auth() })).json();
    expect(marcas.find((m: { id: string }) => m.id === marcaId)).toMatchObject({ catalogo_oficial_ciclo: 'Ciclo 17', catalogo_compartilhado_quantidade: 2 });

    const ref = (await app.inject({ method: 'GET', url: `/api/marcas/${marcaId}/catalogo-compartilhado`, headers: auth() })).json();
    expect(ref).toMatchObject({ ciclo: 'Ciclo 17', oficial: true, quantidade: 2 });
    expect(ref.itens.map((i: { nome: string }) => i.nome).sort()).toEqual(['Batom', 'Perfume']);

    // pelo código da revista, a revendedora já recebe nome e preço da campanha
    const sugestao = (await app.inject({ method: 'GET', url: '/api/catalogo-compartilhado/codigo/33333', headers: auth() })).json();
    expect(sugestao).toEqual([expect.objectContaining({ nome: 'Batom', preco_sugerido_centavos: 2990, ciclo: 'Ciclo 17', oficial: true })]);

    // revendedora carrega o mesmo ciclo com preço diferente e compartilha: o dado oficial fica
    await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaId}/catalogo`,
      headers: auth(),
      payload: { ciclo: 'Ciclo 17', itens: [{ codigoBarras: null, codigoRevista: '33333', nome: 'Batom', variante: 'Rosa', precoVendaCentavos: 100 }] }
    });
    const depois = await prisma.produtoReferencia.findFirst({ where: { marca_chave: 'marca oficial teste', codigo_revista: '33333' } });
    expect(depois).toMatchObject({ preco_sugerido_centavos: 2990, origem: 'OFICIAL' });
  });
});
