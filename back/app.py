import json
import sqlite3
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_mqtt import Mqtt

# ================= CONFIGURAÇÃO =================
DB_PATH = 'estacao_meteorologica.db'
TOPIC_COMANDO = 'esp32/get'
TOPIC_STATUS  = 'esp32/post'

app = Flask(__name__)
app.config['MQTT_BROKER_URL'] = 'broker.emqx.io'
app.config['MQTT_BROKER_PORT'] = 1883
app.config['MQTT_KEEPALIVE'] = 60
app.config['MQTT_REFRESH_TIME'] = 1.0

CORS(app) 

mqtt = Mqtt(app)

# ================= BANCO DE DADOS =================
def get_conexao():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    return conn


def criar_tabela():
    with get_conexao() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS leituras (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                data_hora   TEXT NOT NULL,
                topico      TEXT,
                tipo        TEXT NOT NULL,
                mensagem    TEXT,
                dht_temp    REAL,
                dht_hum     REAL,
                ldr         INTEGER,
                bmp_press   REAL,
                bmp_temp    REAL,
                cidade      TEXT,
                estado      TEXT,
                ip_lat      REAL,
                ip_lon      REAL,
                payload     TEXT
            )
        ''')


def salvar_leitura(dados):
    colunas = ', '.join(dados.keys())
    marcadores = ', '.join(['?'] * len(dados))
    
    with get_conexao() as conn:
        conn.execute(   
            f'INSERT INTO leituras ({colunas}) VALUES ({marcadores})',
            list(dados.values())
        )


def buscar_ultima_leitura():
    with get_conexao() as conn:
        linha = conn.execute(
            "SELECT * FROM leituras WHERE tipo = 'sensores' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    
    return dict(linha) if linha else None


def listar_leituras(limite=10, tipo=None):
    sql = 'SELECT * FROM leituras'
    params = []
    
    if tipo:
        sql += ' WHERE tipo = ?'
        params.append(tipo)
    
    sql += ' ORDER BY id DESC LIMIT ?'
    params.append(limite)
    
    with get_conexao() as conn:
        linhas = conn.execute(sql, params).fetchall()
    
    return [dict(l) for l in linhas]


def apagar_leituras():
    with get_conexao() as conn:
        apagadas = conn.execute('DELETE FROM leituras').rowcount
    
    return apagadas


# ================= TRATAMENTO DAS MENSAGENS =================
def montar_registro_sensores(topico, payload, dados):
    local = dados.get('localizacao') or {}
    print(dados)
    return {
        'mensagem': dados.get('Telemetria'),
        'data_hora': datetime.now().isoformat(timespec='seconds'),
        'topico': topico,
        'tipo': 'sensores',
        'dht_temp': dados.get('DHT_temp'),
        'dht_hum': dados.get('DHT_hum'),
        'ldr': dados.get('LDR'),
        'bmp_press': dados.get('BMP_press'),
        'bmp_temp': dados.get('BMP_temp'),
        'cidade': local.get('cidade'),
        'estado': local.get('estado'),
        'ip_lat': local.get('lat'),
        'ip_lon': local.get('lon'),
        'payload': payload
    }

def montar_registro_texto(topico, payload):
    return {
        'data_hora': datetime.now().isoformat(timespec='seconds'),
        'topico': topico,
        'tipo': 'texto',
        'mensagem': payload,
        'payload': payload
    }


def processar_mensagem(topico, payload):
    try:
        dados = json.loads(payload)
        if isinstance(dados, dict):
            registro = montar_registro_sensores(topico, payload, dados)
        else:
            registro = montar_registro_texto(topico, payload)
    except json.JSONDecodeError:
        registro = montar_registro_texto(topico, payload)

    salvar_leitura(registro)
    print(f"[DB] Salvo ({registro['tipo']}): {payload}")


# ================= MQTT =================
@mqtt.on_connect()
def handle_connect(client, userdata, flags, rc):
    if rc == 0:
        print('Conectado ao MQTT Broker')
        mqtt.subscribe(TOPIC_STATUS)
    else:
        print('Falha na conexão, código =', rc)


@mqtt.on_message()
def handle_mqtt_message(client, userdata, message):
    payload = message.payload.decode()
    print(message.payload) 
    dados = json.loads(payload)
    print(dados)
    try:
        processar_mensagem(message.topic, payload)
    except Exception as e:
        print('[ERRO] Ao processar mensagem:', e)


# ================= ROTAS =================
@app.route('/comando', methods=['POST'])
def rota_comando():
    req_data = request.get_json(silent=True) or {}
    comando = req_data.get('message', 'SHOW')
    mqtt.publish(TOPIC_COMANDO, comando)
    
    return jsonify({'status': 'success', 'topic': TOPIC_COMANDO, 'message': comando})


@app.route('/dados', methods=['GET'])
def rota_dados():
    leitura = buscar_ultima_leitura()
    
    if not leitura:
        return jsonify({'erro': 'Nenhuma leitura de sensores ainda'}), 404
    
    return jsonify(leitura)


@app.route('/historico', methods=['GET'])
def rota_historico():
    limite = request.args.get('limite', default=10, type=int)
    tipo = request.args.get('tipo')  # 'sensores', 'texto' ou vazio
    
    return jsonify(listar_leituras(limite, tipo))


@app.route('/historico', methods=['DELETE'])
def rota_apagar():
    return jsonify({'apagadas': apagar_leituras()})


# ================= INÍCIO =================
if __name__ == '__main__':
    criar_tabela()
    app.run(debug=False, use_reloader=False)

