"""
main.py for esp8266 sensornode with dht11 & bh1750
read temp, humidity & luminosity, publish to mqtt
"""
import time
START_MS = time.ticks_ms()

import gc
import dht
import machine
import ujson
from bh1750 import BH1750
from umqtt.robust import MQTTClient


def log(msg, file=False, end='\n'):
    """
    log to stdout, optionally file
    """
    if file:
        with open(file, 'a') as out:
            out.write(msg)
    print(msg, end=end)


log('WLAN IP: {} mask {} g/w {}'.format(*do_connect()))


DEBUG = False # or filename as str
SLEEP_SECS = 5*60
# MQTT
MQTT_SERVER = '192.168.0.80'
MQTT_PORT = 1883
MQTT_TOPIC = 'nodes'
MQTT_CLIENT = 'esp8266:18:fe:34:e1:1d:8b'
# DHT11
DHT11_PIN_PWR = 12
DHT11_PIN_DATA = 14
DHT11_INIT_SEC = 2
# BH1750
BH1750_PIN_SCL = 5
BH1750_PIN_SDA = 4


def main(svr, port, topic, client):
    """
    main procedure
    """
    log('Starting dht ... ', end='')
    d_pwr = machine.Pin(DHT11_PIN_PWR, machine.Pin.OUT)
    d_pwr.value(True)
    dht11 = dht.DHT11(machine.Pin(DHT11_PIN_DATA))
    time.sleep(DHT11_INIT_SEC)
    log('sampling ... ', end='')
    dht11.measure()
    temperature = dht11.temperature()
    humidity = dht11.humidity()
    log('done.')

    log('Starting bh1750 ... ', end='')
    scl = machine.Pin(BH1750_PIN_SCL)
    sda = machine.Pin(BH1750_PIN_SDA)
    i2c = machine.I2C(scl, sda)
    bh1750 = BH1750(i2c)
    log('sampling ... ', end='')
    luminance = bh1750.luminance(BH1750.ONCE_HIRES_1)
    bh1750.off() # shouldn't be necessary, one shot modes power down
    log('done.')

    sample = {
        'node': client,
        'l': luminance,
        't': temperature,
        'h': humidity,
    }
    sample_json = ujson.dumps(sample)
    log('Sample: ' + sample_json)

    log('Starting mqtt ... ', end='')
    mqtt = MQTTClient(client, svr, port=port)
    mqtt.DEBUG = True
    log('connecting ... ', end='')
    mqtt.connect()
    log('publishing ... ', end='')
    mqtt.publish(topic, sample_json, qos=1)
    mqtt.disconnect() # else fails after reboot, socket not freed in rtos?
    log('done.')


gc.collect()


try:
    main(MQTT_SERVER, MQTT_PORT, MQTT_TOPIC, MQTT_CLIENT)
except Exception as err:
    log('Error: {}'.format(err))



log('Setting up RTC ...', end='')
RTC = machine.RTC()
RTC.irq(trigger=RTC.ALARM0, wake=machine.DEEPSLEEP)
RTC.alarm(RTC.ALARM0, int(SLEEP_SECS*1000))
log('done.')


log('Run took: {} milliseconds'.format(
    time.ticks_diff(START_MS, time.ticks_ms())
    )
)

machine.deepsleep()
