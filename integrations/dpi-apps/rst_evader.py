#!/usr/bin/env python3
from scapy.all import conf
from pathlib import Path
import os
from scapy.all import sniff, IP, TCP, send
import time
import sys

sent = False
def callback(pkt):
    global sent
    if sent:
        return
    try:
        if pkt.haslayer(TCP) and pkt[TCP].dport == 443:
            # look for data after handshake
            if pkt[TCP].payload:
                # send RST to server from client
                rst = IP(src=pkt[IP].dst, dst=pkt[IP].src)/TCP(sport=pkt[TCP].dport, dport=pkt[TCP].sport, flags="R", seq=pkt[TCP].ack)
                send(rst, verbose=False)
                sent = True
                print("sent rst")
    except:
        pass

sniff(iface=(os.environ.get("DPI_INTERFACE") or str(conf.iface)), prn=callback, store=False, timeout=15)
