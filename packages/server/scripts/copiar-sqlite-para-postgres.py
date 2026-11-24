#!/usr/bin/env python3
"""
Copia os dados do banco antigo (SQLite, prisma/dev.db) para um PostgreSQL já com as tabelas criadas
(rode antes `npx prisma db push` com o DATABASE_URL do destino).

Uso (o endereço vem de variável de ambiente, nunca da linha de comando, para não ficar no histórico):
    DESTINO_URL='postgresql://...' python3 scripts/copiar-sqlite-para-postgres.py [prisma/dev.db]

Só copia para tabelas vazias: se o destino já tiver dados numa tabela, ela é pulada e avisada.
Tudo roda numa transação só: se algo falhar, nada é gravado.
"""
import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone

origem = sys.argv[1] if len(sys.argv) > 1 else 'prisma/dev.db'
destino = os.environ.get('DESTINO_URL')
if not destino:
    sys.exit('Defina DESTINO_URL com o endereço do PostgreSQL de destino.')


def psql(sql: str, *extra: str) -> str:
    r = subprocess.run(['psql', destino, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', *extra],
                       input=sql, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(r.stderr)
    return r.stdout


# Tipos das colunas no destino
tipos = {}
for linha in psql("""select table_name, column_name, data_type from information_schema.columns
                     where table_schema = current_schema()""").splitlines():
    t, c, d = linha.split('|')
    tipos.setdefault(t, {})[c] = d

# Ordem que respeita as chaves estrangeiras (pais antes dos filhos)
deps = {t: set() for t in tipos}
for linha in psql("""select tc.table_name, ccu.table_name from information_schema.table_constraints tc
                     join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
                     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = current_schema()""").splitlines():
    filho, pai = linha.split('|')
    if filho != pai and filho in deps:
        deps[filho].add(pai)
ordem, feitas = [], set()
while len(ordem) < len(deps):
    prontas = [t for t in deps if t not in feitas and deps[t] <= feitas]
    if not prontas:
        sys.exit('Dependência circular entre tabelas: ' + ', '.join(t for t in deps if t not in feitas))
    for t in sorted(prontas):
        ordem.append(t)
        feitas.add(t)

contagens = {}
for linha in psql(' union all '.join(f"select '{t}', count(*) from \"{t}\"" for t in ordem)).splitlines():
    t, n = linha.split('|')
    contagens[t] = int(n)


def literal(valor, tipo):
    if valor is None:
        return 'NULL'
    if tipo.startswith('timestamp'):
        if isinstance(valor, (int, float)):
            valor = datetime.fromtimestamp(valor / 1000, tz=timezone.utc).isoformat()
        return "'" + str(valor).replace("'", "''") + "'"
    if tipo == 'boolean':
        return 'TRUE' if valor in (1, '1', True, 'true') else 'FALSE'
    if tipo in ('integer', 'bigint', 'double precision', 'numeric', 'real', 'smallint'):
        return str(valor)
    if tipo == 'jsonb':
        return "'" + str(valor).replace("'", "''") + "'::jsonb"
    return "'" + str(valor).replace("'", "''") + "'"


db = sqlite3.connect(origem)
tabelas_origem = {r[0] for r in db.execute("select name from sqlite_master where type='table'")}
sql = ['BEGIN;']
resumo = []
for t in ordem:
    if t not in tabelas_origem:
        continue
    if contagens.get(t, 0) > 0:
        resumo.append(f'{t}: PULADA (destino já tem {contagens[t]} linhas)')
        continue
    cur = db.execute(f'select * from "{t}"')
    colunas = [d[0] for d in cur.description if d[0] in tipos[t]]
    linhas = cur.fetchall()
    nomes = [d[0] for d in cur.description]
    for linha in linhas:
        reg = dict(zip(nomes, linha))
        valores = ', '.join(literal(reg[c], tipos[t][c]) for c in colunas)
        sql.append(f'INSERT INTO "{t}" ({", ".join(chr(34) + c + chr(34) for c in colunas)}) VALUES ({valores});')
    resumo.append(f'{t}: {len(linhas)}')
sql.append('COMMIT;')
psql('\n'.join(sql))
print('Copiado:\n  ' + '\n  '.join(resumo))
