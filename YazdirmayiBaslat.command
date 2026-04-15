#!/bin/bash
cd "$(dirname "$0")"
RTDB_URL="https://lahmacunsefasi-default-rtdb.europe-west1.firebasedatabase.app/" \
PRINTER_IP="192.168.0.115" \
PRINTER_PORT="9100" \
node agent.js

// PRINTER_IP karsisinda ki deger müsterinin modem IP si. Müsteri modem IP sini sabitleyip PRINTER_IP karsisina ekle