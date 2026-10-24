import network
import time
import machine
import ujson
import dht
import urequests
from umqtt.simple import MQTTClient
from componentes import dados_compo


# ---------- Config ----------
SSID = '*PIMENTEL*' #iPhone de Pedro *PIMENTEL*
PASSWORD = 'pedro1706@' #pedro1706@

MQTT_CLIENT_ID = "esp32_wokwi_demo_12345" #mexer
MQTT_BROKER    = "broker.emqx.io" #não mexer
MQTT_USER      = ""
MQTT_PASSWORD  = ""
TOPIC_SUB      = "esp32/get"   # ESP32 recebe comandos aqui
TOPIC_PUB      = "esp32/post"    # ESP32 envia dados aqui

# ---------- Wi-Fi ----------
def conecta_wifi():
    print("Conectando ao Wi-Fi...", end="")
    sta_if = network.WLAN(network.STA_IF)
    sta_if.active(True)
    sta_if.connect(SSID, PASSWORD)
    while not sta_if.isconnected():
        print(".", end="")
        time.sleep(0.1)
    print(" Conectado!")

# ---------- MQTT ----------
def callback_mqtt(topic, msg):
    topico_str = topic.decode('utf-8')
    mensagem_str = msg.decode('utf-8').strip().upper()
    print(f"\n[MQTT] Recebido em '{topico_str}': {mensagem_str}")

conecta_wifi()

print("Conectando ao Broker MQTT...")
client = MQTTClient(MQTT_CLIENT_ID, MQTT_BROKER,
                    user=MQTT_USER, password=MQTT_PASSWORD, keepalive=60)
client.set_callback(callback_mqtt)
client.connect()
print("Conectado ao MQTT Broker!")

client.subscribe(TOPIC_SUB)
print(f"Inscrito no tópico: {TOPIC_SUB}")

# ---------- Loop ----------
contador = 0
while True:
    try:
        client.check_msg()  # verifica comandos sem travar
        contador += 1
        #client.publish(TOPIC_PUB, f"Telemetria #{contador} - ESP32 Wokwi Rodando")
        dic_val = dados_compo()
        print(dic_val)
        client.publish(TOPIC_PUB, ujson.dumps(dic_val).encode('utf-8'))	
        print(f"[MQTT] Telemetria #{contador} publicada")
        time.sleep(300)
    except Exception as e:
        print("Erro no loop MQTT:", e)
        print("Tentando reconectar...")
        try:
            client.connect()
            print("Reconectado com sucesso!")
        except:
            print("Falha na reconexão, tentando novamente em breve...")
        time.sleep(2)


