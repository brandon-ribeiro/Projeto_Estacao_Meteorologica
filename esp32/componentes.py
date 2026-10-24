import machine
import dht
from bmp280 import BMP280
import urequests
# -- Comunicação
# I2C
I2C_SCL = machine.Pin(22)
I2C_SDA = machine.Pin(21)
I2C = machine.I2C(0, scl=I2C_SCL, sda=I2C_SDA, freq=10000)

# -- Componentes
# DHT 22
DHT = dht.DHT22(machine.Pin(23)) #ESP 23
# LDR - Photoresistor
LDR = machine.ADC(35)
LDR.atten(machine.ADC.ATTN_11DB)
#BMP280
BMP = BMP280(I2C, addr=0x76)

#MQ135
mq135_ao = machine.ADC(34)
mq135_ao.atten(machine.ADC.ATTN_11DB)

#Functions of components
def dht_temp():
    temp = DHT.temperature()
    return temp
def dht_hum():
    hum = DHT.humidity()
    return hum
def ldr_value():
    ldr_value = LDR.read()
    return ldr_value
def bmp_press():
    pressure = BMP.pressure
    pressure_hpa = pressure/100
    return pressure_hpa
def bmp_temp():
    temp = BMP.temperature
    return temp
def mq135():
    value_mq135 = mq135_ao.read()
    return value_mq135
# ---------- GPS ----------
def geolocalizacao_por_ip():
    localizacao = {}
    try:
        res = urequests.get("http://ip-api.com/json/")
        dados = res.json()
        res.close()
        localizacao = {
            'cidade': dados.get('city'),
            'estado': dados.get('regionName'),
            'lat': dados.get('lat'),
            'lon': dados.get('lon')
        }
        return localizacao
    except Exception as e:
        print("Erro na geolocalização:", e)
        

# Main Function
def dados_compo():
    try:
        DHT.measure()
        temp_dht = dht_temp()
        hum_dht = dht_hum()
        lightness_ldr = ldr_value()
        pressure_bmp = bmp_press()
        temp_bmp = bmp_temp()
        air_qlt = mq135()
    except Exception as e:
        print("Erro componentes:", e)

    sensor_dht = {
        "temp": temp_dht,
        "hum": hum_dht
    }
    sensor_ldr = {
        "lightness": lightness_ldr
    }
    sensor_bmp = {
        "temp": temp_bmp,
        "pressure": pressure_bmp
    }
    sensor_mq135 = {
        "air_quality": air_qlt
    }

    return {
        "dht22": sensor_dht,
        "ldr": sensor_ldr,
        "bmp280": sensor_bmp,
        "mq135": sensor_mq135,
        "localizacao": geolocalizacao_por_ip()
    }

# Test code
def test_comp():
    while True:
        try:        
            dict_comp = dados_compo()
            dht22 = dict_comp.get('dht22')
            bmp280 = dict_comp.get('bmp280')
            mq135 = dict_comp.get('mq135')
            ldr = dict_comp.get('ldr')
            # -- Verificando componentes
            dht_sts = dht22.get("temp", "Erro DHT TEMP")
            dht2_sts = dht22.get("hum", "Erro DHT Humi")
            ldr_sts = ldr.get("lightness", "Erro LDR")
            bmp_sts = bmp280.get("temp", "Erro BMP")
            bmp2_sts = bmp280.get("pressure", "Erro BMP")
            mq135_sts = mq135.get("air_quality", "Erro MQ135")

            mensage = f"""Teste componentes:
    DHT22 Status:
        TEMP: {dht_sts}
        HUM: {dht2_sts}
    LDR Status: {ldr_sts}
    BMP Status:
        TEMP: {bmp_sts}
        HUM: {bmp2_sts}
    MQ135:
        Value: {mq135_sts}
    """
            print(mensage)
            break
        except Exception as e:
                print("Erro no loop MQTT:", e)
                break

if __name__ == "__main__":
    test_comp()
