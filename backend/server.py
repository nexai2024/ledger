from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import json
import uuid
import hmac
import hashlib
import secrets
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from html import escape
from urllib.parse import urlparse
from typing import Optional, List

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ---------------------------------------------------------------------------
# Config & DB
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ledgersync")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "LedgerSync"

BASE_RPC_URL = os.environ.get("BASE_RPC_URL", "https://mainnet.base.org")
BASE_CHAIN_ID = int(os.environ.get("BASE_CHAIN_ID", "8453"))
USDC_CONTRACT = os.environ.get("USDC_CONTRACT", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").lower()
USDC_DECIMALS = 6
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

app = FastAPI(title="LedgerSync API")
api = APIRouter(prefix="/api")

# In-memory onchain listener state
listener_state = {
    "latest_block": 0,
    "last_poll_ts": None,
    "running": False,
    "events": [],  # recent matched/seen events
    "scanned_up_to": {},  # wallet -> block
}

# ---------------------------------------------------------------------------
# Password / JWT helpers
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "email": email, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def set_session_cookie(response: Response, token: str):
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def public_user(u: dict) -> dict:
    return {
        "id": u["user_id"], "email": u["email"], "name": u.get("name", ""),
        "companyName": u.get("companyName", ""), "baseWalletAddr": u.get("baseWalletAddr", ""),
        "erpProvider": u.get("erpProvider"), "erpApiKey": u.get("erpApiKey"),
        "picture": u.get("picture"), "authProvider": u.get("auth_provider", "password"),
        "createdAt": u.get("created_at"),
    }

async def get_current_founder(request: Request) -> dict:
    # 1) JWT access token
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
                if user and payload.get("ver", 0) == user.get("token_version", 0):
                    return user
        except jwt.ExpiredSignatureError:
            pass
        except jwt.InvalidTokenError:
            pass
    # 2) Google session token
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            session_token = auth[7:]
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            exp = sess["expires_at"]
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
                if user:
                    return user
    raise HTTPException(status_code=401, detail="Not authenticated")

# ---------------------------------------------------------------------------
# Email (password reset)
# ---------------------------------------------------------------------------

async def send_password_reset_email(to_email: str, token: str) -> bool:
    base = FRONTEND_URL.rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        if urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning("Email not configured; password reset link: %s", link)
        else:
            logger.error("Password reset email not configured (EMERGENT_EMAIL_KEY / FRONTEND_URL)")
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<p>We received a request to reset your {brand} password.</p>'
        f'<p><a href="{escape(link)}">Reset your password</a></p>'
        f'<p>This link expires in 1 hour and can be used once. If you did not request it, ignore this email.</p>'
        f'<p style="font-size:12px;color:#888">Sent by {brand}. We never ask for your password by email.</p>'
        f'</td></tr></table>'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                headers={"X-Email-Key": EMAIL_KEY},
                                json={"to": [to_email], "subject": f"Reset your {EMAIL_FROM_NAME} password",
                                      "html": html, "from_name": EMAIL_FROM_NAME})
        if resp.status_code in (402, 403, 409):
            logger.warning(f"Password reset email paused ({resp.status_code}): {resp.text}")
            return False
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        return False

# ---------------------------------------------------------------------------
# Brute force helpers
# ---------------------------------------------------------------------------

async def is_locked(ip: str, email: str) -> bool:
    identifier = f"{ip}:{email}"
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    count = await db.login_attempts.count_documents({"identifier": identifier, "ts": {"$gt": cutoff.isoformat()}})
    return count >= 5

async def record_failed(ip: str, email: str):
    await db.login_attempts.insert_one({"identifier": f"{ip}:{email}", "email": email,
                                        "ts": datetime.now(timezone.utc).isoformat()})

async def clear_attempts(ip: str, email: str):
    await db.login_attempts.delete_many({"email": email})

# ---------------------------------------------------------------------------
# Web3 / Base chain helpers
# ---------------------------------------------------------------------------

async def rpc_call(method: str, params: list):
    async with httpx.AsyncClient(timeout=20) as c:
        resp = await c.post(BASE_RPC_URL, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(data["error"])
        return data.get("result")

def addr_from_topic(topic: str) -> str:
    return "0x" + topic[-40:]

def pad_addr(addr: str) -> str:
    return "0x" + "0" * 24 + addr.lower().replace("0x", "")

async def verify_usdc_transfer(tx_hash: str, to_addr: str, min_micros: int) -> dict:
    """Read the Base chain and confirm tx_hash is a successful USDC transfer to `to_addr`."""
    receipt = await rpc_call("eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        return {"ok": False, "reason": "Transaction not found on Base yet"}
    if receipt.get("status") != "0x1":
        return {"ok": False, "reason": "Transaction reverted onchain"}
    to_addr_l = to_addr.lower()
    for log in receipt.get("logs", []):
        if log.get("address", "").lower() != USDC_CONTRACT:
            continue
        topics = log.get("topics", [])
        if len(topics) < 3 or topics[0].lower() != TRANSFER_TOPIC:
            continue
        log_to = addr_from_topic(topics[2]).lower()
        if log_to != to_addr_l:
            continue
        amount_micros = int(log.get("data", "0x0"), 16)
        if amount_micros + 1 >= min_micros:
            return {"ok": True, "from": addr_from_topic(topics[1]), "amount_micros": amount_micros,
                    "block": int(receipt.get("blockNumber", "0x0"), 16)}
        return {"ok": False, "reason": f"Amount too low: received {amount_micros/1e6} USDC"}
    return {"ok": False, "reason": "No matching USDC transfer to settlement wallet in tx"}

# ---------------------------------------------------------------------------
# ERP sync engine (mocked QuickBooks / Xero)
# ---------------------------------------------------------------------------

async def run_erp_sync(invoice: dict, founder: dict) -> dict:
    provider = founder.get("erpProvider")
    now = datetime.now(timezone.utc)
    customer = await db.customers.find_one({"id": invoice["customerId"]}, {"_id": 0})
    payload = {
        "docType": "SalesReceipt",
        "customerRef": {"name": (customer or {}).get("name") or (customer or {}).get("email", "Unknown")},
        "currency": "USD",
        "line": [{"amount": float(invoice["amountUsdc"]), "description": invoice.get("description", "USDC payment"),
                  "detailType": "SalesItemLineDetail"}],
        "privateNote": f"Settled onchain via Base. Tx {invoice.get('onchainTxHash')}",
        "paymentNonce": invoice["paymentNonce"],
        "txnDate": now.date().isoformat(),
    }
    if not provider:
        result = {"erpSyncStatus": "ERROR", "erpInvoiceId": None,
                  "erpSyncLog": json.dumps({"error": "No ERP provider configured", "payload": payload})}
    else:
        erp_id = f"{'QBO' if provider == 'QUICKBOOKS' else 'XERO'}-{secrets.token_hex(4).upper()}"
        result = {"erpSyncStatus": "SYNCED", "erpInvoiceId": erp_id,
                  "erpSyncLog": json.dumps({"provider": provider, "status": "success",
                                            "journalEntryId": erp_id, "payload": payload,
                                            "syncedAt": now.isoformat()})}
    await db.invoices.update_one({"id": invoice["id"]}, {"$set": {**result, "updatedAt": now.isoformat()}})
    await db.erp_sync_logs.insert_one({
        "id": str(uuid.uuid4()), "founderId": founder["user_id"], "invoiceId": invoice["id"],
        "provider": provider or "NONE", "status": result["erpSyncStatus"],
        "erpInvoiceId": result["erpInvoiceId"], "onchainTxHash": invoice.get("onchainTxHash"),
        "payload": payload, "message": "Reconciled invoice pushed to ERP" if provider else "No ERP provider configured",
        "ts": now.isoformat(),
    })
    return result

async def mark_invoice_paid(invoice: dict, tx_hash: str, payer: Optional[str] = None):
    now = datetime.now(timezone.utc)
    await db.invoices.update_one({"id": invoice["id"]}, {"$set": {
        "status": "PAID", "onchainTxHash": tx_hash, "paidAt": now.isoformat(),
        "payerWallet": payer, "updatedAt": now.isoformat()}})
    invoice = await db.invoices.find_one({"id": invoice["id"]}, {"_id": 0})
    founder = await db.users.find_one({"user_id": invoice["founderId"]}, {"_id": 0})
    await run_erp_sync(invoice, founder)

# ---------------------------------------------------------------------------
# Onchain listener background worker
# ---------------------------------------------------------------------------

async def listener_loop():
    listener_state["running"] = True
    await asyncio.sleep(5)
    while True:
        try:
            latest_hex = await rpc_call("eth_blockNumber", [])
            latest = int(latest_hex, 16)
            listener_state["latest_block"] = latest
            listener_state["last_poll_ts"] = datetime.now(timezone.utc).isoformat()

            pending = await db.invoices.find({"status": "PENDING"}, {"_id": 0}).to_list(500)
            wallets = {}
            for inv in pending:
                f = await db.users.find_one({"user_id": inv["founderId"]}, {"_id": 0})
                if f and f.get("baseWalletAddr"):
                    wallets.setdefault(f["baseWalletAddr"].lower(), []).append(inv)

            for wallet, invs in wallets.items():
                from_block = listener_state["scanned_up_to"].get(wallet, max(latest - 200, 0)) + 1
                if from_block > latest:
                    continue
                from_block = max(from_block, latest - 800)  # cap range for public RPC
                try:
                    logs = await rpc_call("eth_getLogs", [{
                        "fromBlock": hex(from_block), "toBlock": hex(latest),
                        "address": USDC_CONTRACT,
                        "topics": [TRANSFER_TOPIC, None, pad_addr(wallet)],
                    }])
                except Exception as e:
                    logger.warning(f"getLogs failed for {wallet}: {e}")
                    continue
                for log in logs or []:
                    amount_micros = int(log.get("data", "0x0"), 16)
                    tx_hash = log.get("transactionHash")
                    evt = {"wallet": wallet, "txHash": tx_hash, "amountUsdc": amount_micros / 1e6,
                           "block": int(log.get("blockNumber", "0x0"), 16),
                           "ts": datetime.now(timezone.utc).isoformat(), "matched": False}
                    existing = await db.invoices.find_one({"onchainTxHash": tx_hash}, {"_id": 0})
                    if not existing:
                        for inv in sorted(invs, key=lambda x: x["createdAt"]):
                            if inv["status"] != "PENDING":
                                continue
                            if amount_micros + 1 >= round(float(inv["amountUsdc"]) * 1e6):
                                fresh = await db.invoices.find_one({"id": inv["id"], "status": "PENDING"}, {"_id": 0})
                                if fresh:
                                    await mark_invoice_paid(fresh, tx_hash, addr_from_topic(log["topics"][1]))
                                    inv["status"] = "PAID"
                                    evt["matched"] = True
                                    evt["invoiceId"] = inv["id"]
                                    break
                    listener_state["events"].insert(0, evt)
                    listener_state["events"] = listener_state["events"][:50]
                listener_state["scanned_up_to"][wallet] = latest
        except Exception as e:
            logger.warning(f"listener error: {e}")
        await asyncio.sleep(25)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = ""
    companyName: Optional[str] = ""

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotIn(BaseModel):
    email: EmailStr

class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)

class SettingsIn(BaseModel):
    companyName: Optional[str] = None
    baseWalletAddr: Optional[str] = None
    erpProvider: Optional[str] = None
    erpApiKey: Optional[str] = None

class CustomerIn(BaseModel):
    email: EmailStr
    name: Optional[str] = ""
    walletAddress: Optional[str] = ""

class ProductIn(BaseModel):
    name: str
    priceUsdc: float
    billingInterval: str = "MONTHLY"

class SubscriptionIn(BaseModel):
    customerId: str
    productId: str
    status: Optional[str] = "ACTIVE"
    nextBillingDate: Optional[str] = None

class InvoiceIn(BaseModel):
    customerId: str
    amountUsdc: float
    description: Optional[str] = ""
    productId: Optional[str] = None

class ConfirmIn(BaseModel):
    txHash: str

# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {"user_id": uid, "email": email, "password_hash": hash_password(body.password),
           "name": body.name or email.split("@")[0], "companyName": body.companyName or "My Company",
           "baseWalletAddr": "", "erpProvider": None, "erpApiKey": None, "auth_provider": "password",
           "role": "founder", "token_version": 0, "created_at": now}
    await db.users.insert_one(doc)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return public_user(doc)

@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "0.0.0.0"
    if await is_locked(ip, email):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await record_failed(ip, email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_attempts(ip, email)
    ver = user.get("token_version", 0)
    set_auth_cookies(response, create_access_token(user["user_id"], email, ver), create_refresh_token(user["user_id"], ver))
    return public_user(user)

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(founder: dict = Depends(get_current_founder)):
    return public_user(founder)

@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
    if not user or payload.get("ver", 0) != user.get("token_version", 0):
        raise HTTPException(status_code=401, detail="Session expired")
    response.set_cookie("access_token", create_access_token(user["user_id"], user["email"], user.get("token_version", 0)),
                        httponly=True, secure=True, samesite="none", max_age=900, path="/")
    return {"ok": True}

@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn, background_tasks: BackgroundTasks):
    email = body.email.lower()
    generic = {"message": "If that email is registered, a reset link has been sent."}
    now = datetime.now(timezone.utc)
    await db.password_reset_requests.insert_one({"email": email, "created_at": now.isoformat()})
    cutoff = now - timedelta(minutes=15)
    recent = await db.password_reset_requests.count_documents({"email": email, "created_at": {"$gt": cutoff.isoformat()}})
    if recent > 5:
        return generic
    user = await db.users.find_one({"email": email})
    if not user:
        return generic
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    await db.password_reset_tokens.insert_one({
        "token_hash": token_hash, "user_id": user["user_id"], "email": email,
        "expires_at": now + timedelta(hours=1), "used": False})
    background_tasks.add_task(send_password_reset_email, user["email"], token)
    return generic

@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    h = hashlib.sha256(body.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    doc = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": h, "used": False, "expires_at": {"$gt": now}}, {"$set": {"used": True}})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    await db.users.update_one({"user_id": doc["user_id"]},
                              {"$set": {"password_hash": hash_password(body.password)},
                               "$inc": {"token_version": 1}})
    await db.password_reset_tokens.delete_many({"user_id": doc["user_id"], "used": False})
    await db.login_attempts.delete_many({"email": doc["email"]})
    return {"message": "Password reset successful. Please sign in."}

@api.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")
    async with httpx.AsyncClient(timeout=20) as c:
        resp = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                           headers={"X-Session-ID": session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = resp.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        user = {"user_id": uid, "email": email, "name": data.get("name", email.split("@")[0]),
                "companyName": "My Company", "baseWalletAddr": "", "erpProvider": None, "erpApiKey": None,
                "picture": data.get("picture"), "auth_provider": "google", "role": "founder",
                "token_version": 0, "created_at": now}
        await db.users.insert_one(user)
    token = data["session_token"]
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": token,
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                                       "created_at": datetime.now(timezone.utc)})
    set_session_cookie(response, token)
    return public_user(user)

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@api.put("/settings")
async def update_settings(body: SettingsIn, founder: dict = Depends(get_current_founder)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "baseWalletAddr" in update and update["baseWalletAddr"]:
        if not re.fullmatch(r"0x[a-fA-F0-9]{40}", update["baseWalletAddr"]):
            raise HTTPException(status_code=400, detail="Invalid Base wallet address")
    if "erpProvider" in update and update["erpProvider"] in ("", "NONE"):
        update["erpProvider"] = None
    if update:
        await db.users.update_one({"user_id": founder["user_id"]}, {"$set": update})
    u = await db.users.find_one({"user_id": founder["user_id"]}, {"_id": 0})
    return public_user(u)

# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

@api.get("/customers")
async def list_customers(founder: dict = Depends(get_current_founder)):
    return await db.customers.find({"founderId": founder["user_id"]}, {"_id": 0}).sort("createdAt", -1).to_list(1000)

@api.post("/customers")
async def create_customer(body: CustomerIn, founder: dict = Depends(get_current_founder)):
    doc = {"id": str(uuid.uuid4()), "founderId": founder["user_id"], "email": body.email,
           "name": body.name, "walletAddress": body.walletAddress,
           "createdAt": datetime.now(timezone.utc).isoformat()}
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, founder: dict = Depends(get_current_founder)):
    await db.customers.update_one({"id": cid, "founderId": founder["user_id"]},
                                  {"$set": {"email": body.email, "name": body.name, "walletAddress": body.walletAddress}})
    return await db.customers.find_one({"id": cid}, {"_id": 0})

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, founder: dict = Depends(get_current_founder)):
    await db.customers.delete_one({"id": cid, "founderId": founder["user_id"]})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

@api.get("/products")
async def list_products(founder: dict = Depends(get_current_founder)):
    return await db.products.find({"founderId": founder["user_id"]}, {"_id": 0}).sort("createdAt", -1).to_list(1000)

@api.post("/products")
async def create_product(body: ProductIn, founder: dict = Depends(get_current_founder)):
    doc = {"id": str(uuid.uuid4()), "founderId": founder["user_id"], "name": body.name,
           "priceUsdc": round(body.priceUsdc, 2), "billingInterval": body.billingInterval,
           "createdAt": datetime.now(timezone.utc).isoformat()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, founder: dict = Depends(get_current_founder)):
    await db.products.update_one({"id": pid, "founderId": founder["user_id"]},
                                 {"$set": {"name": body.name, "priceUsdc": round(body.priceUsdc, 2),
                                           "billingInterval": body.billingInterval}})
    return await db.products.find_one({"id": pid}, {"_id": 0})

@api.delete("/products/{pid}")
async def delete_product(pid: str, founder: dict = Depends(get_current_founder)):
    await db.products.delete_one({"id": pid, "founderId": founder["user_id"]})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------

async def enrich_subscription(sub: dict):
    cust = await db.customers.find_one({"id": sub["customerId"]}, {"_id": 0})
    prod = await db.products.find_one({"id": sub["productId"]}, {"_id": 0})
    sub["customer"] = cust
    sub["product"] = prod
    return sub

@api.get("/subscriptions")
async def list_subscriptions(founder: dict = Depends(get_current_founder)):
    subs = await db.subscriptions.find({"founderId": founder["user_id"]}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    return [await enrich_subscription(s) for s in subs]

@api.post("/subscriptions")
async def create_subscription(body: SubscriptionIn, founder: dict = Depends(get_current_founder)):
    nbd = body.nextBillingDate or (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    doc = {"id": str(uuid.uuid4()), "founderId": founder["user_id"], "customerId": body.customerId,
           "productId": body.productId, "status": body.status or "ACTIVE", "nextBillingDate": nbd,
           "createdAt": datetime.now(timezone.utc).isoformat()}
    await db.subscriptions.insert_one(doc)
    doc.pop("_id", None)
    return await enrich_subscription(doc)

@api.put("/subscriptions/{sid}")
async def update_subscription(sid: str, body: SubscriptionIn, founder: dict = Depends(get_current_founder)):
    await db.subscriptions.update_one({"id": sid, "founderId": founder["user_id"]},
                                      {"$set": {"status": body.status, "nextBillingDate": body.nextBillingDate}})
    s = await db.subscriptions.find_one({"id": sid}, {"_id": 0})
    return await enrich_subscription(s)

@api.delete("/subscriptions/{sid}")
async def delete_subscription(sid: str, founder: dict = Depends(get_current_founder)):
    await db.subscriptions.delete_one({"id": sid, "founderId": founder["user_id"]})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

async def enrich_invoice(inv: dict):
    cust = await db.customers.find_one({"id": inv["customerId"]}, {"_id": 0})
    inv["customer"] = cust
    return inv

@api.get("/invoices")
async def list_invoices(founder: dict = Depends(get_current_founder)):
    invs = await db.invoices.find({"founderId": founder["user_id"]}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    return [await enrich_invoice(i) for i in invs]

@api.post("/invoices")
async def create_invoice(body: InvoiceIn, founder: dict = Depends(get_current_founder)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": str(uuid.uuid4()), "founderId": founder["user_id"], "customerId": body.customerId,
           "amountUsdc": round(body.amountUsdc, 2), "status": "PENDING",
           "paymentNonce": "ls_" + secrets.token_urlsafe(10).replace("-", "").replace("_", "")[:14],
           "onchainTxHash": None, "paidAt": None, "payerWallet": None, "productId": body.productId,
           "description": body.description or "USDC Invoice", "erpInvoiceId": None,
           "erpSyncStatus": "UNSYNCED", "erpSyncLog": None, "createdAt": now, "updatedAt": now}
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return await enrich_invoice(doc)

@api.get("/invoices/{iid}")
async def get_invoice(iid: str, founder: dict = Depends(get_current_founder)):
    inv = await db.invoices.find_one({"id": iid, "founderId": founder["user_id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return await enrich_invoice(inv)

@api.post("/invoices/{iid}/retry-sync")
async def retry_sync(iid: str, founder: dict = Depends(get_current_founder)):
    inv = await db.invoices.find_one({"id": iid, "founderId": founder["user_id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv["status"] != "PAID":
        raise HTTPException(status_code=400, detail="Only PAID invoices can be synced")
    result = await run_erp_sync(inv, founder)
    inv.update(result)
    return await enrich_invoice(inv)

# ---------------------------------------------------------------------------
# Public checkout
# ---------------------------------------------------------------------------

@api.get("/checkout/{nonce}")
async def checkout_info(nonce: str):
    inv = await db.invoices.find_one({"paymentNonce": nonce}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Checkout link not found")
    founder = await db.users.find_one({"user_id": inv["founderId"]}, {"_id": 0})
    cust = await db.customers.find_one({"id": inv["customerId"]}, {"_id": 0})
    return {
        "invoice": {"id": inv["id"], "amountUsdc": inv["amountUsdc"], "status": inv["status"],
                    "paymentNonce": inv["paymentNonce"], "description": inv.get("description"),
                    "onchainTxHash": inv.get("onchainTxHash"), "paidAt": inv.get("paidAt")},
        "merchant": {"companyName": founder.get("companyName"), "settlementWallet": founder.get("baseWalletAddr"),
                     "email": founder.get("email")},
        "customer": {"name": (cust or {}).get("name"), "email": (cust or {}).get("email")},
        "chain": {"chainId": BASE_CHAIN_ID, "usdcContract": USDC_CONTRACT, "decimals": USDC_DECIMALS,
                  "rpcUrl": BASE_RPC_URL, "explorer": "https://basescan.org"},
    }

@api.post("/checkout/{nonce}/confirm")
async def checkout_confirm(nonce: str, body: ConfirmIn):
    inv = await db.invoices.find_one({"paymentNonce": nonce}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Checkout link not found")
    if inv["status"] == "PAID":
        return {"status": "PAID", "onchainTxHash": inv.get("onchainTxHash")}
    founder = await db.users.find_one({"user_id": inv["founderId"]}, {"_id": 0})
    wallet = founder.get("baseWalletAddr")
    if not wallet:
        raise HTTPException(status_code=400, detail="Merchant has not configured a settlement wallet")
    if not re.fullmatch(r"0x[a-fA-F0-9]{64}", body.txHash):
        raise HTTPException(status_code=400, detail="Invalid transaction hash")
    dup = await db.invoices.find_one({"onchainTxHash": body.txHash}, {"_id": 0})
    if dup and dup["id"] != inv["id"]:
        raise HTTPException(status_code=400, detail="Transaction already used for another invoice")
    result = await verify_usdc_transfer(body.txHash, wallet, round(float(inv["amountUsdc"]) * 1e6))
    if not result["ok"]:
        await db.invoices.update_one({"id": inv["id"]}, {"$set": {"status": "FAILED",
                                     "updatedAt": datetime.now(timezone.utc).isoformat()}})
        raise HTTPException(status_code=400, detail=result["reason"])
    fresh = await db.invoices.find_one({"id": inv["id"]}, {"_id": 0})
    await mark_invoice_paid(fresh, body.txHash, result.get("from"))
    updated = await db.invoices.find_one({"id": inv["id"]}, {"_id": 0})
    return {"status": "PAID", "onchainTxHash": body.txHash, "erpSyncStatus": updated.get("erpSyncStatus")}

# ---------------------------------------------------------------------------
# Listener status / ERP logs / dashboard
# ---------------------------------------------------------------------------

@api.get("/listener/status")
async def listener_status(founder: dict = Depends(get_current_founder)):
    wallet = (founder.get("baseWalletAddr") or "").lower()
    events = [e for e in listener_state["events"] if not wallet or e["wallet"] == wallet]
    return {"latestBlock": listener_state["latest_block"], "lastPollTs": listener_state["last_poll_ts"],
            "running": listener_state["running"], "rpcUrl": BASE_RPC_URL, "usdcContract": USDC_CONTRACT,
            "events": events[:20]}

@api.get("/erp/logs")
async def erp_logs(founder: dict = Depends(get_current_founder)):
    return await db.erp_sync_logs.find({"founderId": founder["user_id"]}, {"_id": 0}).sort("ts", -1).to_list(200)

@api.get("/dashboard/stats")
async def dashboard_stats(founder: dict = Depends(get_current_founder)):
    fid = founder["user_id"]
    invoices = await db.invoices.find({"founderId": fid}, {"_id": 0}).to_list(2000)
    subs = await db.subscriptions.find({"founderId": fid}, {"_id": 0}).to_list(2000)
    products = {p["id"]: p for p in await db.products.find({"founderId": fid}, {"_id": 0}).to_list(2000)}

    mrr = 0.0
    active = 0
    for s in subs:
        if s["status"] == "ACTIVE":
            active += 1
            p = products.get(s["productId"])
            if p:
                price = float(p["priceUsdc"])
                if p["billingInterval"] == "MONTHLY":
                    mrr += price
                elif p["billingInterval"] == "YEARLY":
                    mrr += price / 12
    paid = [i for i in invoices if i["status"] == "PAID"]
    pending = [i for i in invoices if i["status"] == "PENDING"]
    total_collected = sum(float(i["amountUsdc"]) for i in paid)
    synced = len([i for i in paid if i.get("erpSyncStatus") == "SYNCED"])

    # revenue trend last 6 months
    trend = []
    now = datetime.now(timezone.utc)
    for k in range(5, -1, -1):
        month = (now.replace(day=1) - timedelta(days=30 * k))
        label = month.strftime("%b")
        msum = 0.0
        for i in paid:
            if i.get("paidAt"):
                try:
                    pd = datetime.fromisoformat(i["paidAt"])
                    if pd.year == month.year and pd.month == month.month:
                        msum += float(i["amountUsdc"])
                except Exception:
                    pass
        trend.append({"month": label, "revenue": round(msum, 2)})

    return {
        "mrr": round(mrr, 2), "arr": round(mrr * 12, 2),
        "activeSubscriptions": active, "totalCollected": round(total_collected, 2),
        "pendingCount": len(pending), "paidCount": len(paid),
        "syncedCount": synced, "customerCount": await db.customers.count_documents({"founderId": fid}),
        "revenueTrend": trend,
    }

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Startup: indexes, seed admin + demo data, start listener
# ---------------------------------------------------------------------------

async def seed_demo(founder_id: str):
    if await db.customers.count_documents({"founderId": founder_id}) > 0:
        return
    now = datetime.now(timezone.utc)
    custs = [
        {"id": str(uuid.uuid4()), "founderId": founder_id, "email": "ada@novalabs.xyz", "name": "Ada Okafor",
         "walletAddress": "0x4A3eF2719bC8aA0C11d2F6C8f3b7A1D9e5C0B2a1", "createdAt": now.isoformat()},
        {"id": str(uuid.uuid4()), "founderId": founder_id, "email": "milo@driftstudio.io", "name": "Milo Tanaka",
         "walletAddress": "0x9F1cD3a77B2e4F0a8C6d5E2b1A0f9C8D7e6B5a40", "createdAt": now.isoformat()},
        {"id": str(uuid.uuid4()), "founderId": founder_id, "email": "sara@kiteframe.dev", "name": "Sara Vlk",
         "walletAddress": "0x2b7C9e01Af34D6c5B8a2E1f0D9c8B7a6F5e4D3c2", "createdAt": now.isoformat()},
    ]
    await db.customers.insert_many([dict(c) for c in custs])
    prods = [
        {"id": str(uuid.uuid4()), "founderId": founder_id, "name": "Starter Plan", "priceUsdc": 29.00,
         "billingInterval": "MONTHLY", "createdAt": now.isoformat()},
        {"id": str(uuid.uuid4()), "founderId": founder_id, "name": "Pro Plan", "priceUsdc": 99.00,
         "billingInterval": "MONTHLY", "createdAt": now.isoformat()},
        {"id": str(uuid.uuid4()), "founderId": founder_id, "name": "Annual Scale", "priceUsdc": 990.00,
         "billingInterval": "YEARLY", "createdAt": now.isoformat()},
    ]
    await db.products.insert_many([dict(p) for p in prods])
    subs = [
        {"id": str(uuid.uuid4()), "founderId": founder_id, "customerId": custs[0]["id"], "productId": prods[1]["id"],
         "status": "ACTIVE", "nextBillingDate": (now + timedelta(days=12)).isoformat(), "createdAt": now.isoformat()},
        {"id": str(uuid.uuid4()), "founderId": founder_id, "customerId": custs[1]["id"], "productId": prods[0]["id"],
         "status": "ACTIVE", "nextBillingDate": (now + timedelta(days=4)).isoformat(), "createdAt": now.isoformat()},
        {"id": str(uuid.uuid4()), "founderId": founder_id, "customerId": custs[2]["id"], "productId": prods[2]["id"],
         "status": "PAST_DUE", "nextBillingDate": (now - timedelta(days=2)).isoformat(), "createdAt": now.isoformat()},
    ]
    await db.subscriptions.insert_many([dict(s) for s in subs])
    # invoices: some paid, some pending
    def make_inv(cust, amount, desc, status, days_ago, synced=True):
        d = (now - timedelta(days=days_ago))
        inv = {"id": str(uuid.uuid4()), "founderId": founder_id, "customerId": cust["id"],
               "amountUsdc": amount, "status": status,
               "paymentNonce": "ls_" + secrets.token_urlsafe(10).replace("-", "").replace("_", "")[:14],
               "onchainTxHash": ("0x" + secrets.token_hex(32)) if status == "PAID" else None,
               "paidAt": d.isoformat() if status == "PAID" else None, "payerWallet": cust["walletAddress"],
               "productId": None, "description": desc,
               "erpInvoiceId": (f"QBO-{secrets.token_hex(4).upper()}") if (status == "PAID" and synced) else None,
               "erpSyncStatus": ("SYNCED" if (status == "PAID" and synced) else ("ERROR" if status == "PAID" else "UNSYNCED")),
               "erpSyncLog": None, "createdAt": d.isoformat(), "updatedAt": d.isoformat()}
        return inv
    invs = [
        make_inv(custs[0], 99.00, "Pro Plan - March", "PAID", 70),
        make_inv(custs[1], 29.00, "Starter Plan - March", "PAID", 65),
        make_inv(custs[0], 99.00, "Pro Plan - April", "PAID", 40),
        make_inv(custs[2], 990.00, "Annual Scale", "PAID", 35, synced=False),
        make_inv(custs[1], 29.00, "Starter Plan - May", "PAID", 10),
        make_inv(custs[0], 99.00, "Pro Plan - June", "PENDING", 1),
        make_inv(custs[2], 150.00, "Custom build add-on", "PENDING", 0),
    ]
    await db.invoices.insert_many([dict(i) for i in invs])
    for i in invs:
        if i["status"] == "PAID":
            await db.erp_sync_logs.insert_one({
                "id": str(uuid.uuid4()), "founderId": founder_id, "invoiceId": i["id"],
                "provider": "QUICKBOOKS" if i["erpSyncStatus"] == "SYNCED" else "QUICKBOOKS",
                "status": i["erpSyncStatus"], "erpInvoiceId": i["erpInvoiceId"], "onchainTxHash": i["onchainTxHash"],
                "payload": {"docType": "SalesReceipt", "amount": i["amountUsdc"]},
                "message": "Reconciled invoice pushed to ERP" if i["erpSyncStatus"] == "SYNCED" else "ERP endpoint returned 500: rate limit",
                "ts": i["createdAt"]})

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_requests.create_index("email")
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=900)
    await db.invoices.create_index("paymentNonce", unique=True)
    await db.invoices.create_index("onchainTxHash", sparse=True)
    await db.user_sessions.create_index("session_token")

    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        doc = {"user_id": uid, "email": ADMIN_EMAIL, "password_hash": hash_password(ADMIN_PASSWORD),
               "name": "NexAI Coach", "companyName": "NexAI Labs",
               "baseWalletAddr": "0x5A0b54D5dc17e0AaDc383d2db43B0a0D3E029c4c",
               "erpProvider": "QUICKBOOKS", "erpApiKey": "qbo_demo_key", "auth_provider": "password",
               "role": "founder", "token_version": 0, "created_at": datetime.now(timezone.utc).isoformat()}
        await db.users.insert_one(doc)
        await seed_demo(uid)
    elif not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
        await seed_demo(existing["user_id"])
    else:
        await seed_demo(existing["user_id"])

    asyncio.create_task(listener_loop())
    logger.info("LedgerSync API started. Base RPC: %s", BASE_RPC_URL)

@app.on_event("shutdown")
async def shutdown():
    client.close()
