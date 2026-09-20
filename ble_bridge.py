"""
CareDock AI - Laptop BLE bridge (runs on the same laptop as the backend).

What it does
  1. Finds the ESP32 box over Bluetooth (name: CareLink-Box) and connects.
  2. --setup  : sends Wi-Fi + server settings and the schedule (pulled from your
                backend) to the box over BLE. No re-flashing needed.
  3. Listens to BLE notifications from the box:
        - STATUS (every 2 s)  -> shows state, weight, Wi-Fi status
        - EVENT  (dose / SOS) -> if the box has NO Wi-Fi, this script forwards
                                 the event to the backend. If the box has Wi-Fi it
                                 already posted it itself, so nothing is duplicated.

Install:  pip install bleak requests
Run:      python ble_bridge.py --setup --ssid "MyWiFi" --password "12345678" --patient 1
          python ble_bridge.py            (just listen / relay afterwards)
"""
import argparse
import asyncio
import json
import requests

try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    print("Error: 'bleak' is required for BLE bridging.")
    print("Please install it with: pip install bleak requests")
    exit(1)

DEVICE_NAME = "CareLink-Box"
CHAR_STATUS = "7a1c0002-5b6e-4c1d-9a11-c4e1a0b0c0de"
CHAR_EVENT = "7a1c0003-5b6e-4c1d-9a11-c4e1a0b0c0de"
CHAR_CONFIG = "7a1c0004-5b6e-4c1d-9a11-c4e1a0b0c0de"
CHAR_SCHEDULE = "7a1c0005-5b6e-4c1d-9a11-c4e1a0b0c0de"

box_has_wifi = False   # updated from STATUS notifications


def post_backend(server: str, event: dict):
    path = "/api/device/sos" if event.get("sos") else "/api/device/medicine"
    try:
        r = requests.post(server + path, json=event, timeout=5)
        print(f"  -> relayed to backend {path}: {r.status_code}")
    except Exception as e:
        print(f"  !! backend unreachable: {e}")


async def run(args):
    server = args.server.rstrip("/")

    print(f"Scanning for '{DEVICE_NAME}' ...")
    device = await BleakScanner.find_device_by_name(DEVICE_NAME, timeout=15)
    if device is None:
        print("Box not found. Is it powered? Is laptop Bluetooth ON? Close other BLE apps.")
        return
    print(f"Found {device.address}, connecting ...")

    def on_status(_, data: bytearray):
        global box_has_wifi
        try:
            s = json.loads(data.decode())
            box_has_wifi = bool(s.get("wifi"))
            print(f"[STATUS] {s.get('time')} state={s['state']} "
                  f"weight={s.get('weight', 0):.1f}g wifi={box_has_wifi}")
        except Exception:
            pass

    def on_event(_, data: bytearray):
        try:
            ev = json.loads(data.decode())
        except Exception:
            return
        print(f"[EVENT] {ev}")
        if not box_has_wifi:
            post_backend(server, ev)
        else:
            print("  (box has Wi-Fi, it already sent this to the backend)")

    async with BleakClient(device) as client:
        print("Connected.")

        if args.setup:
            cfg = {"ssid": args.ssid, "pass": args.password,
                   "server": args.box_server, "patient_id": args.patient}
            await client.write_gatt_char(CHAR_CONFIG, json.dumps(cfg).encode(), response=True)
            print(f"Sent config: server={args.box_server}, patient={args.patient}")

            try:
                r = requests.get(f"{server}/api/device/{args.patient}/schedule", timeout=5)
                r.raise_for_status()
                await client.write_gatt_char(CHAR_SCHEDULE, json.dumps(r.json()).encode(), response=True)
                print(f"Sent schedule: {r.json()}")
            except Exception as e:
                print(f"Could not push schedule (create it first): {e}")

        await client.start_notify(CHAR_STATUS, on_status)
        await client.start_notify(CHAR_EVENT, on_event)
        print("Listening. Press Ctrl+C to stop.\n")
        while client.is_connected:
            await asyncio.sleep(1)
        print("Box disconnected.")


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--server", default="http://127.0.0.1:8000",
                   help="backend URL as seen from THIS laptop")
    p.add_argument("--box-server", default="http://192.168.1.10:8000",
                   help="backend URL as seen from the ESP32 (laptop's Wi-Fi IP!)")
    p.add_argument("--setup", action="store_true")
    p.add_argument("--ssid", default="")
    p.add_argument("--password", default="")
    p.add_argument("--patient", type=int, default=1)
    args = p.parse_args()

    while True:                       # auto-reconnect
        try:
            await run(args)
        except Exception as e:
            print(f"BLE error: {e}")
        args.setup = False            # only provision once
        print("Retrying in 5 s ...")
        await asyncio.sleep(5)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
