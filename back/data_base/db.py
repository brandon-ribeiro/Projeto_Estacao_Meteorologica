import os
import sqlite3
import json
from datetime import datetime


# CONFIGURAÇÃO
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'estacao_meteorologica.db')

# ESTRUTURAS SQL
LEITURAS = """
    CREATE TABLE IF NOT EXISTS leituras(
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        data_hora  TEXT,
        topico     TEXT,
        tipo       TEXT,
        payload    TEXT
    )
"""

DHT = """
    CREATE TABLE  IF NOT EXISTS dht_leituras(
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        leitura_id  INTEGER,
        temperatura REAL,
        humidade    REAL,
        FOREIGN KEY (leitura_id) REFERENCES leituras(id)
    )
"""

BMP = """
    CREATE TABLE  IF NOT EXISTS bmp_leituras(
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        leitura_id  INTEGER,
        temperatura REAL,
        pressao     REAL,
        FOREIGN KEY (leitura_id) REFERENCES leituras(id)
    )
"""

LDR = """
    CREATE TABLE  IF NOT EXISTS ldr_leituras(
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        leitura_id  INTEGER,
        value       REAL,
        FOREIGN KEY (leitura_id) REFERENCES leituras(id)
    )
""" 

MQ = """
    CREATE TABLE  IF NOT EXISTS mq_leituras(
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        leitura_id  INTEGER,
        value       REAL,
        FOREIGN KEY (leitura_id) REFERENCES leituras(id)
    )
"""

GPS = """
    CREATE TABLE  IF NOT EXISTS gps_leituras(
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        leitura_id  INTEGER,
        latitude    REAL,
        longitude   REAL,
        city        TEXT,
        state       TEXT,
        FOREIGN KEY (leitura_id) REFERENCES leituras(id)
    )
"""

SQL_SELECT = """
    SELECT l.*
    ,      dht.temperatura as dht_temp
    ,      dht.humidade
    ,      bmp.temperatura as bmp_temp
    ,      bmp.pressao
    ,      ldr.value as ldr_value
    ,      mq.value as mq_value
    ,      gps.latitude
    ,      gps.longitude
    ,      gps.city
    ,      gps.state
      FROM leituras l
      LEFT JOIN dht_leituras dht ON l.id = dht.leitura_id
      LEFT JOIN bmp_leituras bmp ON l.id = bmp.leitura_id
      LEFT JOIN ldr_leituras ldr ON l.id = ldr.leitura_id
      LEFT JOIN mq_leituras mq ON l.id = mq.leitura_id
      LEFT JOIN gps_leituras gps ON l.id = gps.leitura_id
"""


# FUNÇÕES E MÉTODOS
def get_connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    return conn


def create_tables():
    with get_connect() as conn:
        conn.execute(LEITURAS)
        conn.execute(DHT)
        conn.execute(BMP)
        conn.execute(LDR)
        conn.execute(MQ)
        conn.execute(GPS)


def process_data(topico, payload):
    date_hour = datetime.now().isoformat(timespec='seconds')
    try:
        data = json.loads(payload)

        if isinstance(data, dict):
            id_leitura = insert_dado_leitura(date_hour, topico, 'sensores', payload)

            local = data.get('localizacao') or {}
            insert_dados_gps(local, id_leitura)

            dht22 = data.get('dht22')
            insert_dados_dht(dht22, id_leitura)
            
            bmp280 = data.get('bmp280')
            insert_dados_bmp(bmp280, id_leitura)
            
            mq135 = data.get('mq135')
            insert_dados_mq(mq135, id_leitura)
            
            ldr = data.get('ldr')
            insert_dados_ldr(ldr, id_leitura)
        else:
            insert_dado_leitura(date_hour, topico, None, payload)
    except json.JSONDecodeError:
        insert_dado_leitura(date_hour, topico, None, payload)


def insert_dado_leitura(date_hour, topico, tipo, payload):
    with get_connect() as conn:
        cursor = conn.cursor()
        cursor.execute("""
                INSERT INTO leituras(data_hora, topico, tipo, payload)
                VALUES(?,?,?,?)
            """,
            (date_hour, topico, tipo, payload)
        )
        conn.commit()
        return cursor.lastrowid


def insert_dados_sensores(data, id_leitura):
    insert_dados_gps(data.get('mq135'), id_leitura)
    insert_dados_gps(data.get('localizacao'), id_leitura)
    insert_dados_dht(data.get('dht22'), id_leitura)
    insert_dados_bmp(data.get('bmp280'), id_leitura)
    insert_dados_ldr(data.get('ldr'), id_leitura)


def insert_dados_mq(data, id_leitura):
    data = data or {}
    with get_connect() as conn:
        cursor = conn.cursor()
        cursor.execute("""
                INSERT INTO mq_leituras(leitura_id, value)
                VALUES(?,?)
            """,
            (
                id_leitura, 
                data.get('air_quality'),
            )
        )
        conn.commit()
        return cursor.lastrowid


def insert_dados_gps(data, id_leitura):
    data = data or {}
    with get_connect() as conn:
        cursor = conn.cursor()
        cursor.execute("""
                INSERT INTO gps_leituras(leitura_id, latitude, longitude, city, state)
                VALUES(?,?,?,?,?)
            """,
            (   
                id_leitura,
                data.get('lat'), 
                data.get('lon'),
                data.get('cidade'),
                data.get('estado'),
            )
        )
        conn.commit()
        return cursor.lastrowid


def insert_dados_dht(data, id_leitura):
    data = data or {}
    with get_connect() as conn:
        cursor = conn.cursor()
        cursor.execute("""
                INSERT INTO dht_leituras(leitura_id, temperatura, humidade)
                VALUES(?,?,?)
            """,
            (
                id_leitura,
                data.get('temp'), 
                data.get('hum'),
            )
        )
        conn.commit()
        return cursor.lastrowid


def insert_dados_bmp(data, id_leitura):
    data = data or {}
    with get_connect() as conn:
        cursor = conn.cursor()
        cursor.execute("""
                INSERT INTO bmp_leituras(leitura_id, temperatura, pressao)
                VALUES(?,?,?)
            """,
            (
                id_leitura,
                data.get('temp'), 
                data.get('pressure'),
            )
        )
        conn.commit()
        return cursor.lastrowid


def insert_dados_ldr(data, id_leitura):
    data = data or {}
    with get_connect() as conn:
        cursor = conn.cursor()
        cursor.execute("""
                INSERT INTO ldr_leituras(leitura_id, value)
                VALUES(?,?)
            """,
            (
                id_leitura,
                data.get('lightness'), 
            )
        )
        conn.commit()
        return cursor.lastrowid


def find_history(limit=10, tipo=None):
    params = []
    sql = SQL_SELECT

    if tipo:
        sql += " WHERE l.tipo = ?"
        params.append(tipo)

    sql += " ORDER BY l.id DESC LIMIT ?"
    params.append(limit)

    with get_connect() as conn:
        result = conn.execute(sql, params).fetchall()

    return [dict(l) for l in result]
    

def find_last_leitura():
    sql = SQL_SELECT

    sql += " WHERE l.tipo = 'sensores'"
    sql += " ORDER BY l.id DESC LIMIT 1"
    
    with get_connect() as conn:
        result = conn.execute(sql).fetchone()

    return dict(result) if result else None
    

def find_by_id(id):
    sql = SQL_SELECT
    params = []

    if id:
        sql += " WHERE l.id = ?"
        params.append(id)
    else: 
        return []

    with get_connect() as conn:
        result = conn.execute(sql, params).fetchall()

    return [dict(l) for l in result]

