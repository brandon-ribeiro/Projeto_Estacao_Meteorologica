import data_base as db
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_mqtt import Mqtt


# CONFIGURAÇÃO
TOPIC_COMANDO = 'esp32/get'
TOPIC_STATUS  = 'esp32/post'

app = Flask(__name__)
app.config['MQTT_BROKER_URL'] = 'broker.emqx.io'
app.config['MQTT_BROKER_PORT'] = 1883
app.config['MQTT_KEEPALIVE'] = 60
app.config['MQTT_REFRESH_TIME'] = 1.0


CORS(app) 
mqtt = Mqtt(app)


# MQTT
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
    try:
        db.process_data(message.topic, payload)
        print('[DONE] Inclusão realizada')
    except Exception as e:
        print('[ERRO] Ao processar mensagem:', e)


# ROTAS
@app.route('/comando', methods=['POST'])
def rota_comando():
    req_data = request.get_json(silent=True) or {}
    comando = req_data.get('message', 'SHOW')
    mqtt.publish(TOPIC_COMANDO, comando)
    
    return jsonify({'status': 'success', 'topic': TOPIC_COMANDO, 'message': comando})


@app.route('/dados', methods=['GET'])
def rota_dados():
    leitura = db.find_last_leitura()
    
    if not leitura:
        return jsonify({'erro': 'Nenhuma leitura de sensores ainda'}), 404
    
    return jsonify(leitura)


@app.route('/historico', methods=['GET'])
def rota_historico():
    limite = request.args.get('limite', default=10, type=int)
    tipo = request.args.get('tipo')
    
    return jsonify(db.find_history(limite, tipo))



@app.route('/historico/periodo', methods=['GET'])
def rota_historico_periodo():
    horas = request.args.get('horas', default=3, type=float)
    pontos = request.args.get('pontos', default=60, type=int)
    
    return jsonify(db.find_periodo(horas, pontos))


@app.route('/resumo/diario', methods=['GET'])
def rota_resumo_diario():
    dias = request.args.get('dias', default=7, type=int)
    
    return jsonify(db.find_resumo_diario(dias))


# INÍCIO
if __name__ == '__main__':
    db.create_tables()
    app.run(debug=False, use_reloader=False)

