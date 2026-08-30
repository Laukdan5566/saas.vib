import json
import logging
import time
import ctypes
from ctypes import wintypes
from pathlib import Path
from typing import Any, Dict, List

import requests

CONFIG_PATH = Path(__file__).with_name("config.json")
LOG_PATH = Path(__file__).with_name("print-agent.log")

logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


def load_config() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError("Copie config.example.json para config.json e preencha os dados.")

    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def headers(config: Dict[str, Any]) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {config['token']}",
        "X-Company-Id": str(config["company_id"]),
    }


def api_url(config: Dict[str, Any], path: str) -> str:
    base_url = str(config["api_base_url"]).rstrip("/")
    if base_url.endswith("/api") and path.startswith("/api/"):
        path = path[4:]
    return f"{base_url}{path}"


def pending_jobs(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    response = requests.get(
        api_url(config, "/api/print-jobs/pending"),
        params={"printer_name": config.get("printer_name")},
        headers=headers(config),
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def post(config: Dict[str, Any], path: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    response = requests.post(
        api_url(config, path),
        json=payload or {},
        headers=headers(config),
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def escpos_payload(content: str, encoding: str = "cp850") -> bytes:
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    commands = [
        b"\x1b@",  # initialize
        b"\x1bt\x02",  # PC850, better for Portuguese accents on ESC/POS
        b"\x1ba\x00",  # align left
        b"\x1d!\x00",  # normal size
        normalized.encode(encoding, errors="replace"),
        b"\n\n\n",
        b"\x1dV\x00",  # full cut when supported
    ]
    return b"".join(commands)


def print_windows_raw(printer_name: str, payload: bytes) -> None:
    winspool = ctypes.WinDLL("winspool.drv")

    class DOC_INFO_1(ctypes.Structure):
        _fields_ = [
            ("pDocName", wintypes.LPWSTR),
            ("pOutputFile", wintypes.LPWSTR),
            ("pDatatype", wintypes.LPWSTR),
        ]

    printer_handle = wintypes.HANDLE()
    if not winspool.OpenPrinterW(wintypes.LPWSTR(printer_name), ctypes.byref(printer_handle), None):
        raise ctypes.WinError()

    try:
        doc_info = DOC_INFO_1("Vib SaaS Pedido", None, "RAW")
        if not winspool.StartDocPrinterW(printer_handle, 1, ctypes.byref(doc_info)):
            raise ctypes.WinError()
        try:
            if not winspool.StartPagePrinter(printer_handle):
                raise ctypes.WinError()
            try:
                written = wintypes.DWORD(0)
                buffer = ctypes.create_string_buffer(payload)
                if not winspool.WritePrinter(
                    printer_handle,
                    buffer,
                    len(payload),
                    ctypes.byref(written),
                ):
                    raise ctypes.WinError()
            finally:
                winspool.EndPagePrinter(printer_handle)
        finally:
            winspool.EndDocPrinter(printer_handle)
    finally:
        winspool.ClosePrinter(printer_handle)


def print_windows(printer_name: str, content: str, config: Dict[str, Any]) -> None:
    encoding = str(config.get("printer_encoding") or "cp850")
    print_windows_raw(printer_name, escpos_payload(content, encoding))


def handle_job(config: Dict[str, Any], job: Dict[str, Any]) -> None:
    job_id = job["id"]

    try:
        claimed = post(config, f"/api/print-jobs/{job_id}/claim")
        if claimed.get("claimed") is False:
            return
        printer = claimed.get("printer") or job.get("printer") or {}
        printer_name = config.get("printer_name") or printer.get("name")

        if not printer_name:
            raise RuntimeError("printer_name nao configurado.")

        print_windows(printer_name, claimed["content"], config)
        post(config, f"/api/print-jobs/{job_id}/success")
        logging.info("PrintJob %s impresso com sucesso.", job_id)
    except Exception as exc:
        logging.exception("Erro ao imprimir PrintJob %s", job_id)
        try:
            post(config, f"/api/print-jobs/{job_id}/fail", {"error_message": str(exc)})
        except Exception:
            logging.exception("Erro ao registrar falha do PrintJob %s", job_id)


def run() -> None:
    config = load_config()
    interval = int(config.get("poll_interval_seconds", 5))
    logging.info("Agente de impressao iniciado.")

    while True:
        try:
            for job in pending_jobs(config):
                handle_job(config, job)
        except Exception:
            logging.exception("Erro no ciclo de consulta.")

        time.sleep(interval)


if __name__ == "__main__":
    run()
