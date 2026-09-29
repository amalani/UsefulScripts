#!/bin/bash
# network_scan_22.sh - Scan a /22 network (255.255.252.0 subnet mask) for active devices

# ===== CONFIGURATION =====
BASE_IP="192.168"   # First two octets of your network
START_BLOCK=0       # Third octet start (e.g., 0 for 192.168.0.x)
END_BLOCK=3         # Third octet end (e.g., 3 for 192.168.3.x)
TIMEOUT=1           # Ping timeout in seconds

echo "Scanning ${BASE_IP}.${START_BLOCK}-to-${BASE_IP}.${END_BLOCK} (Subnet mask 255.255.252.0)..."

# ===== SCAN LOOP =====
for third in $(seq $START_BLOCK $END_BLOCK); do
  for fourth in $(seq 1 254); do
    IP="${BASE_IP}.${third}.${fourth}"
    (
      if ping -c 1 -W $TIMEOUT "$IP" >/dev/null 2>&1; then
        echo "Active: $IP"
      fi
    ) &
  done
done

wait

# ===== SHOW ARP TABLE =====
echo
echo "ARP Table (MAC addresses of discovered devices):"
arp -a
