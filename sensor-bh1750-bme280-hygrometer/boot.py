"""
boot.py
"""

# drop rtos debug msgs
from esp import osdebug
osdebug(False)

def do_connect():
    """
    connect to wifi, or return
    """
    import network
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print('connecting to network...')
        wlan.connect('Opal', 'Indig01234')
        while not wlan.isconnected():
            pass
    return wlan.ifconfig()

