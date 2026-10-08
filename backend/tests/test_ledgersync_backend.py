"""LedgerSync backend API tests - covers auth, CRUD, checkout, listener, ERP, dashboard."""
import os
import re
import uuid
import time
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if False else None
# Backend URL must come from frontend/.env (public URL) for E2E parity.
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip()
            break
assert BASE, "REACT_APP_BACKEND_URL missing"
API = f"{BASE}/api"

FOUNDER_EMAIL = "nexai.coach@gmail.com"
FOUNDER_PASS = "LedgerSync2026!"


@pytest.fixture(scope="session")
def founder_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


# -------- Auth --------
class TestAuth:
    def test_login_founder(self, founder_session):
        r = founder_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == FOUNDER_EMAIL
        assert "id" in data

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": FOUNDER_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code in (401, 429)

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_then_login_logout(self):
        s = requests.Session()
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "StrongPass!23",
                   "name": "Test User", "companyName": "TestCo"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email
        # me works
        r2 = s.get(f"{API}/auth/me", timeout=15)
        assert r2.status_code == 200
        # logout
        r3 = s.post(f"{API}/auth/logout", timeout=15)
        assert r3.status_code == 200
        # me now fails
        s2 = requests.Session()
        s2.cookies.update(s.cookies)  # but logout cleared cookies on client-side server-set
        # Reuse same session s - cookies deleted by server response
        r4 = s.get(f"{API}/auth/me", timeout=15)
        assert r4.status_code == 401
        # login again
        r5 = s.post(f"{API}/auth/login", json={"email": email, "password": "StrongPass!23"}, timeout=15)
        assert r5.status_code == 200

    def test_forgot_password_parity(self):
        # registered email
        r1 = requests.post(f"{API}/auth/forgot-password", json={"email": FOUNDER_EMAIL}, timeout=15)
        # unregistered
        r2 = requests.post(f"{API}/auth/forgot-password",
                           json={"email": f"nouser_{uuid.uuid4().hex[:6]}@example.com"}, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json()

    def test_reset_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password",
                         json={"token": "garbage_invalid_token", "password": "Whatever!1"}, timeout=15)
        assert r.status_code == 400


# -------- Dashboard / core data --------
class TestDashboard:
    def test_stats(self, founder_session):
        r = founder_session.get(f"{API}/dashboard/stats", timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("mrr", "arr", "activeSubscriptions", "totalCollected"):
            assert k in d, f"missing {k}"

    def test_invoices_list(self, founder_session):
        r = founder_session.get(f"{API}/invoices", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_listener_status(self, founder_session):
        r = founder_session.get(f"{API}/listener/status", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["usdcContract"].lower() == "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
        assert "latestBlock" in d
        # latestBlock may be 0 right at boot before first poll
        assert isinstance(d["latestBlock"], int)

    def test_erp_logs(self, founder_session):
        r = founder_session.get(f"{API}/erp/logs", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------- CRUD: customers, products, subscriptions, invoices (checkout link) --------
class TestCRUD:
    def test_customer_crud(self, founder_session):
        payload = {"name": "TEST_Customer", "email": f"test_cust_{uuid.uuid4().hex[:6]}@ex.com"}
        r = founder_session.post(f"{API}/customers", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # list
        lst = founder_session.get(f"{API}/customers", timeout=15).json()
        assert any(c["id"] == cid for c in lst)
        # delete
        d = founder_session.delete(f"{API}/customers/{cid}", timeout=15)
        assert d.status_code == 200

    def test_product_crud(self, founder_session):
        p = founder_session.post(f"{API}/products",
                                 json={"name": "TEST_Prod", "priceUsdc": 49.0, "billingInterval": "MONTHLY"},
                                 timeout=15)
        assert p.status_code == 200, p.text
        pid = p.json()["id"]
        assert p.json()["priceUsdc"] == 49.0
        d = founder_session.delete(f"{API}/products/{pid}", timeout=15)
        assert d.status_code == 200

    def test_subscription_create_and_update_status(self, founder_session):
        # create customer+product first
        c = founder_session.post(f"{API}/customers", json={"name": "TEST_SubCust",
                                 "email": f"s_{uuid.uuid4().hex[:6]}@ex.com"}, timeout=15).json()
        p = founder_session.post(f"{API}/products",
                                 json={"name": "TEST_SubProd", "priceUsdc": 20.0}, timeout=15).json()
        s = founder_session.post(f"{API}/subscriptions",
                                 json={"customerId": c["id"], "productId": p["id"]}, timeout=15)
        assert s.status_code == 200, s.text
        sid = s.json()["id"]
        u = founder_session.put(f"{API}/subscriptions/{sid}",
                                json={"customerId": c["id"], "productId": p["id"], "status": "PAUSED"},
                                timeout=15)
        assert u.status_code == 200
        # verify
        lst = founder_session.get(f"{API}/subscriptions", timeout=15).json()
        assert any(x["id"] == sid and x["status"] == "PAUSED" for x in lst)
        founder_session.delete(f"{API}/subscriptions/{sid}", timeout=15)
        founder_session.delete(f"{API}/customers/{c['id']}", timeout=15)
        founder_session.delete(f"{API}/products/{p['id']}", timeout=15)

    def test_create_checkout_link(self, founder_session):
        c = founder_session.post(f"{API}/customers", json={"name": "TEST_InvCust",
                                 "email": f"iv_{uuid.uuid4().hex[:6]}@ex.com"}, timeout=15).json()
        inv = founder_session.post(f"{API}/invoices",
                                   json={"customerId": c["id"], "amountUsdc": 42.5,
                                         "description": "TEST invoice"}, timeout=15)
        assert inv.status_code == 200, inv.text
        d = inv.json()
        assert d["amountUsdc"] == 42.5
        assert d["paymentNonce"]
        assert d["status"] == "PENDING"
        # public checkout without auth
        pub = requests.get(f"{API}/checkout/{d['paymentNonce']}", timeout=15)
        assert pub.status_code == 200
        assert pub.json()["invoice"]["paymentNonce"] == d["paymentNonce"]


# -------- Checkout confirm validation --------
class TestCheckoutConfirm:
    def test_confirm_bad_txhash(self, founder_session):
        # need an invoice with a merchant wallet set, else we get the wallet error first.
        # Make sure founder has a wallet set
        founder_session.put(f"{API}/settings",
                            json={"baseWalletAddr": "0x" + "a" * 40}, timeout=15)
        c = founder_session.post(f"{API}/customers", json={"name": "TEST_ConfCust",
                                 "email": f"cf_{uuid.uuid4().hex[:6]}@ex.com"}, timeout=15).json()
        inv = founder_session.post(f"{API}/invoices",
                                   json={"customerId": c["id"], "amountUsdc": 1.0}, timeout=15).json()
        nonce = inv["paymentNonce"]
        r = requests.post(f"{API}/checkout/{nonce}/confirm",
                          json={"txHash": "not-a-real-hash"}, timeout=15)
        assert r.status_code == 400
        assert "Invalid transaction hash" in r.text or "invalid" in r.text.lower()

    def test_confirm_nonexistent(self):
        r = requests.post(f"{API}/checkout/nonexistent_nonce_xyz/confirm",
                          json={"txHash": "0x" + "a" * 64}, timeout=15)
        assert r.status_code == 404


# -------- Settings --------
class TestSettings:
    def test_update_settings_persist(self, founder_session):
        new_name = f"TestCo-{uuid.uuid4().hex[:5]}"
        r = founder_session.put(f"{API}/settings",
                                json={"companyName": new_name,
                                      "baseWalletAddr": "0x" + "b" * 40,
                                      "erpProvider": "quickbooks"}, timeout=15)
        assert r.status_code == 200
        me = founder_session.get(f"{API}/auth/me", timeout=15).json()
        assert me["companyName"] == new_name
        assert me["baseWalletAddr"].startswith("0x")

    def test_bad_wallet_rejected(self, founder_session):
        r = founder_session.put(f"{API}/settings",
                                json={"baseWalletAddr": "not-an-address"}, timeout=15)
        assert r.status_code == 400
