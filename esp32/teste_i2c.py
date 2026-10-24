import machine
import time
I2C_SCL = machine.Pin(22)
I2C_SDA = machine.Pin(21)
I2C = machine.I2C(0, scl=I2C_SCL, sda=I2C_SDA, freq=10000)

time.sleep_ms(100)

print("Procurando sensores I2C...")
dispositivos = I2C.scan()

if dispositivos:
    for d in dispositivos:
        print(f"-> Sensor encontrado no endereço: {hex(d)}")
else:
    print("Nenhum sensor encontrado. Verifique a fiação.")