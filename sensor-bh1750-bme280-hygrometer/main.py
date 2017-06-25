"""
main.py for esp8266 sensornode with dht11 & bh1750
read temp, humidity & luminosity, publish to mqtt
"""
try:
    import time
    START_MS = time.ticks_ms()

    import gc
    import machine
    import ujson
    from bh1750 import BH1750
    from bme280 import BME280
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

    # General
    DEBUG = False # or filename as str
    SLEEP_SECS = 5*60

    # MQTT
    MQTT_SERVER = '192.168.0.80'
    MQTT_PORT = 1883
    MQTT_TOPIC = 'nodes'
    MQTT_CLIENT = 'NodeMCU:5c:cf:7f:ac:6e:6d'

    # I2C
    SCL = 5 # d1 on NodeMCU silkscreen
    SDA = 4 # d2 on NodeMCU silkscreen

    # ADC Soil humidity
    ADC_CHANNEL = 0
    # voltage divider as 1M:330k
    # calibration for particular physical config
    #   isolated    ~150
    #   wired       ~10
    #   water       ~50
    SH_PWR_PIN = 12 # d6 on NodeMCU Silkscreen
    SH_ZERO = 160
    SH_100 = 40

    def main(svr, port, topic, client):
        """
        main procedure
        """

        log('Init I2C bus ... ', end='')
        scl = machine.Pin(SCL)
        sda = machine.Pin(SDA)
        i2c = machine.I2C(scl=scl, sda=sda)
        log('done.')

        log('Starting bh1750 ... ', end='')
        bh1750 = BH1750(i2c)
        log('sampling ... ', end='')
        luminance = bh1750.luminance(BH1750.ONCE_HIRES_1)
        bh1750.off() # shouldn't be necessary, one shot modes power down
        log('done.')

        log('Starting bme280 ... ', end='')
        bme280 = BME280(i2c)
        log('sampling ... ', end='')
        temperature, pressure, humidity = bme280.sample()
        log('done.')

        log('Starting soil hygrometer & adc ... ', end='')
        p14 = machine.Pin(SH_PWR_PIN, machine.Pin.OUT)
        p14.on()
        adc = machine.ADC(ADC_CHANNEL)
        adc.read() # discard
        time.sleep(1)
        log('sampling ... ', end='')
        s = adc.read()
        soil_humidity = int(((SH_ZERO-s)/(SH_ZERO-SH_100))*100)
        log('shutting down ...', end='')
        p14.off()
        log('done.')

        sample = {
            'node': client,
            'l': luminance,
            't': temperature,
            'h': humidity,
            'p': pressure,
            'sh': soil_humidity,
        }
        sample_json = ujson.dumps(sample)
        log('Sample: ' + sample_json)

        log('Starting mqtt ... ', end='')
        try:
            mqtt = MQTTClient(client, svr, port=port)
            mqtt.DEBUG = True
            log('connecting ... ', end='')
            mqtt.connect()
            log('publishing ... ', end='')
            mqtt.publish(topic, sample_json, qos=1)
            mqtt.disconnect() # else fails after reboot, socket not freed in rtos?
        except Exception as err:
            log('FAILED [{}]'.format(err))
        log('done.')

    gc.collect()

    main(MQTT_SERVER, MQTT_PORT, MQTT_TOPIC, MQTT_CLIENT)

except Exception as err:

    log('Error: {}'.format(err))

try:

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

except:

    machine.reset()
